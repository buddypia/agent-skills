---
name: publish-skill
description: |
  Publish a new or changed skill to the buddypia/agent-skills repo in one pass — detect the skill's archetype, complete its required files (README.md, LICENSE, and for script-type skills the full scripts/ + assets/ + config/env templates), register it in all four root READMEs (en/ja/ko/zh) with line-count parity and correct translations, verify parity, then stage and commit. Use when the user adds a skill under skills/ and asks to "publish", "release", "register in the README", "add the skill to the repo", "公開", "リリース", "READMEに登録", or after a new skills/<id>/ directory appears untracked in git. Push is gated on explicit user approval.
argument-hint: "[skill-id (optional; defaults to the untracked/changed skill under skills/)]"
metadata:
  version: "1.0"
  repo: buddypia/agent-skills
---

# Publish-Skill — One-Pass Skill Publishing for agent-skills

> **Core idea**: Publishing is NOT "git push". It is **(1) completing the skill's files for its archetype** and **(2) synchronizing the four root READMEs at exact line-count parity** — git is the last, smallest step. Get the archetype and the parity right and the rest follows.
>
> This `SKILL.md` is the SSOT execution procedure. Detailed lookup tables live in `references/` (read them at the steps that point to them). On any conflict, this file wins.

This skill is **repo-specific tooling** for `buddypia/agent-skills`. It encodes that repo's verified conventions. If the repo's conventions change, update this skill (it is itself an archetype-B skill — see below).

The repo has **two skill archetypes**; almost every decision branches on which one you are publishing:

| | **Archetype A — script-type** | **Archetype B — pure-prompt** |
|---|---|---|
| What it is | Drives external vendor CLIs (`agy`/`claude`/`codex`) via `scripts/` | The host agent runs the procedure in-context; no subprocess |
| Examples | `multi-llm-debate`, `multi-llm-reflection`, `multi-llm-recursive-meta-cognition` | `reflect`, `publish-skill` (this one) |
| Detection | `skills/<id>/scripts/` exists (or the skill must shell out) | no `scripts/`, no external execution |
| Root entries | **exactly 7**: `SKILL.md README.md LICENSE config.example env.example assets/ scripts/` | `SKILL.md README.md LICENSE` (+ optional `references/`) |
| `README.md` & `LICENSE` | required | **required (archetype-independent)** |
| `config.example`/`env.example`/`scripts/`/`assets/` | required | **N/A — never create empty stubs** |

---

## Execution protocol (required)

### Pre-flight checklist (before running)

Copy this checklist into your response and check off items as you complete them:

- [ ] 1. Target skill identified — the new/changed `skills/<id>/`. Run `git status --porcelain skills/` and `git -C <repo> status`. If an argument names a skill, use it; else take the untracked/changed skill under `skills/`.
- [ ] 2. Archetype determined (A script-type vs B pure-prompt) — see the table above; decide by whether the skill shells out / has `scripts/`.
- [ ] 3. `skill-id` validated — lowercase kebab-case, equals the directory name AND the SKILL.md frontmatter `name`. Family decision: orchestration-of-multiple-vendor-LLMs → `multi-llm-` prefix; single-agent/procedural → no prefix.
- [ ] 4. Working tree is clean except for the skill being published (no unrelated staged changes that would ride along in the commit).

→ Proceed only when all checked. Any unchecked → stop + report why.

### Post-flight checklist (after running)

Copy this checklist into your response and check off items as you complete them:

- [ ] 1. Skill root files complete for the archetype (A = the 7 entries, no extras; B = SKILL.md+README.md+LICENSE [+references]; **no empty stubs**).
- [ ] 2. `LICENSE` is **byte-identical** to the repo-root `LICENSE` (copied, not rewritten) — verify with `cmp`.
- [ ] 3. `README.md` present and follows the archetype skeleton (A = 11-section guide; B = concise guide). Carries License + Disclaimer + References & Attribution; **does NOT link `NOTICE`** (per-skill convention).
- [ ] 4. All **four** root READMEs updated in both sites (Skills table row + Use cases bullet); en/ja/ko use ` — `, zh uses ` —— `.
- [ ] 5. Parity verified (blocking): `wc -l` equal across the 4 READMEs; identical H2 set at identical line numbers; first table column byte-identical across languages; single trailing newline each. See `references/parity-check.md`.
- [ ] 6. (Archetype A) Offline mock contract test passes for the new schema(s) — all roles `mock`, `main.py --no-config "test"` returns the new JSON (not the generic fallback).
- [ ] 7. No secrets/runtime artifacts staged (`.DS_Store`, `.env`, `config.yaml/json`, `*.log`, `raw_output*.json`); `*.example` IS tracked.
- [ ] 8. Committed with a descriptive message. **Push only after explicit user approval** (show `git diff --stat` / `git show --stat HEAD` first).

