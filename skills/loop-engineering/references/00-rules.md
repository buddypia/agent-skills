# Loop Engineering — the complete 14-step roadmap (source-faithful)

> Source material: *"Loop engineering: the 14-step roadmap from prompter to loop designer"* (Codez / @0xCodez), synthesizing Anthropic's engineering docs, Addy Osmani's long-form on loop engineering, Geoffrey Huntley's "Ralph Wiggum loop", and recent measurement studies. This file is the canonical rule set the skill applies. Three tiers: **(1) figure out if you actually need a loop, (2) learn the five building blocks, (3) build the smallest one that works without hurting you.** 14 steps. 3 tiers. Stop prompting. Start designing.

---

## PART 1 · The Why & The Test

### 01. Loop engineering is replacing yourself as the prompter
Most developers still prompt by hand — **9 out of 10 builders have never written a single loop that prompts the agent for them** (no automation, no state file, no verifier, no schedule). For two years the workflow was: write a prompt, share context, read what came back, write the next prompt. The agent was a tool and **you held it the entire time.** That is ending. Loop engineering is building a small system that **finds the work, hands it to the agent, checks the result, records what happened, and decides the next move — on its own.** You design that system once; the system prompts the agent from then on. Anthropic engineers report merging **8× as much code per day** as in 2024 — a figure Anthropic itself calls "almost certainly an overstatement of the true productivity gain." The *number* is debated; the *mechanism* isn't: **the leverage point moved from typing prompts to designing the loop that prompts.**

