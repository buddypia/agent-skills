# 7 Mechanisms — detailed reference

Consult after ROUTE has picked a mechanism, when you need the precise definition, load behavior, and syntax. Sources: the official [Steering Claude Code](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more) blog and the official docs ([skills](https://code.claude.com/docs/en/skills), [memory](https://code.claude.com/docs/en/memory), [hooks](https://code.claude.com/docs/en/hooks), [sub-agents](https://code.claude.com/docs/en/sub-agents)).

What each mechanism controls is three things: **(1) when it loads into context / (2) whether it survives a long session (compaction) / (3) how much authority (instruction-following weight) it carries.**

---

## 1. CLAUDE.md

**What it is**: a markdown file at the project root. Loaded at session start and stays for the whole session.

**Two kinds**:
- **Always (root `CLAUDE.md`)**: all loaded at start, re-read after compaction (memoized).
- **On-demand (subdirectory `CLAUDE.md`)**: loaded when Claude reads a file under that directory. Lost from context until that directory is touched again. In a monorepo, putting one in each team's directory means only that team's conventions load.

**Put here**: build commands, directory layout, monorepo structure, code conventions, team norms. Think of it as "giving Claude an overview of the codebase / an index pointing to other files".

**Placement**:
- `~/.claude/CLAUDE.md` — shared across all projects (personal)
- `<repo>/CLAUDE.md` — team-shared (git committed)
- `<repo>/CLAUDE.local.md` — personal (`.gitignore`)
- import: `@path/to/file` to pull in another file

**Rules**:
- Keep it **under 200 lines**, give it an owner, review changes like code (this blog's bar).
- Ask each line **"Would removing this cause Claude to make mistakes?"** — if NO, delete it.
- Shared-repo anti-pattern: every team keeps appending and nobody deletes → irrelevant lines load into every engineer's every session and compound at scale. Fix: push team-specific to **path-scoped rules**, procedures to **skills**.

**Emphasis**: add `IMPORTANT` / `YOU MUST` to lines you especially need followed. But if every line has it, it stops working.

---

## 2. Rules (`.claude/rules/`)

**What it is**: markdown in `.claude/rules/` giving specific constraints/conventions.

**Two kinds**:
- **unscoped**: always loaded at start, re-injected on compaction → **mechanically identical to putting it in CLAUDE.md** (always billed). Costs tokens even during unrelated work.
- **path-scoped**: add a `paths:` frontmatter; loads only when a matching file is touched.

**Syntax**:
```markdown
---
paths:
  - "src/api/**"
  - "**/*.handler.ts"
---
All API handlers must validate input with Zod before processing.
```

**When to use**: file-specific constraints (e.g. "migrations are append-only"). For a **cross-cutting concern that appears in several (but not all) corners** of the codebase, prefer a path-scoped rule over a nested CLAUDE.md. `paths:` uses the same glob format as path-specific rules, and the same as a skill's `paths:` frontmatter.

---

## 3. Skills (`.claude/skills/`)

**What it is**: a folder centered on `SKILL.md` (name + description + body), optionally with scripts/references/assets. Fires via manual invoke (`/skill-name`) or auto-matching a task.

**Load behavior**:
- At start only the **name + description** load into context (the skill-listing budget is ≈1% of the context window; `description` + `when_to_use` are truncated at 1,536 chars).
- The body loads **on invoke** as a single message and then stays for the rest of the session (it is not re-read every turn → write it as standing instructions that apply throughout, not one-time steps).
- **Compaction**: the most recent invocation of each skill is re-attached after the summary, keeping the **first 5,000 tokens** each (a head-truncation, not a summary), within a **combined 25,000-token** budget. The budget fills from the most recently invoked skill, so older skills can be dropped entirely if you invoked many in one session.

**When to use**: anything procedural — deploy workflows, release checklists, review processes. **Put it in a skill, not CLAUDE.md.**

**Key frontmatter** (`code.claude.com/docs/en/skills`):
| field | purpose |
|-------|---------|
| `description` | **what it does + when to use it**. The key to triggering. Under-triggering is the real-world problem, so include concrete examples and be slightly pushy. Put the key use case first (1,536-char cap) |
| `when_to_use` | trigger phrases / examples. Appended to `description` and counts toward the same cap |
| `disable-model-invocation: true` | block auto-firing; manual `/name` only. Required for skills **with side effects** (deploy/commit/PR creation) |
| `user-invocable: false` | hide from the `/` menu. For background knowledge only Claude uses |
| `allowed-tools` | tools usable without prompting while active, e.g. `Bash(git add *) Bash(git commit *)` |
| `disallowed-tools` | tools removed from the pool while active (e.g. ban `AskUserQuestion` in a background loop) |
| `model` / `effort` | override model / effort while active |
| `context: fork` (+ `agent:`) | run isolated in a subagent. The skill body becomes the prompt; conversation history is not visible |
| `paths:` | auto-load only when touching matching files |

**Structure (progressive disclosure)**:
```
skill-name/
├── SKILL.md      # required. Body under 500 lines, concise, "what to do"
├── references/   # detailed docs read only when needed
├── scripts/      # executables that are run (not loaded)
└── assets/       # templates / materials
```
Reference each supporting file from SKILL.md, stating **what it contains and when to read it**.

**Dynamic context injection**: `` !`command` `` inlines a command's output before Claude sees the skill (e.g. `` !`git diff HEAD` ``). For multi-line use a ` ```! ` fenced block.

---

## 4. Subagents (`.claude/agents/`)

**What it is**: `.claude/agents/<name>.md` — YAML frontmatter (name, description, optional model / tools) + a system-prompt body defining an isolated assistant.

**The decisive difference from skills — isolation**:
- At start only the name + description + tool list load (like a skill, the body does not auto-invoke).
- **The body's instructional context never enters the parent conversation at all.** The subagent runs in a fresh, separate context window, and **only the final message (often the aggregated result of many subtasks) + metadata** return to the parent.

**Scale**: subagents nest up to **5 levels** deep. Dynamic workflows orchestrate tens to hundreds of background agents without your specifying each one's detail (the orchestration plan and intermediate results live in script variables, not Claude's context → scale without losing fidelity).

**Subagent vs skill — which**:
- A side task like deep search / log analysis / a dependency audit whose **intermediate results you won't reference again** and don't want cluttering the main thread → **subagent**.
- A procedure you want to **watch and steer step by step in the main thread** → **skill**.

**Syntax**:
```markdown
---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools: Read, Grep, Glob, Bash
model: opus
---
You are a senior security engineer. Review code for:
- Injection vulnerabilities (SQL, XSS, command injection)
- Authentication and authorization flaws
- Secrets or credentials in code
Provide specific line references and suggested fixes.
```

**Design**: keep `tools` minimal (drop Edit/Write if read-only). Claude may not delegate automatically, so prompt the user to explicitly **"use a subagent"**. Writer/Reviewer separation avoids bias.

---

## 5. Hooks (`settings.json` etc.)

**What it is**: user-defined commands / HTTP endpoints / LLM prompts that fire on specific lifecycle events. They provide **deterministic control**.

**Types**:
- Deterministic: `command` / `http` / `mcp_tool` — the harness runs the handler.
- Judgment-using: `prompt` / `agent` — model calls in separate windows.

**Registered in**: `settings.json` / managed policy settings / a skill's or agent's frontmatter.

**Why context cost is low**: the config/instruction lives **outside the main context window**. It is "code the harness runs", not "an instruction loaded into Claude".
They **bypass compaction entirely**. Output is generally not saved to the main context, with one exception: a **blocking hook's stderr** is saved so Claude knows why the call was denied (nothing else is saved unless the config explicitly returns it).

**When to use**: things that must happen deterministically — a linter after edits, a Slack post on completion, blocking a specific command. A `PreToolUse` hook can inspect any tool call and **exit code 2 to deny** it.

**The strongest guardrail = managed settings**: admin-deployed, cannot be overridden by a user's local config. The **only way to enforce a deterministic org-wide guardrail**.

**Design notes**:
- **Default to fail-open**: a validation hook that breaks and blocks every edit is the worst case. Fall back to the safe side (passthrough).
- **Scope it down**: use a matcher to limit the target tool/command (Edit only, a specific Bash only).
- **Escape hatch**: allow an env-var bypass for emergencies.
- It's fine to have Claude write it ("write a hook that runs eslint after each edit"). Use `/hooks` to list them.

---

## 6. Output Styles (`.claude/output-styles/`)

**What it is**: a file that injects instructions into the system prompt.

**Load / compaction**: loaded at the start of every session, **never compacted**, cached after the first request.

**Authority**: because it sits in the system prompt, it carries the **highest instruction-following weight** of any mechanism here. So use it judiciously.

**Critical warning**: changing the output style **replaces the default output style** (unless you set `keep-coding-instructions: true` in the frontmatter). In Claude Code this **removes** the role instruction that it is helping with software engineering, plus other critical defaults:
- how to scope changes
- when to add / omit comments
- how to handle security concerns
- verification habits like running tests before declaring work complete

**When to use**: only large role changes (code assistant → general assistant). Before writing one, check the **built-in styles** — **Proactive** (autonomy) / **Explanatory** (teaching) / **Learning** (collaborative). Most common needs are covered there without maintaining a style file.

---

## 7. Append System Prompt (`--append-system-prompt`)

**What it is**: a startup CLI flag that **appends** to the system prompt.

**Difference from output styles**: changing an output style file can cause large, unintended behavior changes, whereas the append flag is **purely additive** — it doesn't change the role, it adds instructions to the default role. It is passed at invocation time and applies to **that invocation only** (not persisted as a file).

**Context cost**: it increases input tokens, so it can be higher than other methods. Prompt caching reduces the cost after the first request.

**When to use**: adding specific coding standards, output formatting, or domain knowledge. **Mind the diminishing returns** — the more instructions you add this way, the less strictly Claude follows them.

---

## Quick lookup (where do I put it?)

| What you want | Mechanism |
|---------------|-----------|
| A short, always-on, immutable rule/fact for every session | CLAUDE.md (each line passes "Would removing...") |
| A convention specific to a subdirectory | subdir CLAUDE.md |
| A constraint for a set of files / a cross-cutting concern | path-scoped rule |
| A procedure / checklist / runbook | skill |
| An isolated task / investigation whose intermediate results you want quarantined | subagent |
| Must run every time / must be blocked | hook (managed settings for org-wide enforcement) |
| A change to the role itself | output style (check built-ins first) |
| A light addition of tone / formatting / knowledge (for that invocation only) | append-system-prompt |
| Distributing skills + subagents + hooks + MCP as a set | plugin |
| Reading/writing an external service (DB/Notion/Figma/monitoring) | MCP server (`claude mcp add`) |
| Leveraging a specific CLI tool | CLI tool + permissions allowlist |
