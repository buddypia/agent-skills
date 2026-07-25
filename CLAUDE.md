# agent-skills

A collection of Claude Code skills. **Each directory under `skills/` is published and installed
on its own**, so there is no shared library: anything common between skills exists as a
*duplicated file*, and anything explained is a *restatement*. Both drift silently. The
invariants below exist because each one has already broken in this repo's history.

## Verify before committing

```bash
python3 tools/check_invariants.py     # stdlib only, no network, ~0.3s
```

Run it after any change under `skills/` or to a root `README*.md`. A Claude Code `PostToolUse`
hook runs the relevant subset automatically after each edit; set
`SKILLS_SKIP_INVARIANT_HOOK=1` to silence it during a deliberate multi-file refactor.

## Invariants

1. **Model IDs live in exactly one place per skill.**
   `skills/<skill>/scripts/workflow/models.py` → `DEFAULT_MODELS`. Role defaults, `--help` text
   and `--show-config` all derive from it. Never hardcode a model ID anywhere else in code.
2. **No file may name a retired or superseded model ID.** `models.py` refuses them at startup
   (every channel: `--<role>-model`, `<SKILL>_<ROLE>_MODEL`, `<PROVIDER>_MODEL_ID`,
   `config.yaml`, `MULTILLM_CLAUDE_MODEL` / `MULTILLM_CODEX_MODEL`, built-in default). Docs may
   describe a rejected *family* with a glob — `claude-3-*`, `gpt-4*` — but not a complete ID.
3. **`models.py` and `context_relay.py` are byte-identical across the three `multi-llm-*`
   skills.** Edit one, then copy it to the other two. (`providers.py` is *not* in this set:
   debate's mock payload legitimately carries an extra `context_digest` field.)
4. **Config templates come in two parallel sets per skill** — `skills/<skill>/config.example`
   + `env.example` and `skills/<skill>/scripts/config.yaml.example` + `.env.example`. A model
   bump or a new env var has to land in **both**. Their prose differs on purpose (the
   `scripts/` copies say "in this scripts/ directory"); only the configured values must agree.
5. **The deny-list must not block a future model.** A pattern that rejects tomorrow's ID is
   worse than one that misses yesterday's. `tools/check_invariants.py` asserts both directions
   against a fixture list.

## Layout

| Path | What it is |
|---|---|
| `skills/<skill>/SKILL.md` | Agent-facing trigger + procedure. Keep it lean; detail goes in `references/` |
| `skills/<skill>/README.md` | Human-facing docs (setup, env vars, troubleshooting) |
| `skills/multi-llm-*/scripts/` | Python entry point (`main.py`) + `workflow/` package |
| `skills/multi-llm-*/scripts/.venv/` | Per-skill venv created by `run.sh`. Never read or edit |
| `tools/` | Repo maintenance tooling. Not published with any skill |

## The multi-llm-* skills

Three near-identical pipelines that drive vendor CLIs (`agy`, `claude`, `codex`) over
`subprocess` under the user's own subscription login: `multi-llm-debate` (3 stages),
`multi-llm-reflection` (3), `multi-llm-recursive-meta-cognition` (5).

Test them **offline** with the `mock` provider — never assume a real vendor call happened
unless you actually made one, and say which you did:

```bash
cd skills/multi-llm-debate/scripts
.venv/bin/python main.py "topic" \
  --proponent-provider mock --opponent-provider mock --moderator-provider mock --json
.venv/bin/python main.py --show-config --fixed     # resolved providers/models, no calls
```

A real run is bounded by `MULTILLM_TOTAL_DEADLINE` (540s) to finish inside a typical 600s
agent/Bash ceiling; stages that run out return labeled partial output with `"degraded": true`
rather than being killed. See each skill's README for the full env-var table.

## Never commit

`config.yaml` / `config.json` / `.env` (gitignored — only the `*.example` templates are
tracked), `raw_output*.json`, anything under `.tmp/`.