**Addy Osmani breaks loop engineering into six parts** — the five building blocks (automations, worktrees, skills, connectors, sub-agents) plus **state** — which is the decomposition this skill uses. The source's title card also names the loop's lifecycle as four phases: **Plan** (define the loop) → **Build** (create the system) → **Run** (execute & observe) → **Learn** (iterate & improve), surfacing the primitives `/goal`, `skill.md`, Worktrees, and MCP. *(This skill's operating procedure — SCAN → ANALYZE → BUILD → HARDEN → MEASURE — is the applied, project-improvement version of that lifecycle.)*

**Two loops, not one.** The *inner* agentic loop is what the agent runs each turn: `your prompt → gather context → take action → verify results → done`, with you free to **interrupt, steer, or add context** at any point. The *outer* loop is the self-prompting system loop engineering builds around it (`find work → hand off → check → record → decide → next move`). Loop engineering is about designing the **outer** loop so the inner one runs without you in the chair.

### 02. Run the 4-condition test before you build anything
Loops earn their cost under four conditions. **Miss one and the loop costs more than it returns.** (The honest framing of this test — and the "most developers don't need it yet" conclusion — is **AlphaSignal's analysis**, the part most X-threads skip.)
1. **The task repeats.** A loop amortizes setup across many runs. For a one-time job a good prompt is faster and cheaper. If the work doesn't recur weekly, you don't have a loop — you have a script you ran once.
2. **Verification is automated.** The loop needs something that can *fail the work without you in the room*: a test suite, type checker, linter, build. No automated check → you're back in the chair reading every diff — the exact job the loop was supposed to remove.
3. **Your token budget can absorb the waste.** Loops re-read context, retry, explore. That burns tokens whether or not the run ships. The technique scales with budget — obvious to people with effectively free tokens, reckless to people on a metered plan.
4. **The agent has a senior engineer's tools.** Logs, a reproduction environment, the ability to run the code it writes and see what breaks. Without that, the loop iterates blind.

### 03. Who wins, who loses — loops favor whoever can spend
The economics are not universal. People calling loops "obvious" tend to have **unmetered tokens**; for those on a $20 consumer plan running heavy verification loops, it's reckless (limits or a surprise invoice).
- **Who benefits:** teams with repetitive, machine-checkable work *and the budget* (continuous test triage, dependency bumps, lint-and-fix, issue→PR on strong test coverage); codebases with **strong existing test suites** (if a junior could do it from a checklist and a test suite would catch their mistakes, a loop fits); async-first teams already using multi-agent patterns (routines are their missing orchestration layer).
- **Who should skip it today:** solo builders on consumer plans (the token bill arrives before the productivity gain); anyone working on code with **no automated verification** (a loop with no real check is the agent agreeing with itself on repeat); teams whose real constraint is **review capacity** rather than typing speed (a loop generates more code → the review queue gets *longer*).
- For one-off tasks, exploratory work, or anything where "done" is a judgment call, **a single well-aimed prompt still wins.** The honest version: loop engineering is real, and **most developers don't need it yet.**

### 04. The 30-second loop check (tactical, per task)
Step 02 is the strategic decision; this is the checklist you run on a *specific* task before turning it into a loop. **Miss one box → keep it a manual prompt.**
1. The task happens **at least weekly** (less → setup never amortizes).
2. A **test/type-check/build/linter can reject** bad output (else the agent grades its own homework).
3. The agent **can run the code it changes** (no repro env → iteration is blind).
4. The loop has a **hard stop** — token budget, iteration count, or time limit (else it runs until someone notices the bill).
5. A **human reviews before merge, deploy, or dependency changes** (anything irreversible needs a human approval gate before action).

**Good first loops:** CI-failure triage (nightly: scan failures, classify causes, draft fix PRs for easy ones); dependency-bump PRs (weekly: scan updates, test compatibility, open PRs); lint-and-fix passes (on every PR-open event); flaky-test reproduction (loop until a theory survives the test); issue→PR drafts on code with strong tests (bad output gets rejected by the suite).
**Bad first loops — need a human in the chair:** architecture rewrites, auth/payments code, production deploys, vague product work, anything where "done" is a judgment call.

---

## PART 2 · The 5 Building Blocks

### 05. Automations — the heartbeat
Automations are what make a loop an *actual loop* and not just one run you did once. They fire on a **schedule, an event, or a trigger condition** — the heartbeat everything else hangs off.
- **Codex:** the Automations tab — pick a project, set a prompt, set a cadence, choose local checkout or background worktree. Runs that find something land in a **Triage inbox**; runs that find nothing archive themselves.
- **Claude Code:** three primitives compose into the same shape — **`/loop`** for session-scoped cadence, **Desktop scheduled tasks** for restart-survival, **Routines** for laptop-off cloud runs. Pair with **hooks** for lifecycle events.

Two primitives separate working loops from expensive ones:
- **`/loop`** re-runs on a cadence — use when you want regular checks *regardless of state*.
- **`/goal`** keeps going **until a condition you wrote is actually true**. A *separate small model* checks completion, so the agent that wrote the code isn't the one grading it. **This is the maker-vs-checker split applied to the stop condition itself.**

**Why `/goal` matters — the before/after.** *Without `/goal`, you are the loop:* you prompt → Claude works → Claude stops → you review → you prompt again → … **You are the bottleneck; every turn requires your input to continue.** *With `/goal`, Claude closes the loop:* you set the goal → Claude works → an evaluator checks → done ✓ → goal cleared, or not done → Claude starts the next turn and loops. **You are removed from the loop; Claude works until the condition is met.**

```
> /loop 30m /goal All tests in test/auth pass and lint is clean.
  Scan src/auth for new failures, propose fixes in claude/auth-fixes,
  open draft PR when goal condition holds.

▲ Claude
  CronCreate(*/30 * * * * : auth quality loop)
  Stop condition: tests pass + lint clean (verified by checker)
✓ Scheduled. Will continue past intermediate completions
  until /goal condition is met by independent checker.
```

### 06. Worktrees — parallel without chaos
The second you run more than one agent, files collide — two agents writing the same file is two engineers committing the same lines without talking. A **git worktree** fixes it: a separate working directory on its own branch sharing the same repo history, so one agent's edits *literally cannot touch* the other's checkout.
- **Codex** builds worktree support in — several threads hit the same repo at once without bumping into each other.
- **Claude Code** exposes `git worktree` directly, a **`--worktree`** flag to open a session in its own checkout, and an **`isolation: worktree`** setting on subagents so each helper gets a fresh checkout that cleans itself up after.
- Worktrees remove the *mechanical* collision, but **you are still the ceiling**: your review bandwidth decides how many parallel agents you can actually run — not the tool.

### 07. Skills — write project knowledge once, read on every run
A Skill is how you stop re-explaining the same project context every session "like a goldfish." Both tools use the same format: a folder with a **`SKILL.md`** holding instructions + metadata, plus optional scripts, references, assets. **Why it matters for loops:** a loop without skills re-derives your whole project context from zero every cycle; with skills, **intent compounds** — conventions, build steps, "we don't do it like this because of that one incident" written once on the outside, read by every run.

```
name: ci-triage
description: Classify CI failures by root cause (env, flake, real bug,
  dependency, infra), draft fixes for the easy ones, escalate the rest.
  Trigger whenever a workflow run fails or on the morning triage loop.
---
# CI triage skill
## Classification rules
- env: missing secret, wrong env var, infra not provisioned. # human
- flake: passes on retry without code change. # retry once, then file
- bug: deterministic failure tied to recent commit. # draft fix
- dependency: failure tied to a version bump. # draft rollback
- infra: timeout, OOM, runner issue. # escalate
## Fix patterns
- Auth tests → check src/auth/middleware first
- Database tests → verify migration applied in CI env
- E2E tests → check selectors against the latest UI snapshot
## Never do
- Disable failing tests — always file as escalation instead
- Modify CI config without human approval
- Touch src/payments/ or src/billing/ (in claude/permissions.md)
## State
Update STATE.md after each run: file paths checked, classifications,
PRs opened, items escalated.
```

### 08. Connectors — the loop touches your real tools, via MCP
A loop that can only see the filesystem is a tiny loop. **Connectors, built on the Model Context Protocol (MCP)**, let the agent read your issue tracker, query a database, hit a staging API, drop a message in Slack. Codex and Claude Code both speak MCP, so a connector written for one usually just works in the other. This is the difference between an agent that says "here is the fix" and a loop that **opens the PR, links the Linear ticket, and pings the channel once CI is green.** Highest-payback connectors, in order:
1. **GitHub** — read repos, create branches, open PRs, comment on issues, react to webhooks. The single biggest day-one win for any code loop.
2. **Linear / Jira** — update tickets as the loop progresses, link PRs to issues, close items when verification passes.
3. **Slack** — post triage results, ping humans on escalations, summarize overnight runs in the morning.
4. **Sentry / error tracker** — investigate live alerts, draft fixes for the high-frequency ones.

### 09. Sub-agents — keep the maker away from the checker
The most useful structural thing in a loop, by far, is **splitting the agent that writes from the agent that checks.** Osmani's framing is exact: the model that wrote the code is "way too nice grading its own homework." A second agent with different instructions — and sometimes a different model — catches what the first talked itself into. **This is the evaluator-optimizer pattern from Anthropic's December 2024 engineering post under a new name:** one model generates, another critiques, repeat. The vocabulary going viral in 2026 was documented eighteen months earlier.
- **Codex** spawns subagents only when asked, runs them concurrently, folds results into one answer. Define agents as **TOML in `.codex/agents/`** — name, description, instructions, optional model + reasoning effort. (Security reviewer = strong model on high effort; explorer = fast read-only.)
- **Claude Code** does the same with subagents in **`.claude/agents/`** and **agent teams** that pass work between them. Usual split: one explores, one implements, one verifies against the spec.
- Why it matters *inside a loop*: the loop runs while you're not watching, so **a verifier you actually trust is the only reason you can walk away.** Sub-agents burn more tokens (each does its own model + tool work) — spend them where a second opinion is worth paying for.

---

## PART 3 · Build It Right or Don't Build It

### 10. The state file — the agent forgets, the file does not
Sounds too dumb to matter; is actually **the spine of every working loop.** A markdown file, a Linear board, a JSON state — anything that lives *outside the single conversation* and holds what's done and what's next. Agents have short memory by default: what they learn this session is gone tomorrow unless you write it down. **Osmani's rule: the agent forgets, the repo does not.** A loop without persistent state restarts every run; a loop with state **resumes**.

```
# Loop state · ci-triage
## Last run
2026-06-09 03:30 UTC · 7 failures classified, 3 fixes drafted, 4 escalated
## In progress
- claude/fix-auth-token-refresh — tests passing locally, awaiting CI
- claude/fix-flaky-payment-webhook — retry pattern applied, monitoring
## Completed today
- claude/bump-axios-1.7.4 → merged (CI green, deps loop verified)
- claude/lint-fix-pass-june-9 → merged
## Escalated to humans
- src/billing/refund.ts — tests failing in 3 ways, root cause unclear
- ci/staging-runner — infra timeouts, not a code issue
## Lessons learned (write here, not in chat)
- 2026-06-08: PowerShell hits TLS 1.2 issue on this Windows runner. Use bash.
- 2026-06-07: tests/e2e/checkout requires Stripe webhook secret in env. Skip if missing.
## Stop conditions met since last review
- /goal "all tests pass + lint clean" achieved on commit 3a7b8c1 at 02:14 UTC
```

Two patterns for where it lives:
- **Markdown in the repo** — `STATE.md` at root or inside `.claude/`. Version-controlled, simple, diff-readable. Best for solo / small team.
- **External system** (Linear, GitHub Issues, a database) — survives across repos, queryable, team-wide visibility. Best for production loops where multiple humans need to see what the loop is doing.

For long-running loops that risk drifting, pair the state file with a **standing high-level spec — `VISION.md` or `AGENTS.md`** — reread each run. **State tells the agent where it is; the spec tells it where to go.**

### 11. The minimum viable loop
If you passed the 4-condition test, build the **smallest loop that works before anything fancy. Four parts, no swarm:**
1. **One automation** — a scheduled run that fires on a cadence and stops on a clear condition (`/loop` in Claude Code, an automation in Codex; pair with `/goal` for run-until-true).
2. **One skill** — a single `SKILL.md` storing the project context the agent would otherwise re-derive from zero every run.
3. **One state file** — a markdown file or Linear board recording what's done and what's next; tomorrow's run resumes instead of restarting.
4. **One gate** — the test/type-check/build that fails bad work automatically. **The part that decides whether the loop helps or just spends.**

**Order matters: get one manual run reliable first → turn it into a skill → wrap it in a loop → then schedule it. Skipping ahead is how loops fail in production.**

**The metric that matters is cost per accepted change** — not tokens spent, tasks attempted, or loops scheduled. **If your accepted-change rate is below 50%, you're doing review work the loop saved you from, and the loop is losing.**

### 12. The Ralph Wiggum loop — loops that fail quietly
Named by engineer Geoffrey Huntley: an agent meant to emit a completion token *only when finished* emits it **early**, and the loop exits on a half-done job. Without a hard gate, **loops fail quietly and keep spending.** It happens when:
- **No real verifier** — just a second agent asked to "review," no objective signal. Two optimists agreeing.
- **Soft completion conditions** — "done" defined by the agent's judgment, not a test/build/type-check.
- **No hard stops** — the loop continues until something external kills it (rate limit, you noticing) rather than until success is verified.

The fix is the gate from step 11 — **something objective that can fail the work**: a test that passes/fails, a build that compiles or doesn't, a linter returning zero/non-zero. **Not a verifier that has an opinion.**

Other measured failure modes:
- **Goal drift over long sessions** — each summarization step is lossy; "don't do X" constraints disappear at turn 47. → standing `VISION.md`/`AGENTS.md` reread each run.
- **Self-preferential bias** — the maker is too nice grading its own homework. → a separate verifier subagent with no exposure to the maker's reasoning.
- **Agentic laziness** — the loop declares "done enough" at partial completion. → `/goal` with an objective stop condition checked by a fresh model.

### 13. Comprehension debt and cognitive surrender
The failure mode that gets **sharper as the loop gets better, not worse.** Two named risks (Osmani):
- **Comprehension debt** — the faster the loop ships code you didn't write, the larger the distance between what the repository *contains* and what you *understand*. The bill that hurts isn't the token bill; it's the day you have to debug a system **no one on the team has read.**
- **Cognitive surrender** — the pull to stop forming an opinion and accept whatever the loop returns. Designing the loop is the *cure* when you do it with judgment, and the *accelerant* when you do it to avoid thinking. Same action, opposite result.

Mitigations are **not technical:**
- **Read the diffs.** Don't, and you're renting comprehension debt at compound interest.
- **Spot-check the gate.** Pick a few loop-opened PRs and verify the test that approved them actually catches the failure mode you care about. **Gates rot.**
- **Block the loop from architecture work.** Keep it on small, machine-checkable changes. The moment it touches judgment calls, comprehension debt accelerates.
- **Pair-design loops with a teammate.** A second pair of eyes catches blind spots the loop will otherwise exploit forever.

### 14. The security tax — an unattended loop is an unattended attack surface
A loop running unattended is also an **attack surface running unattended.** The threat model:
- **Generated code shipping unreviewed.** The loop opens PRs faster than a human can read them. Without a gate that includes security checks (**SAST, dependency audit, secret scanning**), insecure code merges automatically.
- **Skills as injection vectors.** A loop that auto-installs skills inherits every prompt injection hiding in their descriptions. **Audit skill sources before installing.** (*520 of 17,022 audited skills leak credentials.*)
- **Credentials in logs.** Debug logging during a long run scatters secrets across logs you don't monitor. **Disable verbose logging in production loops; sanitize what does get logged.**
- **Permission scope creep.** A loop tested with read-only permissions gets "just one" write permission added for convenience, then never re-audited. **Re-audit permissions every 30 days.**

---

## § The mistakes that turn loops into money pits
1. Building a loop without running the 4-condition test. (Most developers fail at least one condition.)
2. No objective gate — a second agent "reviewing" without a test/type-check/build is just a second optimist.
3. One agent doing both writing and verifying — self-preferential bias; the maker grades its own homework "A+."
4. No state file — tomorrow's run restarts from zero instead of resuming.
5. Vague stop conditions — "done when it looks good" never holds. Use a test, a type pass, or a passing build.
6. No token budget cap — loops re-read and retry; without a cap, ambitious loops burn **5–10×** the tokens you expected.
7. Running loops on a consumer plan with heavy verification — token bill or rate limit, one of them gets you.
8. Auto-installing community skills — **520 of 17,022** audited skills leak credentials. Read the source first.
9. Loops on judgment-call work — architecture, auth, payments, vague product. Keep loops on lint-and-fix, not strategy.
10. Not reading the diffs — comprehension debt at compound interest.

---

## Conclusion — the leverage moved; your job did too
For two years the leverage was at the prompt: better prompts, context, one-shot output. That phase is ending. The agents got good enough that the next leverage point is **one floor up — the system that decides what they work on, when, with what gate, and what state survives between runs.** But the honest version is **not** that everyone should rush to build loops. Most developers don't need one yet — not until the task repeats, verification is automated, the budget can absorb the waste, and the agent has senior-engineer tools. Miss one condition and the loop costs more than it returns.

If you pass the test, **build small: one automation, one skill, one state file, one gate.** Get a manual run reliable → turn it into a skill → wrap it in a loop → then schedule. Order matters. Skip ahead and you're paying for a system no one understands. As **Cherny** put it: the point isn't that the work got *easier* — it's that the **leverage point moved.** **Build the loop. Stay the engineer.**
