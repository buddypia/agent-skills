# The 5 building blocks + the state file — in depth

A loop is a cycle of six primitives. Five are building blocks; the sixth — **state** — is the spine. This file is the implementation reference for Phase 2 (BUILD). Tool-specific syntax is in `04-codex-vs-claude.md`.

```
            ┌──────────────────────── NEXT MOVE ◄───────────────────────┐
            ▼                                                            │
   ① Find work ──► ② Hand it to the agent ──► ③ Check result ──► ④ Record ──► ⑤ Decide
   (automation)     (skill + connectors)      (gate)          (state file)   (stop/retry/handoff)
```

---

## 1. Automations — the heartbeat

**Job in the loop:** discovery + triage on a schedule. They fire on a **schedule, an event, or a trigger condition**. Everything else hangs off them — without one, you have a single run, not a loop.

**Two primitives that separate working loops from expensive ones:**
- **`/loop`** — re-runs on a **cadence**. Use when you want regular checks *regardless of state* ("scan for new CI failures every 30 min").
- **`/goal`** — keeps going **until a written condition is actually true**. A *separate small model* checks completion, so the maker isn't the grader. This is **the maker-vs-checker split applied to the stop condition itself.**

Pattern (Claude Code): `/loop 30m /goal <objective condition> → <task>`. See `templates/goal-automation.md.template`.

**Hard rule:** every automation needs a **hard stop** (budget / iteration count / time) and, for anything irreversible, a **human approval gate** before action.

---

## 2. Worktrees — parallel without chaos

**Job in the loop:** isolate parallel features. The moment more than one agent runs, files collide. A **git worktree** = a separate working directory on its own branch sharing the same repo history, so one agent's edits *cannot* touch another's checkout.

```
Repo ──┬── ../main       (main branch)
       ├── ../feature-a  (feature-a branch)   ← agent A, isolated checkout
       └── ../feature-b  (feature-b branch)   ← agent B, isolated checkout
```

- Claude Code: `git worktree` directly, **`--worktree`** to open a session in its own checkout, **`isolation: worktree`** on a subagent (fresh checkout, self-cleaning).
- Codex: worktree support is built in (per-thread).

**Add only when more than one agent runs in parallel.** Worktrees remove the mechanical collision — but **you are still the ceiling.** Your *review bandwidth*, not the tool, decides how many parallel agents you can actually run.

---

## 3. Skills — project knowledge once, read every run

**Job in the loop:** codify project knowledge. A folder with a **`SKILL.md`** (instructions + metadata) plus optional scripts/references/assets. Without skills a loop **re-derives your whole project context from zero every cycle**; with skills, **intent compounds.**

What belongs in the loop's skill: conventions, build/test commands, classification rules, fix patterns, and crucially the institutional memory — *"we don't do it like this because of that one incident"* — plus an explicit **`## Never do`** list and a **`## State`** instruction telling the agent to update the state file each run. See `templates/skill.md.template` and the worked `ci-triage` example.

---

## 4. Connectors — touch real tools, via MCP

**Job in the loop:** connect your tools. Built on the **Model Context Protocol (MCP)**, connectors let the agent read your issue tracker, query a DB, hit a staging API, post to Slack. Codex and Claude Code both speak MCP, so a connector for one usually works in the other. This is the difference between an agent that *says* "here is the fix" and a loop that **opens the PR, links the ticket, and pings the channel once CI is green.**

Highest-payback **order for loop work**:
1. **GitHub** — repos, branches, PRs, issue comments, webhook reactions. Biggest day-one win for any code loop.
2. **Linear / Jira** — update tickets as the loop progresses, link PRs to issues, auto-close on verification.
3. **Slack** — triage results, escalation pings, morning summaries of overnight runs.
4. **Sentry / error tracker** — investigate live alerts, draft fixes for high-frequency ones.

**The broader available catalog** (per the Connectors screen — "Unlock more with Claude when you connect your favorite tools") includes, beyond the four above: **Asana**, **Atlassian** (Jira & Confluence), **Canva**, **Cloudflare**, **Gmail**, **Google Calendar**, **Google Drive**, **Intercom**, **Notion**, **PayPal** (via PayPal's MCP server), **Plaid**. Any of these can feed or act inside a loop; the four numbered above are simply the ones that pay back fastest for *code* loops.

**Add only when the loop must act in real tools.** Audit any connector's source/permissions before wiring it in (see the security tax, `03-failure-modes.md`).

---

## 5. Sub-agents — keep the maker away from the checker

**Job in the loop:** ideate and verify. The single most useful structural move: **split the agent that writes from the agent that checks.** The maker is "way too nice grading its own homework"; a second agent with different instructions (sometimes a different/stronger model) catches what the first talked itself into. This is the **evaluator-optimizer pattern** (Anthropic, Dec 2024): one model generates → the other critiques → repeat.

```
   In ──► [Generator] ──Solution──► [Evaluator] ──Accepted──► Out
              ▲                          │
              └────── Rejected + Feedback ┘
```

- Codex: agents as **TOML in `.codex/agents/`** (name, description, instructions, optional model + reasoning effort) — spawned on request, run concurrently, folded into one answer.
- Claude Code: subagents in **`.claude/agents/`** + agent teams. Usual split: **one explores, one implements, one verifies against the spec.**

**Why it matters in a loop:** the loop runs while you're not watching, so **a verifier you trust is the only reason you can walk away.** Cost: sub-agents burn more tokens (own model + tool work) — spend them where a second opinion is worth paying for. See `templates/verifier-subagent.md.template`.

---

## 6. The state file — the spine

**Job in the loop:** track what's done. Sounds too dumb to matter; is the spine of every working loop. Anything outside the single conversation that holds what's done and what's next. **The agent forgets each run; the file does not.** No state → restarts every run; with state → **resumes.**

Required sections (see `templates/STATE.md.template`): `Last run`, `In progress`, `Completed`, **`Escalated to humans`**, **`Lessons learned (write here, not in chat)`**, `Stop conditions met since last review`.

**Where it lives:**
- **Markdown in the repo** (`STATE.md` at root or in `.claude/`) — version-controlled, diff-readable. Best for solo / small team.
- **External system** (Linear, GitHub Issues, DB) — survives across repos, queryable, team-wide visibility. Best for production loops with multiple human watchers.

**For long-running loops, pair state with a standing spec** — `VISION.md` / `AGENTS.md` (`templates/VISION.md.template`) reread each run. **State = where it is. Spec = where to go.** This is the primary defense against goal drift.

---

## Assembly order (mandatory)

> **① Reliable manual run → ② One skill → ③ One state file → ④ One gate → ⑤ One automation → then schedule.**

"Four parts, no swarm." Get the simplest version working end-to-end before adding worktrees, connectors, or sub-agents. Add each extra block **only when the task demonstrably needs it.** Skipping ahead is how loops fail in production.
