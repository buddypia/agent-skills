---
name: claude-code-steering
description: |
  Route and audit how Claude Code is steered. Claude Code has 7 mechanisms that control its behavior (CLAUDE.md / rules / skills / subagents / hooks / output styles / append-system-prompt); the right home for any instruction is decided by 4 axes — when it loads, whether it survives compaction, its context cost, and its authority (instruction-following weight). Use this skill whenever — (1) ROUTE: someone asks "where should this instruction live?" (CLAUDE.md vs rule vs skill vs hook vs subagent vs output style), or wants to make some behavior permanent; (2) AUDIT: you want to SCAN an existing project's config (CLAUDE.md / .claude/rules / .claude/skills / .claude/agents / .claude/output-styles / settings.json) and refactor it to match the official docs; (3) symptoms of a misplaced instruction — "CLAUDE.md has bloated", "Claude ignores a rule / CLAUDE.md", "make X run every time (linter/Slack)", "never let Claude do X (a guardrail)", "context feels heavy". Trigger even without the word "steering" — also on phrasings like "where should this go", "clean up my CLAUDE.md", "audit my .claude", and their Japanese equivalents (どこに書く / CLAUDE.md を整理 / steering). Source: Anthropic's "Steering Claude Code" blog (https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more).
---

# Claude Code Steering

Claude Code has **7 mechanisms** for controlling its behavior. The same instruction behaves very differently depending on *where you put it*: **when it loads into context, whether it survives compaction, how many tokens it keeps costing, and how strongly it gets followed**. This skill takes the decision model from the official [Steering Claude Code](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more) blog, applies it to the user's concrete situation to **route an instruction to the right mechanism**, and **audits/refactors existing config that is in the wrong place**.

> Core idea: **every instruction has a home.** The home is chosen not by topic but by the 4 axes below (load timing / compaction / context cost / authority) and by one question — "does this need to be deterministic?"

## When to Use This Skill

Fire proactively in the following situations, even when not invoked explicitly.

| Mode | Trigger | What it does |
|------|---------|--------------|
| **ROUTE** | "Where should this instruction / rule / procedure go?", "Should this be in CLAUDE.md or a hook?", or any request to make a behavior permanent | Pick the single right mechanism via the 4 axes + anti-pattern checks, and give the location and a minimal implementation |
| **AUDIT** | "Tidy up my `.claude`", "CLAUDE.md is long / gets ignored", "review it against the official docs" — any request to inspect existing config | SCAN the project, detect misplacements → present a refactor plan as a table (see `references/audit-playbook.md`) |

**Do NOT fire when**: the task is ordinary code implementation, bug fixing, or investigation itself — those are not about steering mechanisms. General *work-flow* questions (explore→plan→implement, `/clear` strategy, session operation) belong to the sibling skill `claude-code-best-practices`. This skill specializes in *where an instruction lives*; mechanism selection/placement is this skill's domain, and when it overlaps with `claude-code-best-practices` "Mode C", route lightweight selection to the sibling skill, and **keep the 4-axis routing and config audits here**.

---

## The 7 Mechanisms — the 4-axis decision table

Each mechanism mapped along the blog's core table: the 4 axes + primary use. **This table is the heart of ROUTE.**

| Mechanism | When loaded | After compaction | Context cost | Authority | Primary use |
|-----------|-------------|------------------|--------------|-----------|-------------|
| **CLAUDE.md (root)** | Session start; stays the whole session | Memoized, re-read after compaction | **High** | Medium | Build commands, directory layout, monorepo structure, code conventions, team norms |
| **CLAUDE.md (subdir)** | When Claude touches a file in that subdirectory | Lost until touched again | Low | Medium | Conventions specific to a subdirectory |
| **Rules** (`.claude/rules/`) | Session start (unscoped) / when a matching file is touched (path-scoped) | Re-injected | Medium | Medium | Cross-cutting constraints (e.g. API handlers must validate input with Zod) |
| **Skills** (`.claude/skills/`) | Name + description at start; body on invoke | Invoked skills re-injected within a shared budget; oldest dropped first | **Low** | Medium | Procedural workflows (deploy / release / review checklists) |
| **Subagents** (`.claude/agents/`) | Name + desc + tool list at start; body only when called, and it never enters the parent at all | Only the final message returns to the parent | **Low** | Medium | Parallel / isolated tasks; investigations whose intermediate results you won't reuse (deep search, log analysis, dependency audit) |
| **Hooks** (`settings.json` etc.) | Fire on lifecycle events | **Bypass compaction entirely** | Low | **Highest (deterministic)** | Things that must run reliably (linter, Slack post, blocking a command) |
| **Output styles** (`.claude/output-styles/`) | Session start, injected into the system prompt | **Never compacted** | High | **Highest (LLM instruction weight)** | Large role changes (code assistant → general assistant) |
| **Append system prompt** (`--append-system-prompt`) | Startup CLI flag, that invocation only | Not compacted; cached after first request | Moderate–high | High (but diminishing) | Tone, response length, formatting, domain knowledge to add |

### The ROUTE decision flow

When you want to make a new instruction/behavior permanent, decide top-down:

1. **Must it be enforced deterministically?** (always block a dangerous edit, always run prettier after an edit, always post to Slack on completion)
   → **hook**. If you also need it un-overridable by users across an org, **managed settings**.
   > "The model *choosing* to run a formatter is different from the formatter *running automatically*." Instructions to the LLM (CLAUDE.md/rule/skill) stay advisory — they can break under pressure, in long sessions, or via prompt injection. The only real guardrails are hooks and permissions.
2. **Is it a procedure / checklist / runbook?** (deploy steps, security review, release flow)
   → **skill**. The body loads only on invoke, costing ~nothing when unused.
