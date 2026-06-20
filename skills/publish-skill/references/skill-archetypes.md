# Skill archetypes — file manifests & build recipes

The `buddypia/agent-skills` repo has two skill archetypes. Determine which one you are
publishing first; nearly every file decision branches on it.

---

## Archetype A — script-type (external CLI orchestration)

Drives the vendor CLIs (`agy` / `claude` / `codex`) as subprocesses via a Python `uv`
project under `scripts/`. Examples: `multi-llm-debate`, `multi-llm-reflection`,
`multi-llm-recursive-meta-cognition`.

### Skill root — **exactly 7 entries** (no more, no less)

```
skills/<id>/
  SKILL.md          # 23–25 lines. frontmatter (name + description) + 4-block body
  README.md         # ~125–153 lines. 11-section install/usage guide
  LICENSE           # byte-identical copy of repo-root LICENSE (1065 bytes)
  config.example    # YAML template, copied to config.yaml by the user (runtime-external)
  env.example       # dotenv template, copied to .env (runtime-external)
  assets/prompts/   # one *.txt system prompt per role/stage (required for script-type)
  scripts/          # the full uv project (see below)
```

> `ls -1 skills/<id> | wc -l` must be **7**. (An earlier draft of this guide said 8 — wrong.)

### scripts/ contents — note the **two extra templates**

```
scripts/
  run.sh  run.ps1  run.cmd        # launchers; only the banner comment differs per skill
  main.py                          # argparse entrypoint
  pyproject.toml                   # change name + description only
  requirements.txt                 # AUTO-GENERATED — do not hand-edit
  uv.lock                          # AUTO-GENERATED
  config.yaml.example              # second config template (lives in scripts/)
  .env.example                     # second env template — a DOTFILE, tracked via !.env.example
  workflow/
    __init__.py   engine.py   config.py   raw.py   providers.py   settings.py
    prompts.py    types.py    workflow.py
    <stage>.py ...                 # one Executor per role/stage
```

**A script skill ships TWO config templates and TWO env templates**: the skill-root
`config.example` + `env.example`, AND `scripts/config.yaml.example` + `scripts/.env.example`.
`scripts/.env.example` is a dotfile — copying `scripts/` with a glob that ignores `.*` drops
it silently. Copy `scripts/` **wholesale, including dotfiles**.

### Shared infrastructure vs per-skill (when building a new script skill)

Copy the closest existing `multi-llm-*` skill's `scripts/` wholesale, then:

**Keep unchanged (shared infra — physically duplicated, no shared package):**
- `engine.py` (base `Executor`, `Workflow`, `WorkflowContext`, `WorkflowRunResult`, `handler`)
- `config.py` (`AgentConfig`), `raw.py` (`to_jsonable`, `extract_response_meta`)
- `providers.py` (the 3 CLI adapters) — **except** its `_build_mock_payload()` (see below)
- `run.sh` / `run.ps1` / `run.cmd` — change only the banner comment

**Edit per stage/role:**
1. `workflow/<stage>.py` — the Executor for that stage
2. `types.py` — a Pydantic model + a `<STAGE>_JSON_SCHEMA` constant
3. `assets/prompts/<stage>.txt` — the system prompt (end with: output JSON only · conform to
   schema · reply in the same language as the user input)
4. `prompts.py` — add the file to `_PROMPT_FILES`
5. `settings.py` — env keys + defaults (pick a UNIQUE prefix; see below)
6. `workflow.py` — wire the stage edges
7. `__init__.py` — export the new Executor
8. **`providers.py` `_build_mock_payload()` — add a branch for every new `schema_name`.**
   Without it, the offline mock test falls through to the generic `{message, prompt}` payload
   and "passes" without exercising the real schema.

**Then regenerate deps (never hand-edit):**
```bash
cd skills/<id>/scripts
uv lock
uv export --frozen --no-hashes -o requirements.txt
```

### Known repo debt to avoid copying

- **Env prefix reuse**: `multi-llm-debate` uses `DEBATE_`, but `multi-llm-recursive-meta-cognition`
  reuses `REFLECTION_` (not its own prefix). Mint a unique prefix for a new skill.
- **provider_strategy default differs**: debate = `shuffle` (+ `--shuffle/--random/--fixed`
  flags + a "Provider assignment strategy" README subsection); reflection & recursive =
  `fixed` (flags `--verbose | --json` only). Choose deliberately and keep SKILL.md /
  `env.example` / `config.example` consistent.
- **Stale model IDs**: some `config.example` files still cite `claude-opus-4-1-20250805` /
  `gpt-5.2`. Use current IDs: `gemini-3.5-flash`, `claude-opus-4-8`, `gpt-5.5`.