→ All checked → report done with the commit hash. Any unchecked → fix and re-verify.

---

## The procedure in detail

### Step 0 — Identify target & archetype
`git -C <repo> status --porcelain` to find the untracked/changed `skills/<id>/`. Read its `SKILL.md`. Decide archetype (A/B). If ambiguous (a procedural skill that *could* shell out), default to the simplest archetype that works — B unless it genuinely needs `scripts/`. Read `references/skill-archetypes.md` now.

### Step 1 — Complete the skill files (archetype-driven)

**Both archetypes:**
- `LICENSE` — `cp <repo>/LICENSE skills/<id>/LICENSE` (byte-identical, 1065 bytes, MIT © 2026 buddypia). **Never retype it.**
- `README.md` — must exist. Generate from the archetype skeleton, then have the user review generated prose. License section reads `Released under the MIT License — © 2026 buddypia. See [LICENSE](./LICENSE).` and links **only** LICENSE (not NOTICE). Include a `## References & Attribution` section if the skill's design draws on prior work (move/copy citations out of any `references/*.md` into the README section).
- `SKILL.md` frontmatter — `name` must equal the directory name. `description` follows the repo style (what it does · when to use · trigger phrases). Block-scalar `description`, `argument-hint`, and `metadata` keys are permitted (newer convention; `reflect`/this skill use them).

**Archetype A only** (read `references/skill-archetypes.md` for the full build recipe):
- Copy `scripts/` wholesale from the closest existing `multi-llm-*` skill, INCLUDING dotfiles — **`scripts/.env.example` is a tracked dotfile and is easily dropped by a glob that ignores `.*`**. A script skill ships **two** config/env pairs: skill-root `config.example`+`env.example` AND `scripts/config.yaml.example`+`scripts/.env.example`.
- Per stage/role add: `workflow/<stage>.py` (Executor), Pydantic model + `<STAGE>_JSON_SCHEMA` in `types.py`, `assets/prompts/<stage>.txt`, the `_PROMPT_FILES` entry in `prompts.py`, env keys/defaults in `settings.py`, edges in `workflow.py`, and the export in `__init__.py`.
- **Add a branch for each new `schema_name` in `providers.py`'s `_build_mock_payload()`** — omitting it silently falls through to the generic `{message, prompt}` mock and the offline test passes vacuously.
- Keep the shared base modules unchanged: `engine.py`, `config.py`, `raw.py`, `providers.py` (except the mock branches), `run.sh`/`run.ps1`/`run.cmd` (only the banner comment changes).
- Choose a **unique** env prefix (e.g. `DEBATE_`) — note the existing repo debt: `recursive-meta-cognition` reuses `REFLECTION_`. Do not propagate that mistake.
- Pick `provider_strategy` default deliberately (`shuffle` like debate, or `fixed` like the others) and keep SKILL.md flags, `env.example`, and `config.example` consistent.
- Use **current** model IDs (`gemini-3.5-flash`, `claude-opus-4-8`, `gpt-5.5`) in `config.example` — older skills shipped stale IDs (`claude-opus-4-1-…`, `gpt-5.2`); do not copy those.
- Regenerate deps: `uv export --frozen --no-hashes -o requirements.txt` (never hand-edit `requirements.txt`/`uv.lock`).

**Archetype B only:**
- `references/` may hold read-only supporting material (load-bearing, keep). **Do NOT** create `config.example`/`env.example`/`scripts/`/`assets/` for parity — they are N/A.
- Do not add a `MANIFEST.json` (non-convention sidecar; the repo standard is SKILL.md as the only SSOT).

### Step 2 — Register in the four root READMEs (the core, most error-prone step)
Read `references/translation-glossary.md` first. Each skill appears in **two sites per file**, and **all four files must change together at equal line counts**.

