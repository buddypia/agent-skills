#!/usr/bin/env python3
"""Verify the repository invariants that no single file can enforce on its own.

Run before committing:

    python3 tools/check_invariants.py

Why this exists
---------------
Each skill under skills/ is published standalone, so anything shared between skills is a
*copy*, and anything documented is a *restatement*. Both drift silently:

* ``workflow/models.py`` and ``workflow/context_relay.py`` are byte-identical copies in three
  skills. Editing one and forgetting the others produces three skills that behave differently
  while looking maintained.
* A model ID is named 130+ times across READMEs (4 languages), config templates (two parallel
  sets per skill) and ``--help`` examples. A model bump that misses one leaves a template that
  hands the user a retired ID.
* The model-policy deny-list in models.py is regex-based. Loosening one pattern to admit a new
  ID can silently re-admit a whole retired generation.

Every check below has already failed for real in this repo's history, so each one is a
regression test, not a hypothetical.

stdlib only, no network, no vendor CLIs — safe to run in CI and from an editor hook.

Hook mode
---------
``--hook`` reads a Claude Code hook payload on stdin, runs only the checks that the edited path
can affect, and exits 2 (so the message is fed back to the agent) when an invariant broke.
Irrelevant paths exit 0 immediately.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Skills that share the duplicated workflow modules.
MULTI_LLM_SKILLS = (
    "multi-llm-debate",
    "multi-llm-reflection",
    "multi-llm-recursive-meta-cognition",
)

# Modules that must be byte-identical across all three skills. providers.py is deliberately
# NOT here: debate's mock payload carries an extra context_digest field its schema requires.
SHARED_MODULES = ("models.py", "context_relay.py")

# Directories never worth walking.
SKIP_DIRS = {".git", ".venv", "venv", "__pycache__", ".tmp", ".worktrees",
             ".pytest_cache", ".ruff_cache", "node_modules", ".idea", ".vscode"}

TEXT_SUFFIXES = {".py", ".md", ".example", ".yaml", ".yml", ".json", ".txt", ".sh", ".toml",
                 ".ps1", ".cmd"}

# models.py owns the deny-list, so it is the one file allowed to name retired IDs.
LEGACY_ID_EXEMPT = {"tools/check_invariants.py"} | {
    f"skills/{skill}/scripts/workflow/models.py" for skill in MULTI_LLM_SKILLS
}

# A token that looks like a vendor model ID. Anchored on the family word so unrelated
# hyphenated names (claude-code-steering, @anthropic-ai/claude-code) are not swept up.
MODEL_TOKEN = re.compile(
    r"\b(?:"
    r"claude-(?:opus|sonnet|haiku|instant|fable|mythos)[\w.\-]*"
    r"|claude-\d[\w.\-]*"
    r"|gpt-\d[\w.\-]*"
    r"|gemini-(?:\d|pro)[\w.\-]*"
    r"|o[1-9]-(?:mini|preview)[\w.\-]*"
    r"|text-(?:davinci|curie|babbage|ada)[\w.\-]*"
    r")"
)

# Assignment positions in a config template: `model: <id>` / `*MODEL*=<id>` / `--x-model <id>`.
TEMPLATE_MODEL_LINE = re.compile(
    r"(?:^\s*#?\s*model:\s*|^\s*#?\s*[A-Z][A-Z0-9_]*MODEL[A-Z0-9_]*\s*=\s*|--[a-z-]*model\s+)"
    r"(?P<value>[A-Za-z0-9][\w.\-]*)"
)

# Fixtures for the deny-list. Not exhaustive — a regression net for the patterns that exist.
MUST_REJECT = (
    "claude-3-5-sonnet-latest", "claude-3-5-sonnet-20241022", "claude-3-opus-20240229",
    "claude-3-7-sonnet-20250219", "claude-3.5-sonnet", "claude-2.1", "claude-instant-1.2",
    "claude-haiku-3-5", "claude-sonnet-3-7",
    "gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4-turbo", "gpt-3.5-turbo",
    "text-davinci-003", "o1", "o1-mini", "o3-mini",
    "gemini-1.5-pro", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-pro",
)
# Current IDs plus plausible *future* ones: a deny-list that blocks tomorrow's model is worse
# than one that misses yesterday's, so these are the more important half of the fixture.
MUST_ACCEPT = (
    "claude-opus-5", "claude-sonnet-5", "claude-fable-5", "claude-haiku-4-5",
    "claude-opus-4-8", "claude-sonnet-4-6", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash",
    "gpt-3.6-luna", "mock-v1",
    "claude-opus-6", "claude-sonnet-6-1", "gemini-4-flash", "gemini-3.7-pro",
    "gpt-3.7-nova", "o5-turbo",
)


def rel(path: Path) -> str:
    return path.relative_to(REPO).as_posix()


def _walk(root: Path, keep) -> list[Path]:
    """Depth-first walk that prunes SKIP_DIRS *before* descending.

    Pruning matters: Path.rglob would happily walk each skill's .venv (thousands of files) and
    make this script slow enough that nobody runs it.
    """
    found: list[Path] = []
    stack = [root]
    while stack:
        current = stack.pop()
        for entry in sorted(current.iterdir()):
            if entry.is_dir():
                if entry.name not in SKIP_DIRS:
                    stack.append(entry)
            elif keep(entry):
                found.append(entry)
    return found


_text_files_cache: list[Path] | None = None


def walk_text_files() -> list[Path]:
    global _text_files_cache
    if _text_files_cache is None:
        _text_files_cache = _walk(
            REPO,
            lambda p: p.suffix in TEXT_SUFFIXES or p.name.endswith(".env.example"),
        )
    return _text_files_cache


def load_policy():
    """Load models.py from the first skill, straight from its file path.

    Deliberately NOT ``from workflow import models``: that executes ``workflow/__init__.py``,
    which pulls in every other stage module — so a syntax error in an unrelated file, or a
    missing pydantic, made this script die with a traceback instead of reporting the problem.
    models.py imports only os/re/sys, so it loads standalone. Which skill's copy we read does
    not matter; check_shared_modules_identical() proves they are the same bytes.
    """
    path = REPO / "skills" / MULTI_LLM_SKILLS[0] / "scripts" / "workflow" / "models.py"
    spec = importlib.util.spec_from_file_location("_multillm_models_policy", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {rel(path)}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# =============================================================================
# Checks. Each returns a list of human-readable failures.
# =============================================================================

def check_shared_modules_identical() -> list[str]:
    failures = []
    for module in SHARED_MODULES:
        digests: dict[str, list[str]] = {}
        for skill in MULTI_LLM_SKILLS:
            path = REPO / "skills" / skill / "scripts" / "workflow" / module
            if not path.is_file():
                failures.append(f"{rel(path)} is missing — {module} must exist in all "
                                f"{len(MULTI_LLM_SKILLS)} skills")
                continue
            digest = hashlib.md5(path.read_bytes()).hexdigest()
            digests.setdefault(digest, []).append(rel(path))
        if len(digests) > 1:
            groups = " | ".join(
                f"{digest[:8]}: {', '.join(paths)}" for digest, paths in digests.items()
            )
            failures.append(
                f"{module} has diverged across skills ({groups}). It is a byte-identical "
                f"copy by design: edit one, then copy it to the others."
            )
    return failures


def check_no_legacy_ids(policy, paths: list[Path] | None = None) -> list[str]:
    """No file may name a model ID that the policy itself would refuse.

    Tokens containing a glob (`claude-3-*`, `gpt-4*`) are skipped: documentation has to be able
    to describe the families it rejects.
    """
    failures = []
    for path in paths if paths is not None else walk_text_files():
        relpath = rel(path)
        if relpath in LEGACY_ID_EXEMPT:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            for match in MODEL_TOKEN.finditer(line):
                token = match.group(0)
                # A glob or a trailing separator means the text is describing a *family*
                # (e.g. `gpt-4*`, `claude-3-*`), which documentation has to be able to do.
                # The `*` is not part of the token, so look at the character after it.
                following = line[match.end() : match.end() + 1]
                if following == "*" or token.endswith(("-", ".")):
                    continue
                reason = policy.legacy_reason(token)
                if reason:
                    failures.append(
                        f"{relpath}:{lineno} names the out-of-date model {token!r} ({reason}). "
                        f"Replace it with the current default for that provider."
                    )
    return failures


def check_templates_match_defaults(policy, paths: list[Path] | None = None) -> list[str]:
    """Every model ID assigned in a template or shown in a usage example must be a current default.

    Catches the failure mode where a model bump updates models.py and some of the docs: the two
    parallel template sets per skill (skills/<s>/*.example and skills/<s>/scripts/*.example) plus
    four translated READMEs are easy to half-update.
    """
    current = set(policy.DEFAULT_MODELS.values())
    failures = []
    for path in paths if paths is not None else walk_text_files():
        relpath = rel(path)
        if relpath in LEGACY_ID_EXEMPT or "/workflow/" in relpath:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            match = TEMPLATE_MODEL_LINE.search(line)
            if not match:
                continue
            value = match.group("value")
            # Placeholders and env-var indirection are fine.
            if value.startswith(("$", "<", "{", "your")) or value in {"null", "PATH", "MODEL"}:
                continue
            if not MODEL_TOKEN.fullmatch(value):
                continue
            if value not in current:
                failures.append(
                    f"{relpath}:{lineno} configures model {value!r}, which is not a current "
                    f"default ({', '.join(sorted(current))}). Update it, or update "
                    f"DEFAULT_MODELS in workflow/models.py if the default really changed."
                )
    return failures


def check_policy_fixtures(policy) -> list[str]:
    failures = []
    for model in MUST_REJECT:
        if policy.legacy_reason(model) is None:
            failures.append(
                f"the deny-list no longer catches {model!r} — a pattern in models.py was "
                f"loosened too far"
            )
    for model in MUST_ACCEPT:
        reason = policy.legacy_reason(model)
        if reason is not None:
            failures.append(
                f"the deny-list falsely rejects {model!r} ({reason}) — a pattern in models.py "
                f"is too broad and would block a usable model"
            )
    try:
        policy.resolve_default_model("nonexistent-provider")
        failures.append("resolve_default_model() accepted an unknown provider instead of raising")
    except policy.ModelPolicyError:
        pass
    return failures


def check_python_compiles(paths: list[Path] | None = None) -> list[str]:
    """Syntax-check every skill module. In memory — py_compile writing .pyc files made this
    the slowest check by far, and no caller wants the bytecode."""
    failures = []
    if paths is None:
        paths = _walk(REPO / "skills", lambda p: p.suffix == ".py")
    for path in [p for p in paths if p.suffix == ".py"]:
        try:
            compile(path.read_text(encoding="utf-8"), str(path), "exec")
        except SyntaxError as exc:
            failures.append(f"{rel(path)}:{exc.lineno} does not compile: {exc.msg}")
        except (UnicodeDecodeError, OSError) as exc:
            failures.append(f"{rel(path)} is unreadable: {exc}")
    return failures


# =============================================================================
# Entry point
# =============================================================================

# Which checks an edited path can break. Used by --hook to stay cheap.
def relevant_checks(changed: str | None) -> list[str]:
    if changed is None:
        return ["shared", "legacy", "templates", "fixtures", "compile"]
    changed = changed.replace("\\", "/")
    if not changed.startswith("skills/") and "/skills/" not in changed:
        if changed.endswith(("README.md", "README.ja.md", "README.ko.md", "README.zh.md")):
            return ["legacy", "templates"]
        return []
    names = []
    if changed.endswith(tuple(f"/{module}" for module in SHARED_MODULES)):
        names.append("shared")
    if changed.endswith(".py"):
        names += ["compile", "legacy"]
        if changed.endswith("/models.py"):
            names.append("fixtures")
    if changed.endswith((".md", ".example", ".yaml", ".yml", ".json", ".txt")):
        names += ["legacy", "templates"]
    return names


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--hook", action="store_true",
                        help="read a Claude Code hook payload on stdin and check only what the "
                             "edited path can affect (exit 2 on failure)")
    args = parser.parse_args()

    changed: str | None = None
    if args.hook:
        # Escape hatch for a deliberate multi-file refactor, where intermediate states are
        # expected to violate the copy-identity invariant until the last file is written.
        if os.getenv("SKILLS_SKIP_INVARIANT_HOOK", "").strip().lower() in {"1", "true", "yes"}:
            return 0
        try:
            payload = json.load(sys.stdin)
        except (json.JSONDecodeError, ValueError):
            return 0
        raw = (payload.get("tool_input") or {}).get("file_path") or ""
        if not raw:
            return 0
        try:
            changed = Path(raw).resolve().relative_to(REPO).as_posix()
        except ValueError:
            return 0

    wanted = relevant_checks(changed)
    if not wanted:
        return 0

    failures: list[str] = []
    defaults = ""
    scope = [REPO / changed] if changed else None

    # Syntax first, and stop there if it fails: broken source makes every downstream message
    # noise, and the policy module itself may be the file that will not parse.
    if "compile" in wanted:
        failures = check_python_compiles(scope)

    if not failures:
        try:
            policy = load_policy()
        except Exception as exc:  # noqa: BLE001 - any failure here is a reportable invariant
            failures = [f"cannot load the model policy from workflow/models.py: {exc}"]
        else:
            defaults = ", ".join(f"{k}={v}" for k, v in policy.DEFAULT_MODELS.items())
            # In hook mode the per-file scans look only at the file that was just edited, so
            # the hook stays fast enough to fire on every write. The cross-file checks always
            # run in full — that is the whole point of them.
            runners = {
                "shared": check_shared_modules_identical,
                "legacy": lambda: check_no_legacy_ids(policy, scope),
                "templates": lambda: check_templates_match_defaults(policy, scope),
                "fixtures": lambda: check_policy_fixtures(policy),
            }
            for name in wanted:
                if name in runners:
                    failures.extend(runners[name]())

    if not failures:
        if not args.hook:
            print(f"OK: {len(wanted)} invariant group(s) hold ({', '.join(wanted)}); "
                  f"defaults = {defaults}")
        return 0

    stream = sys.stderr if args.hook else sys.stdout
    print(f"Repository invariants broken ({len(failures)}):", file=stream)
    for failure in failures:
        print(f"  - {failure}", file=stream)
    print("\nSee CLAUDE.md ('Invariants') for why each of these is enforced.", file=stream)
    return 2 if args.hook else 1


if __name__ == "__main__":
    sys.exit(main())
