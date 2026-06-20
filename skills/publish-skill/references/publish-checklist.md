# Master publish checklist (long form)

The ordered, exhaustive sequence for publishing one skill. The SKILL.md procedure is the
condensed form of this list. Branch on archetype (A = script-type, B = pure-prompt).

1. Determine the archetype: shells out to `agy`/`claude`/`codex` (has `scripts/`) → A;
   host-agent in-context procedure → B.
2. Decide `skill-id` (= directory name = SKILL.md `name`): lowercase kebab-case. `multi-llm-`
   prefix for multi-vendor-LLM orchestration; no prefix for single-agent/procedural skills.
3. Write `SKILL.md`. frontmatter `name` (= dir) + `description` (what · when · trigger phrases).
   - (A) description part 3 = verbatim `Runs via subscription-authenticated CLIs; API keys are
     also supported.`; body = H1 Title Case + intro (verbatim tail) + `## Run` + `## Prerequisites & details` (verbatim tail).
   - (B) block-scalar description + `argument-hint` + `metadata` allowed.
4. Create `README.md` (required for BOTH archetypes).
   - (A) 11-section guide (see skill-archetypes.md).
   - (B) concise guide (What/How/When/Usage/References/License/Disclaimer).
   - Both: License line `Released under the MIT License — © 2026 buddypia. See [LICENSE](./LICENSE).`
     and **no NOTICE link**.
5. `cp <repo>/LICENSE skills/<id>/LICENSE` — byte-identical (1065 bytes). Verify with `cmp`.
6. (A only) Copy `scripts/` wholesale from the nearest `multi-llm-*` skill **including
   dotfiles** (`scripts/.env.example`!). Change run.* banner + pyproject name/description only.
7. (A only) Per stage: `workflow/<stage>.py`, `types.py` model + `<STAGE>_JSON_SCHEMA`,
   `assets/prompts/<stage>.txt`, `prompts.py` `_PROMPT_FILES`, `settings.py` env keys+defaults
   (UNIQUE prefix), `workflow.py` edges, `__init__.py` export.
8. (A only) Add a `_build_mock_payload()` branch in `providers.py` for every new `schema_name`.
9. (A only) `uv lock` → `uv export --frozen --no-hashes -o requirements.txt`. Create
   `config.example` (per-role + `global:`) and `env.example` (invariant keys + unique-prefix
   role stanzas) with CURRENT model ids; sync the README env table.
10. (B only) Put any read-only support in `references/`. Do NOT create config/env/scripts/assets.
    Do NOT add a `MANIFEST.json`.
11. Root `README.md` `## Skills`: add a row after the last data row —
    `` | [`<id>`](./skills/<id>) | <PATTERN_en> | <PROBLEM_en> | ``.
12. Root `README.md` `## Use cases`: add `- **<id>** — <use case_en>` (single em dash).
13. `README.ja.md`: same two sites. Translate Pattern role nouns / Problem / use case; keep
    capitalized stage names + column headers per glossary; bullet uses ` — `.
14. `README.ko.md`: same two sites; bullet ` — `.
15. `README.zh.md`: same two sites; bullet **` —— ` (double em dash)**.
16. Verify line parity: `wc -l` equal across the 4 READMEs; identical H2 lines/numbers; first
    column byte-identical; single trailing newline each. (See parity-check.md.)
17. (Only when adding a skill that breaks the old "multi-LLM only" framing) Generalize the root
    README positioning prose — intro (line ~5), `## Why these skills exist`, `## Requirements`,
    `## Install` ("self-contained directory with `SKILL.md`, `scripts/`, …"), `## Disclaimer` —
    across all four languages at equal line counts. Present prose changes for user review.
18. Final file-completeness check: A = exactly 7 root entries, no extras; B = SKILL.md +
    README.md + LICENSE (+ optional references/), no stubs.
19. (A only) Run the offline mock contract test: all roles `mock`, `main.py --no-config "test"`
    returns the new schema's JSON (not the generic `{message, prompt}` fallback).
20. `git add skills/<id> README.md README.ja.md README.ko.md README.zh.md` (+ any
    positioning-prose files).
21. `git status` — confirm no `.DS_Store` / `.env` / `config.yaml|json` / `*.log` /
    `raw_output*` slipped in. `*.example` IS tracked.
22. Commit with a descriptive message, e.g. `feat: add <id> skill and register in README (en/ja/ko/zh)`.
23. **Push only after explicit user approval.** Show `git show --stat HEAD` first; then
    `git push origin main` once approved.
24. (Optional) Verify the rendered tables/bullets on GitHub for all four READMEs.