> **Intentionally-unlisted skills**: repo-maintenance / internal-tooling skills may be
> deliberately omitted from the user-facing catalog (the `## Skills` table + `## Use cases`),
> because users who `npx skills add` this repo have no use for them. Currently unlisted:
> **`publish-skill`** (this skill). Do not "fix" their absence — they live in `skills/` and
> ship `SKILL.md`+`README.md`+`LICENSE`, but are not registered in the root READMEs by design.

- **Site A — `## Skills` table**: insert one row immediately after the last data row. First column is byte-identical in all four languages: `` | [`<id>`](./skills/<id>) | <PATTERN> | <PROBLEM> | ``. Translate the Pattern's generic role nouns but keep capitalized stage names (e.g. `Generator → Critic → Refiner`) in English; translate the Problem cell per language. Column headers: `Pattern`→`パターン`/`패턴`/`模式`, `Problem it addresses`→`解決する課題`/`해결하는 문제`/`解决的问题` (already present — do not re-add).
- **Site B — `## Use cases`**: insert one bullet after the last. `- **<id>** — <use case>` for en/ja/ko; **`- **<id>** —— <use case>` for zh (double em dash — Chinese typography; the single most-forgotten detail).
- All `## H2` headers stay **in English** in every language — never translate or "fix" them.
- Match each language's quote style in new prose: en `"…"`, ja `「…」`, ko `"…"`, zh `"…"` (full-width).
- Keep language-neutral tokens byte-identical across files: skill ids, CLI/brand names, model ids, paths, file names, links, `References & Attribution`, the install bash block.

### Step 3 — Reconcile repo positioning (when archetype/theme broadens)
The root READMEs were originally framed as "multi-LLM cross-vendor" only. The repo is now a **general agent-skills collection**. When publishing a skill that does not fit the old framing (e.g. a single-agent pure-prompt skill), check the summary prose — intro (line ~5), `## Why these skills exist`, `## Requirements`, `## Install` ("self-contained directory with `SKILL.md`, `scripts/`, and its own `README.md`"), `## Disclaimer` — and generalize it across all four languages at equal line counts so it no longer claims every skill is multi-LLM/CLI-driven. Present prose changes for user review before committing.

### Step 4 — Verify parity (blocking)
Run the checks in `references/parity-check.md`. If any fail, stop and fix before git.

### Step 5 — git (commit auto · push approval-gated)
- `git -C <repo> add skills/<id> README.md README.ja.md README.ko.md README.zh.md` (plus any positioning-prose files touched).
- Confirm no ignored/secret files slipped in (`git status`, check against `.gitignore`).
- Commit with a descriptive message in the repo's style, e.g. `feat: add <id> skill and register in README (en/ja/ko/zh)`.
- Show `git show --stat HEAD`. **Do not `git push` until the user explicitly approves.**

---

## Traps (verified, easy to miss)

| Trap | Why it bites | Guard |
|---|---|---|
| zh Use-cases bullet uses ` —— ` (double em dash) | en/ja/ko use single ` — `; copying the en bullet to zh looks right but breaks convention | parity-check greps for it |
| `scripts/.env.example` dropped | it is a dotfile; globbing `scripts/*` or filtering `.*` skips it | copy `scripts/` wholesale incl. dotfiles |
| Two config/env pairs per script skill | skill-root pair AND `scripts/` pair both exist | verify both present |
| `_build_mock_payload()` not branched | new schema falls through to generic mock; offline test passes vacuously | add a branch per new `schema_name` |
| LICENSE rewritten instead of copied | text drifts from the byte-identical repo standard | `cp` + `cmp` |
| NOTICE link added to a skill README | only the **root** README links NOTICE; skill READMEs link LICENSE only | follow the skeleton |
| H2 headers translated | all headers stay English across languages | leave them |
| Line-count parity broken | the 4 READMEs are line-number isomorphic; uneven edits desync them | `wc -l` must match |
| Empty stubs for N/A files | a pure-prompt skill must not carry `config.example`/`scripts/` | archetype B = no stubs |
| Stale model IDs copied into config.example | older skills shipped `gpt-5.2`/`claude-opus-4-1-…` | use current IDs |

---

## References

- `references/skill-archetypes.md` — full file manifest + build recipe for each archetype (read at Step 0/1)
- `references/translation-glossary.md` — en/ja/ko/zh term table + translate/don't-translate rules + em-dash/quote rules (read at Step 2)
- `references/parity-check.md` — the blocking verification commands (read at Step 4)
- `references/publish-checklist.md` — the full ordered master checklist (the long form of the procedure above)