3. **Is it an isolated investigation whose intermediate results you don't want in the main thread?** (reading lots of files, log analysis, a second-opinion review)
   → **subagent**. Runs in a separate context window; only the final result returns.
   > The skill-vs-subagent split: want to watch and steer each step in the main thread → **skill**; want to isolate noisy intermediate results → **subagent**.
4. **Is it a constraint that applies only to a set of files / a cross-cutting concern?** (`src/api/**` only, `*.handler.ts` only, "migrations are append-only")
   → **path-scoped rule** (`paths:` frontmatter). A concern that appears in several (but not all) corners of the codebase fits a rule better than a nested CLAUDE.md.
5. **Does it change the role itself, or is it a permanent tone/formatting preference?**
   → A large role change is an **output style** (mind the "clobbering defaults" warning below). A light tone/formatting/domain-knowledge addition that only needs to apply for one invocation is **append-system-prompt**.
6. **None of the above — is it a "fact" Claude should always know?** (build commands, monorepo layout, immutable team conventions)
   → **CLAUDE.md**. But ask each line "would removing this cause Claude to make mistakes?"; if NO, don't add it.

> An instruction that doesn't strongly match any of these is usually best **not written at all**. A "just in case" line keeps costing tokens in every session.

---

## Anti-Patterns — the misplacement quick reference (per the blog)

The "symptom → right mechanism" map, used in both ROUTE and AUDIT. These are the official blog's "Quick tips" verbatim.

| Misplacement | Why it fails | Correct home |
|--------------|--------------|--------------|
| **"every time X, always Y"** in CLAUDE.md (always prettier, etc.) | An LLM instruction, so execution isn't guaranteed | **hook** (`settings.json`) |
| **"Never do X"** (a hard ban) in CLAUDE.md | Breaks under pressure / injection / long sessions | **hook (`PreToolUse`, exit code 2)** / permissions / **managed settings** (org-wide enforcement) |
| **A 30-line procedure** in CLAUDE.md (deploy runbook, etc.) | Loaded every session, heavy, buries the rest | **skill** (`.claude/skills/`; body loads only on invoke) |
| **A rule with no `paths:`** that is domain-specific | An unscoped rule is mechanically identical to CLAUDE.md = always billed | **add `paths:` to path-scope it** |
| **Personal preferences** in a project CLAUDE.md (semantic commits, etc.) | Conflicts with team settings; loaded for everyone | **user-level** file (`~/.claude/...`) |
| **An output style that overrides defaults** (no `keep-coding-instructions`) | Removes the default scope/comment/security/verify instructions | Keep defaults, or consider the **built-in styles** (Proactive/Explanatory/Learning) first |
| The same instruction in **both CLAUDE.md and a hook** | Double-billing; a source of drift | Pick one (consolidate into the hook if it must be enforced) |
| A shared-repo CLAUDE.md that has **bloated** (every team appends, nobody deletes) | Irrelevant lines load into every engineer's every session; compounds at scale | Push team-specific to **path-scoped rules**, procedures to **skills** |

---

## AUDIT Mode — how to SCAN an existing project

When asked to "tidy up `.claude`" or "review it against the official docs", do not speak from guesswork — **scan first, then report**. Read `references/audit-playbook.md` for the detailed detection signatures, fix recipes, and report template before running. Overview:

1. **Inventory**: enumerate the targets.
   - `CLAUDE.md`, `**/CLAUDE.md` (root + subdir), `CLAUDE.local.md`, `~/.claude/CLAUDE.md`
   - `.claude/rules/**/*.md` / `.claude/skills/*/SKILL.md` / `.claude/agents/*.md` / `.claude/output-styles/*.md`
   - `.claude/settings.json`, `.claude/settings.local.json` (hooks / permissions)
2. **Measure & detect**: CLAUDE.md line counts (>200 lines = split candidate), each rule's `paths:` presence, procedures/bans/"every time" phrasing inside CLAUDE.md, output-style `keep-coding-instructions`, CLAUDE.md∧hook duplication — sweep with the `audit-playbook.md` signatures.
3. **Findings table**: present as `location | current mechanism | issue | recommended mechanism | why | concrete action`, grounded in real file quotes, not guesses.
4. **Apply fixes**: after the user approves, move misplaced items to the right mechanism. For CLAUDE.md, **deleting beats adding** by default. Ask each line "would removing this cause Claude to make mistakes?" — NO = delete / YES but rare = move to a skill / YES and always-needed = keep.

> AUDIT rule of thumb: **CLAUDE.md under 200 lines** (this blog's bar; `claude-code-best-practices` is stricter at ~100), give it an owner, review it like code. Treat it as the index to the codebase and push detail into other files.

---

## References

- `references/mechanisms.md` — the precise details of each of the 7 mechanisms (definition, load timing, exact compaction numbers, syntax examples, when to use / not). Consult after ROUTE picks a mechanism, when producing the implementation syntax.
- `references/audit-playbook.md` — the AUDIT detection signatures (greppable patterns), misplacement→fix recipes, and report template. Read before running an AUDIT.

---

## This skill's own anti-patterns

- **Reciting the source**: pasting the blog table back → the value is *translating* it to the user's concrete files and rules. In ROUTE, always cite one concrete example of "the instruction in question" when showing the verdict.
- **Guesswork diagnosis**: in AUDIT, saying "it's probably bloated" without reading real files → always SCAN first, then report (with quotes).
- **Mechanism proliferation**: "just append to CLAUDE.md", "hook everything" → both appending and hooking carry cost. Run the ROUTE flow, and always keep "don't write it / delete it" on the table.
- **Overreach**: ordinary code implementation and general session operation (explore→plan→implement, `/clear` strategy, etc.) belong to `claude-code-best-practices`. Stay focused on *where an instruction lives*, and hand off to the sibling skill when needed.
