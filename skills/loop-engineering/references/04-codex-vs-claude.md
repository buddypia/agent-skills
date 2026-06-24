# Primitive-by-primitive mapping — Codex ↔ Claude Code

Both tools implement the same loop shape. A connector/skill written for one usually works in the other (both speak MCP, both use the `SKILL.md` format). Use this when the user is on either tool, or moving between them.

| Primitive | Job in the loop | Codex app | Claude Code |
|-----------|-----------------|-----------|-------------|
| **Automations** | discovery + triage on a schedule | **Automations tab**: pick project, prompt, cadence, environment; results land in a **Triage inbox**; `/goal` for run-until-done | **Scheduled tasks & cron**, **`/loop`**, **`/goal`**, **hooks**, GitHub Actions |
| **Worktrees** | isolate parallel features | **Built-in worktree per thread** | `git worktree`, **`--worktree`**, **`isolation: worktree`** on a subagent |
| **Skills** | codify project knowledge | **Agent Skills** (`SKILL.md`), invoked with `$name` or implicitly | **Agent Skills** (`SKILL.md`) |
| **Plugins / connectors** | connect your tools | **Connectors (MCP)** + plugins for distribution | **MCP servers** + plugins |
| **Sub-agents** | ideate and verify | **Subagents** defined as **TOML in `.codex/agents/`** | **Task subagents** in **`.claude/agents/`**, agent teams |
| **State** | track what's done | **Markdown** or **Linear via a connector** | **Markdown** (`AGENTS.md`, progress files) or **Linear via MCP** |

---

## Claude Code specifics (most relevant here)

- **`/loop <cadence> <task>`** — session-scoped cadence. Re-runs regardless of state.
- **`/goal <condition>`** — runs until a written condition is *actually true*, checked by a **separate small model** (maker ≠ checker). Survives intermediate "completions."
- **Composed:** `/loop 30m /goal All tests in test/auth pass and lint is clean. Scan src/auth …, open draft PR when goal holds.` → schedules a cron, with a checker-verified stop condition.
- **Desktop scheduled tasks** — survive restarts. **Routines** — run with the laptop off (cloud). **Hooks** — lifecycle events (e.g. lint-on-PR-open).
- **Sub-agents** — `.claude/agents/`, `isolation: worktree` for parallel-safe helpers, agent teams that pass work between them.
- **State** — `STATE.md` / `AGENTS.md` in-repo, or Linear/GitHub Issues via MCP.

## Codex specifics

- **Automations tab** — project + prompt + cadence + (local checkout | background worktree). Found-something → **Triage inbox**; found-nothing → self-archives.
- **Worktrees** — built in per thread; many threads hit one repo without colliding.
- **Sub-agents** — TOML in `.codex/agents/`: name, description, instructions, optional **model + reasoning effort** (strong-model reviewer on high effort; fast read-only explorer).
- **Connectors** — MCP, plus plugins for distribution.

---

## Practical default for this skill

When building in Claude Code (the common case here):
1. **One skill** → `.claude/skills/<loop-name>/SKILL.md`
2. **One state file** → `STATE.md` at repo root (or `.claude/STATE.md`), plus `VISION.md`/`AGENTS.md` for long runs
3. **One gate** → the project's existing test/build/lint command, wired so a non-zero exit fails the run
4. **One automation** → `/loop … /goal …`, escalated to a Desktop scheduled task / Routine once proven
5. **Maker/checker** → a verifier in `.claude/agents/`, ideally a different model, never exposed to the maker's reasoning
6. **Parallelism** → `isolation: worktree` on helpers only once more than one agent runs at a time