- **README title/heading drift**: debate/reflection say "Installation & Usage Guide";
  recursive says "Setup & Usage Guide" / "## Setup". Prefer the "Installation" wording.

### SKILL.md body (script-type, 4 blocks)
1. `# <Title Case Name>` (e.g. `# Multi-LLM Debate`)
2. Intro paragraph ending verbatim: `Each CLI runs under your existing login; API keys are
   also supported. See the Disclaimer in the README before use.`
3. `## Run` — bash block with `# macOS / Linux` comment, `<skill-dir>/scripts/run.sh "..."`,
   a Windows line, and a `# Flags:` line. (Add a runtime blockquote after `## Run` only if slow.)
4. `## Prerequisites & details` ending verbatim: ``command -v agy claude codex`` must resolve
   all three … → see [README.md](./README.md). Offline contract test (no CLI/network): the
   `mock` provider.

### README.md (script-type) — 11-section skeleton, fixed order
1. `# <Name> — Installation & Usage Guide` + 1–2 line summary + `For the skill definition
   (invocation summary), see [SKILL.md](./SKILL.md)`
2. `## How it works` — ASCII pipeline (`[input] → Role(action) → … → output`; provider/model under each)
3. `## Installation` — `### 1. CLI Backends` table + `command -v agy claude codex`; `### 2.
   Python dependencies` (uv-recommended + the "`requirements.txt` is derived from `uv.lock`,
   do not edit" blockquote)
4. `## Usage` — run.sh examples + `--verbose`/`--json` + Windows note + model-override `uv run`
5. `## Environment variables` — Variable | Default | Purpose table
6. `## Offline contract test (mock — no CLI/network required)`
7. `## Troubleshooting` — Symptom | Resolution table
8. `## Architecture (summary)`
9. `## References & Attribution` — invariant disclaimer + pattern provenance + arXiv citations
10. `## License` — `Released under the MIT License — © 2026 buddypia. See [LICENSE](./LICENSE).`
    + bundled-deps paragraph
11. `## Disclaimer` — 5 invariant bullets: Third-party CLIs & terms / No affiliation / Model
    names / No quality guarantee / Untrusted output & prompt injection

`config.example` = per-role blocks + a `global:` block (`provider_strategy`, `temperature`).
`env.example` = invariant keys (`GEMINI_API_KEY=` / `ANTHROPIC_API_KEY=` / `OPENAI_API_KEY=` /
`OPENAI_BASE_URL=` / `*_MODEL_ID=`) + per-role stanzas under the unique prefix. Keep the README
env table and `env.example` in sync.

---

## Archetype B — pure-prompt (procedural, no external execution)

The host agent (Claude) runs the procedure in its own context. No subprocess, no CLIs.
Examples: `reflect`, `publish-skill` (this skill).

### Skill root
```
skills/<id>/
  SKILL.md          # the procedure itself (the SSOT). Can be long.
  README.md         # REQUIRED. Concise guide (see below).
  LICENSE           # byte-identical copy of repo-root LICENSE.
  references/        # OPTIONAL read-only supporting material (progressive disclosure).
```

**N/A — never create for parity:** `config.example`, `env.example`, `scripts/`,
`assets/prompts/`. They are CLI-orchestration artifacts with no analog here. Empty stubs are
a smell, not parity.

**No `MANIFEST.json`.** A machine-readable sidecar is a non-convention extra (only the early
`reflect` draft had one); it duplicates SKILL.md and drifts. The repo standard is **SKILL.md
as the single SSOT**.

### README.md (pure-prompt) — concise, no CLI machinery
Keep it real and short. Suggested sections:
1. `# <Name> — <subtitle>` + 1–2 line summary + `For the skill definition, see [SKILL.md](./SKILL.md)`
2. `## What it does` / `## How it works` — the procedure at a glance (steps/loops)
3. `## When to use` — triggers and when NOT to use
4. `## Usage` — how it is invoked (slash command / trigger phrases / argument hint)
5. `## References & Attribution` — citations if the design draws on prior work (carry these
   out of any `references/*.md` into this section)
6. `## License` — `Released under the MIT License — © 2026 buddypia. See [LICENSE](./LICENSE).`
7. `## Disclaimer` — only the bullets that actually apply (a pure-prompt skill drives no
   third-party CLIs, so the CLI-ToS bullet is usually N/A; keep "No quality guarantee" and
   "Untrusted output & prompt injection" if relevant)

**Do NOT** link `NOTICE` from a skill README — only the root README links it.

### SKILL.md frontmatter (pure-prompt)
`name` = directory name. `description` = what it does · when to use · quoted trigger phrases.
Block-scalar `description`, `argument-hint`, and `metadata` (e.g. `version`) keys are the
newer, permitted convention used by `reflect` and this skill.
