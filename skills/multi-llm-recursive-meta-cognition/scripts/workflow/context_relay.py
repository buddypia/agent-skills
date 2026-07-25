"""Context relay — never re-send a large original context to every stage.

Re-embedding the user's original context in each stage multiplied token cost and
wall-clock by the number of stages. Two tiers replace that, escalating with size:

  Tier 1 — piggyback digest (moderate context, > MULTILLM_DIGEST_THRESHOLD)
      The stage-1 model emits a ``context_digest`` alongside its normal output, and
      later stages receive that digest plus a short verbatim excerpt of the original.
      Cheap (no extra model call), but stage 1 itself still reads the full original.

  Tier 2 — sharded parallel pre-distillation (very large context, > MULTILLM_SHARD_THRESHOLD)
      The original is split into topic shards (Markdown headings → blank lines →
      sentence-aware slicing) and distilled CONCURRENTLY, one shard per call,
      round-robin across the run's configured vendors. The shard digests are packed
      into a single brief that EVERY stage — including stage 1 — works from, so no
      single call ever reads the whole original. Shards are distilled at
      MULTILLM_DISTILL_EFFORT (cheap by default) since the work is mechanical.

Shard COUNT and CALL CONCURRENCY are separate knobs. Count follows the input size
(one shard per MULTILLM_SHARD_CHARS, capped at MULTILLM_SHARD_MAX) so shards stay a
size a model can faithfully summarize; concurrency is capped independently by
MULTILLM_SHARD_CONCURRENCY so a large input does not spawn a matching number of
simultaneous CLI processes. Excess shards queue and run in later batches.

Tier 2 is bounded on both axes so it can never cost more than it saves:
  - wall clock: the whole pre-stage is capped at _DISTILL_BUDGET_FRACTION of the
    remaining pipeline budget, divided fairly across batches so a slow first batch
    cannot starve the rest; it is skipped outright below _DISTILL_MIN_BUDGET_SEC
  - size: each shard's contribution to the pack is capped so the pack stays near the
    tier-1 threshold even if a distiller echoes or pads instead of compressing

Environment variables:
  MULTILLM_DIGEST_THRESHOLD   character threshold above which a digest replaces the
                              original for downstream stages (default 8000; 0 disables
                              both tiers and always relays the full original)
  MULTILLM_SHARD_THRESHOLD    character threshold above which tier 2 kicks in
                              (default: 3x the digest threshold; 0 disables tier 2)
  MULTILLM_SHARD_CHARS        target maximum characters per shard (default 12000)
  MULTILLM_SHARD_MAX          maximum number of shards (default 16)
  MULTILLM_SHARD_CONCURRENCY  maximum simultaneous distillation calls (default 8)
  MULTILLM_DISTILL_EFFORT     reasoning effort for the distillation calls (default low)

Degradation is always explicit, never silent. Every lossy outcome is counted in the
report returned alongside the pack, surfaced in the run's JSON result as
``context_relay``, and logged to stderr:
  - a shard whose distillation call fails, times out, or is skipped for budget is
    replaced by a truncated verbatim excerpt of that shard, labeled as such
  - an over-long shard digest is truncated with a label. A few trimmed digests are ordinary
    budget enforcement and are counted but do not raise `degraded`; truncation across more
    than half the shards does, since the distiller plainly isn't compressing
  - when the input needs more than MULTILLM_SHARD_MAX shards of MULTILLM_SHARD_CHARS to
    cover, the shards above that target are reported as oversized (their digests are
    necessarily very lossy) and `degraded` is raised
  - if every shard fails, or the budget is too small to afford the pre-stage, tier 2
    is skipped and the run falls back to tier 1
  - if no digest is available at all (e.g. a degraded stage 1), the full original is
    relayed unchanged — the pre-distillation behavior
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import re
import sys
import time
from typing import Any, Sequence

from .providers import deadline_remaining, get_adapter, set_reasoning_effort_override

_DEFAULT_THRESHOLD = 8000
_EXCERPT_CHARS = 1500

# Tier 2 tuning
_SHARD_THRESHOLD_MULTIPLIER = 3
_DEFAULT_SHARD_CHARS = 12000
_DEFAULT_SHARD_MAX = 16
_DEFAULT_SHARD_CONCURRENCY = 8
_MIN_SHARD_CHARS = 4000
_DEFAULT_DISTILL_EFFORT = "low"
# Don't start the pre-stage unless this many seconds of the whole-pipeline budget are
# left — the main stages still have to run after it.
_DISTILL_MIN_BUDGET_SEC = 150.0
# Share of the remaining budget the whole pre-stage may consume. Without this cap each
# shard would be allowed the full MULTILLM_CLI_TIMEOUT, so a slow vendor could burn most
# of MULTILLM_TOTAL_DEADLINE before the first real stage even starts.
_DISTILL_BUDGET_FRACTION = 0.35
_MIN_SHARD_TIMEOUT_SEC = 20.0
_SHARD_FAILURE_EXCERPT_CHARS = 1200
# Floor for a single shard's contribution to the pack, used when many shards share the
# relay budget.
_MIN_SHARD_DIGEST_CHARS = 250
_OVERVIEW_HEAD_CHARS = 300
_SHARD_LABEL_CHARS = 70
# When hard-slicing unstructured text, look back this share of the target for a sentence end.
_SLICE_LOOKBACK_RATIO = 0.15

_HEADING_RE = re.compile(r"^#{1,6} .*$", re.MULTILINE)
_SENTENCE_ENDS = "。．！？.!?;；\n"


# =============================================================================
# Thresholds
# =============================================================================

def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value >= 0 else default


def digest_threshold() -> int:
    return _env_int("MULTILLM_DIGEST_THRESHOLD", _DEFAULT_THRESHOLD)


def shard_threshold() -> int:
    """Tier-2 threshold. Defaults to a multiple of the tier-1 threshold so that raising
    MULTILLM_DIGEST_THRESHOLD alone moves both tiers together."""
    if os.getenv("MULTILLM_SHARD_THRESHOLD", "").strip():
        return _env_int("MULTILLM_SHARD_THRESHOLD", digest_threshold() * _SHARD_THRESHOLD_MULTIPLIER)
    base = digest_threshold()
    return base * _SHARD_THRESHOLD_MULTIPLIER if base else 0


def shard_chars() -> int:
    """Target maximum characters per shard — what drives the shard count."""
    return max(_MIN_SHARD_CHARS, _env_int("MULTILLM_SHARD_CHARS", _DEFAULT_SHARD_CHARS))


def shard_max() -> int:
    """Maximum number of shards (not the concurrency cap — see shard_concurrency)."""
    return max(2, _env_int("MULTILLM_SHARD_MAX", _DEFAULT_SHARD_MAX))


def shard_concurrency() -> int:
    """Maximum simultaneous distillation calls. Each one is a separate CLI process, so
    this is the resource-pressure and per-vendor rate-limit knob, independent of how many
    shards the input is split into."""
    return max(1, _env_int("MULTILLM_SHARD_CONCURRENCY", _DEFAULT_SHARD_CONCURRENCY))


def distill_effort() -> str:
    return os.getenv("MULTILLM_DISTILL_EFFORT", "").strip() or _DEFAULT_DISTILL_EFFORT


# =============================================================================
# Tier 1 — relay
# =============================================================================

def relay_context(original: str, digest: str) -> str:
    """Context to hand to a stage.

    Returns the original verbatim when it is small, distillation is disabled, or no
    digest is available; otherwise the digest (a stage-1 digest or a tier-2 shard pack)
    plus a verbatim excerpt of the original's opening.
    """
    threshold = digest_threshold()
    if threshold == 0 or len(original) <= threshold:
        return original
    digest = (digest or "").strip()
    if not digest:
        return original
    excerpt = original[:_EXCERPT_CHARS]
    return (
        f"[The original context is {len(original)} chars and was distilled to keep this "
        "pipeline within its token/time budget. Base your analysis on the digest below; "
        "the excerpt shows the original's opening verbatim.]\n\n"
        "=== Context digest ===\n"
        f"{digest}\n\n"
        f"=== Original context excerpt (first {_EXCERPT_CHARS} chars) ===\n"
        f"{excerpt}\n...[truncated]"
    )


# =============================================================================
# Tier 2 — sharding
# =============================================================================

def _split_by_headings(text: str) -> list[str]:
    """Split on Markdown headings so a shard boundary follows a topic boundary."""
    starts = [m.start() for m in _HEADING_RE.finditer(text)]
    if len(starts) < 2:
        return [text]
    pieces: list[str] = []
    if starts[0] > 0:
        pieces.append(text[: starts[0]])
    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else len(text)
        pieces.append(text[start:end])
    return [p for p in pieces if p.strip()]


def _hard_slice(text: str, target: int) -> list[str]:
    """Slice an unstructured run of text, preferring a sentence boundary near ``target``.

    Fixed-width slicing cuts mid-sentence — very visible with CJK prose, which often has
    no blank lines for ``_subdivide`` to use — and a shard that starts mid-clause distills
    badly. Look back over a small window for a sentence terminator and cut there instead,
    falling back to the fixed width when the window holds none.
    """
    out: list[str] = []
    lookback = max(1, int(target * _SLICE_LOOKBACK_RATIO))
    i, n = 0, len(text)
    while i < n:
        if n - i <= target:
            out.append(text[i:])
            break
        window_end = i + target
        cut = window_end
        for j in range(window_end - 1, max(i, window_end - lookback) - 1, -1):
            if text[j] in _SENTENCE_ENDS:
                cut = j + 1
                break
        out.append(text[i:cut])
        i = cut
    return out


def _subdivide(pieces: Sequence[str], target: int) -> list[str]:
    """Break oversized pieces on blank lines, then hard-slice anything still oversized."""
    out: list[str] = []
    for piece in pieces:
        if len(piece) <= target:
            out.append(piece)
            continue
        buffer = ""
        for paragraph in piece.split("\n\n"):
            if buffer and len(buffer) + len(paragraph) + 2 > target:
                out.append(buffer)
                buffer = ""
            if len(paragraph) > target:
                if buffer:
                    out.append(buffer)
                    buffer = ""
                out.extend(_hard_slice(paragraph, target))
                continue
            buffer = f"{buffer}\n\n{paragraph}" if buffer else paragraph
        if buffer:
            out.append(buffer)
    return [p for p in out if p.strip()]


def _pack_pieces(pieces: Sequence[str], target: int, cap: int) -> list[str]:
    """Group adjacent pieces into at most ``cap`` shards of roughly ``target`` chars.

    Order-preserving, and deliberately not "merge into the last bucket once full": that
    naive rule dumps every leftover piece into the final shard, which then arrives several
    times larger than its siblings and becomes the slow, lossy call in the fan-out. Here a
    bucket is closed once it reaches ``target``, or earlier when the pieces left would not
    otherwise fill the buckets left, which keeps the largest/smallest shard ratio small.
    """
    buckets: list[list[str]] = []
    current: list[str] = []
    current_len = 0
    for i, piece in enumerate(pieces):
        current.append(piece)
        current_len += len(piece)
        pieces_left = len(pieces) - i - 1
        if pieces_left == 0:
            break
        buckets_left = cap - len(buckets) - 1  # buckets still available after closing this one
        if buckets_left > 0 and (current_len >= target or pieces_left <= buckets_left):
            buckets.append(current)
            current, current_len = [], 0
    if current:
        buckets.append(current)
    shards = ["\n\n".join(bucket) for bucket in buckets]
    # A tiny remainder shard costs a whole CLI call for almost no content — fold it back.
    if len(shards) > 1 and len(shards[-1]) < target // 4:
        tail = shards.pop()
        shards[-1] = f"{shards[-1]}\n\n{tail}"
    return shards


def shard_count_for(length: int, cap: int | None = None) -> int:
    """How many shards ``length`` chars should be split into.

    Driven by MULTILLM_SHARD_CHARS so shard size stays roughly constant as input grows,
    rather than a fixed count that makes each shard arbitrarily large.
    """
    limit = cap if cap is not None else shard_max()
    return max(2, min(limit, math.ceil(length / shard_chars())))


def split_into_shards(text: str, *, max_shards: int | None = None) -> list[str]:
    """Split ``text`` into topic-aligned shards of roughly MULTILLM_SHARD_CHARS each."""
    count = shard_count_for(len(text), max_shards)
    target = max(_MIN_SHARD_CHARS, math.ceil(len(text) / count))
    pieces = _subdivide(_split_by_headings(text), target)
    return _pack_pieces(pieces, target, count) or [text]


def _shard_label(shard: str) -> str:
    for line in shard.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        return stripped.lstrip("#").strip()[:_SHARD_LABEL_CHARS]
    return shard.strip()[:_SHARD_LABEL_CHARS]


def _build_overview(original: str, shards: Sequence[str]) -> str:
    head = " ".join(original[:_OVERVIEW_HEAD_CHARS].split())
    shard_map = "\n".join(
        f"  {i + 1}/{len(shards)}: {_shard_label(s)}" for i, s in enumerate(shards)
    )
    return (
        "=== Whole-document orientation (for context only — do NOT summarize this) ===\n"
        f"Total length: {len(original)} chars, split into {len(shards)} shards.\n"
        f"Document opening: {head}...\n"
        f"Shard map:\n{shard_map}"
    )


# =============================================================================
# Tier 2 — distillation
# =============================================================================

_DISTILL_SYSTEM_PROMPT = (
    "You are a context distiller in a multi-stage LLM pipeline. You receive ONE SHARD of a "
    "larger document plus a short orientation describing the whole document.\n\n"
    "Distill ONLY your shard into a faithful, self-contained summary that later stages will "
    "use INSTEAD of the original text. They will never see your shard, so anything you drop "
    "is lost.\n\n"
    "Rules:\n"
    "- Preserve specifics: numbers, dates, names, versions, identifiers, constraints, "
    "requirements, decisions, and explicit trade-offs.\n"
    "- Stay neutral: report what the shard says. Do not judge it, argue with it, take a "
    "side, or add information that is not there.\n"
    "- Do not summarize the orientation section; it is background only.\n"
    "- If the shard is mostly boilerplate or irrelevant, say so briefly rather than padding.\n"
    "- Write in the same language as the shard.\n\n"
    "Output ONLY one JSON object matching the given schema: no code fences, no commentary."
)

_SHARD_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "topic": {
            "type": "string",
            "description": "Short label for what this shard covers",
        },
        "digest": {
            "type": "string",
            "description": "Faithful, neutral, self-contained summary of this shard",
        },
        "key_facts": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Facts, figures, or quotes that must survive verbatim",
        },
    },
    "required": ["topic", "digest", "key_facts"],
    "additionalProperties": False,
}


def _parse_shard_response(text: str) -> dict[str, Any] | None:
    """Parse a distiller response, tolerating a non-JSON answer by treating it as the digest."""
    cleaned = (text or "").strip()
    if not cleaned:
        return None
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return {"topic": "", "digest": cleaned, "key_facts": []}
    if not isinstance(data, dict):
        return {"topic": "", "digest": cleaned, "key_facts": []}
    digest = data.get("digest")
    if not isinstance(digest, str) or not digest.strip():
        return None
    key_facts = data.get("key_facts")
    return {
        "topic": data.get("topic") if isinstance(data.get("topic"), str) else "",
        "digest": digest,
        "key_facts": [f for f in key_facts if isinstance(f, str)] if isinstance(key_facts, list) else [],
    }


def _excerpt_fallback(shard: str, reason: str, provider: str) -> dict[str, Any]:
    return {
        "topic": _shard_label(shard),
        "digest": (
            f"[{reason}; verbatim excerpt of this shard's first "
            f"{_SHARD_FAILURE_EXCERPT_CHARS} chars follows.]\n"
            f"{shard[:_SHARD_FAILURE_EXCERPT_CHARS]}\n...[truncated]"
        ),
        "key_facts": [],
        "provider": provider,
        "failed": True,
    }


async def _distill_shard(
    shard: str,
    index: int,
    total: int,
    overview: str,
    config: Any,
    semaphore: asyncio.Semaphore,
    deadline: float,
    per_shard_cap: float,
) -> dict[str, Any]:
    """Distill one shard. Never raises — a failure returns a labeled excerpt fallback.

    The semaphore caps how many of these run at once (each is a CLI process), so shards
    beyond the concurrency limit wait here and run in a later batch.
    """
    provider = config.normalized_provider()
    async with semaphore:
        # Runs inside its own asyncio Task, so this override cannot leak to other tasks.
        set_reasoning_effort_override(distill_effort())
        left = deadline - time.monotonic()
        if left < _MIN_SHARD_TIMEOUT_SEC:
            print(
                f"[context-relay] shard {index}/{total} skipped: the pre-stage budget ran out "
                f"({left:.0f}s left); using a verbatim excerpt of that shard",
                file=sys.stderr,
            )
            return _excerpt_fallback(shard, "Distillation skipped (pre-stage budget exhausted)", provider)
        try:
            adapter = get_adapter(provider)
            # asyncio.TimeoutError is an Exception, so a shard that blows its slice of the
            # pre-stage budget degrades to the excerpt fallback instead of stalling the run.
            response = await asyncio.wait_for(
                adapter.generate_structured(
                    model=config.model,
                    api_key=config.api_key,
                    base_url=config.base_url,
                    system_prompt=_DISTILL_SYSTEM_PROMPT,
                    user_prompt=(
                        f"{overview}\n\n"
                        f"=== Your shard ({index}/{total}) — distill THIS ===\n{shard}"
                    ),
                    temperature=config.temperature,
                    schema=_SHARD_SCHEMA,
                    schema_name="context_shard_digest",
                    output_model=None,
                ),
                timeout=min(per_shard_cap, left),
            )
            parsed = _parse_shard_response(response.response_text)
            if parsed is None:
                raise ValueError("distiller returned no usable digest")
            parsed["provider"] = provider
            parsed["failed"] = False
            return parsed
        except Exception as exc:  # noqa: BLE001 — a failed shard must not kill the pipeline
            print(
                f"[context-relay] shard {index}/{total} distillation failed via {provider} "
                f"({exc}); falling back to a verbatim excerpt of that shard",
                file=sys.stderr,
            )
            return _excerpt_fallback(shard, "Distillation failed for this shard", provider)


def _shard_digest_budget(shard_count: int) -> int:
    """Per-shard character budget for its contribution to the pack.

    Nothing forces a distiller to actually compress: one that echoes its shard back (or
    pads) would make the pack as large as the original, and since EVERY stage reads the
    pack that costs more than not distilling at all. Bounding the whole pack to roughly
    the tier-1 relay threshold keeps the guarantee independent of model behavior.
    """
    return max(_MIN_SHARD_DIGEST_CHARS, digest_threshold() // max(1, shard_count))


def _fit_to_budget(text: str, budget: int) -> str:
    if len(text) <= budget:
        return text
    return f"{text[:budget]}\n...[digest truncated to fit the relay budget]"


def _build_pack(
    original: str, shards: Sequence[str], results: Sequence[dict[str, Any]]
) -> tuple[str, int]:
    """Assemble the digest pack. Returns (pack, number of truncated shard digests)."""
    failed = sum(1 for r in results if r.get("failed"))
    providers = ", ".join(sorted({str(r.get("provider", "?")) for r in results}))
    budget = _shard_digest_budget(len(shards))
    truncated = 0
    header_parts = [
        f"[Sharded digest: the original ({len(original)} chars) was split into "
        f"{len(shards)} topic shards and distilled in parallel by {providers}."
    ]
    if failed:
        header_parts.append(f" {failed} of {len(shards)} shards fell back to a verbatim excerpt.")

    sections: list[str] = []
    for i, result in enumerate(results):
        topic = (result.get("topic") or _shard_label(shards[i])).strip()
        digest = str(result.get("digest", "")).strip()
        block = [f"--- Shard {i + 1}/{len(shards)}: {topic} ---"]
        fitted = _fit_to_budget(digest, budget)
        if fitted != digest:
            truncated += 1
        block.append(fitted)
        # Key facts share the same budget, so a long list cannot smuggle the shard back in.
        remaining = budget - len(fitted)
        key_facts = [f for f in (result.get("key_facts") or []) if str(f).strip()]
        if key_facts and remaining > 0:
            kept: list[str] = []
            for fact in key_facts:
                fact = str(fact).strip()
                if len(fact) + 4 > remaining:
                    break
                kept.append(fact)
                remaining -= len(fact) + 4
            if kept:
                block.append("Key facts:")
                block.extend(f"  - {fact}" for fact in kept)
        sections.append("\n".join(block))

    if truncated:
        header_parts.append(
            f" {truncated} shard digest(s) exceeded the {budget}-char relay budget and were truncated."
        )
        print(
            f"[context-relay] {truncated}/{len(shards)} shard digests exceeded the "
            f"{budget}-char budget and were truncated — the distiller compressed poorly",
            file=sys.stderr,
        )
    return "\n\n".join(["".join(header_parts) + "]"] + sections), truncated


def should_shard(original: str) -> bool:
    digest_t = digest_threshold()
    if digest_t <= 0:
        return False
    shard_t = shard_threshold()
    if not shard_t:
        return False
    # Compare against BOTH thresholds: with MULTILLM_DIGEST_THRESHOLD raised above
    # MULTILLM_SHARD_THRESHOLD, relay_context() would still hand every stage the full
    # original, so sharding would pay for K distillation calls and then discard the pack.
    return len(original) > max(shard_t, digest_t)


def _count_oversized(original: str, shards: Sequence[str]) -> int:
    """Shards too large to distill faithfully — but only when the *input* is the cause.

    A shard can land above the target purely because heading granularity doesn't divide
    evenly into the shard count, which is harmless. The condition worth reporting is that
    the input needs more than ``shard_max()`` shards of ``shard_chars()`` to cover, so
    every shard is necessarily oversized no matter how the pieces are packed.
    """
    if len(original) <= shard_chars() * shard_max():
        return 0
    return sum(1 for s in shards if len(s) > shard_chars())


def _new_report(
    *,
    shards: int = 0,
    failed_shards: int = 0,
    truncated_shards: int = 0,
    oversized_shards: int = 0,
    pack_chars: int = 0,
) -> dict[str, Any]:
    return {
        "shards": shards,
        "failed_shards": failed_shards,
        "truncated_shards": truncated_shards,
        "oversized_shards": oversized_shards,
        "pack_chars": pack_chars,
        # Degraded when the relay lost fidelity in a way the caller should act on: a shard
        # that produced no digest at all, an input too large to cover at the shard cap, or
        # truncation so widespread that the distiller plainly isn't compressing. A few
        # trimmed digests are ordinary budget enforcement — they are labeled in the pack and
        # counted here, but don't raise the flag, or every large input would trip it.
        "degraded": bool(
            failed_shards or oversized_shards or truncated_shards > shards // 2
        ),
    }


async def distill_context(
    original: str, configs: Sequence[Any]
) -> tuple[str | None, dict[str, Any] | None]:
    """Run the tier-2 sharded pre-distillation.

    Returns ``(pack, report)``. ``pack`` is the digest to use as the run's
    ``context_digest``, or None when tier 2 does not apply (context small enough,
    disabled, no budget) or every shard failed — in which case the caller keeps the
    tier-1 behavior. ``report`` is None when the pre-stage never ran, and otherwise
    carries the per-shard degradation counts for the caller to surface in its result.
    """
    if not should_shard(original) or not configs:
        return None, None

    remaining = deadline_remaining()
    if remaining < _DISTILL_MIN_BUDGET_SEC:
        print(
            f"[context-relay] skipping sharded pre-distillation: only {remaining:.0f}s of the "
            "wall-clock budget left; falling back to a stage-1 digest",
            file=sys.stderr,
        )
        return None, None

    shards = split_into_shards(original)
    if len(shards) < 2:
        return None, None

    oversized = _count_oversized(original, shards)
    if oversized:
        print(
            f"[context-relay] WARNING: {oversized}/{len(shards)} shards exceed the "
            f"{shard_chars()}-char target (largest {max(len(s) for s in shards)}) because the "
            f"input needs more than MULTILLM_SHARD_MAX={shard_max()} shards to cover. Their "
            "digests will be heavily lossy — raise MULTILLM_SHARD_MAX, or curate the input "
            "into a brief before invoking",
            file=sys.stderr,
        )

    concurrency = min(shard_concurrency(), len(shards))
    batches = math.ceil(len(shards) / concurrency)
    # The shards run in `batches` waves, so split the pre-stage budget across waves
    # rather than letting the first wave spend all of it.
    prestage_budget = max(_MIN_SHARD_TIMEOUT_SEC, remaining * _DISTILL_BUDGET_FRACTION)
    per_shard_cap = max(_MIN_SHARD_TIMEOUT_SEC, prestage_budget / batches)
    deadline = time.monotonic() + prestage_budget
    overview = _build_overview(original, shards)
    print(
        f"[context-relay] distilling {len(original)} chars as {len(shards)} shards "
        f"({concurrency} at a time, {batches} batch(es); effort={distill_effort()}, "
        f"<={prestage_budget:.0f}s of the {remaining:.0f}s budget)",
        file=sys.stderr,
    )

    semaphore = asyncio.Semaphore(concurrency)
    results = await asyncio.gather(
        *(
            _distill_shard(
                shard,
                i + 1,
                len(shards),
                overview,
                configs[i % len(configs)],
                semaphore,
                deadline,
                per_shard_cap,
            )
            for i, shard in enumerate(shards)
        )
    )

    failed = sum(1 for r in results if r.get("failed"))
    if failed == len(results):
        print(
            "[context-relay] every shard failed to distill; falling back to a stage-1 digest",
            file=sys.stderr,
        )
        return None, _new_report(
            shards=len(shards), failed_shards=failed, oversized_shards=oversized
        )

    pack, truncated = _build_pack(original, shards, results)
    return pack, _new_report(
        shards=len(shards),
        failed_shards=failed,
        truncated_shards=truncated,
        oversized_shards=oversized,
        pack_chars=len(pack),
    )


def build_relay_info(
    original: str, relayed: str, report: dict[str, Any] | None
) -> dict[str, Any]:
    """Describe how the context was relayed, for the run's JSON result.

    ``mode`` reflects what the stages actually read: ``sharded`` when a tier-2 pack was
    produced and used, ``digest`` for the tier-1 stage-1 digest, ``verbatim`` when the
    original was small enough to pass through. A tier-2 attempt that failed outright
    reports ``digest``/``verbatim`` with its failure counts intact.
    """
    used_pack = bool(report and report.get("pack_chars"))
    if used_pack:
        mode = "sharded"
    elif relayed != original:
        mode = "digest"
    else:
        mode = "verbatim"
    info: dict[str, Any] = {
        "mode": mode,
        "original_chars": len(original),
        "relayed_chars": len(relayed),
        "shards": 0,
        "failed_shards": 0,
        "truncated_shards": 0,
        "oversized_shards": 0,
        "degraded": False,
    }
    if report:
        info.update(
            shards=int(report.get("shards", 0)),
            failed_shards=int(report.get("failed_shards", 0)),
            truncated_shards=int(report.get("truncated_shards", 0)),
            oversized_shards=int(report.get("oversized_shards", 0)),
            degraded=bool(report.get("degraded")),
        )
    return info
