---
name: loop-engineering
description: |
  Turn a project into a place where loops (self-prompting agent systems) can safely run — or prove it shouldn't have one yet. Applies the "Loop engineering: 14-step roadmap from prompter to loop designer" discipline (Anthropic engineering docs + Addy Osmani's loop-engineering essay + Geoffrey Huntley's Ralph Wiggum failure mode) to a real codebase in stages: SCAN the repo, ANALYZE candidate tasks against the 4-condition test and the 30-second check, then BUILD the minimum viable loop (one automation + one skill + one state file + one gate) in the mandated order, HARDEN it against the known failure modes (Ralph Wiggum loop, goal drift, self-preferential bias, comprehension debt, the security tax), and MEASURE cost-per-accepted-change. Use whenever someone wants to — automate a recurring agent task, "set up a loop / a /loop / a /goal / a routine / an automation / a cron for the agent", do CI-failure triage / dependency-bump / lint-and-fix / issue-to-PR automatically, "make the agent prompt itself", run agents unattended or in parallel (worktrees), add a maker/checker (evaluator-optimizer) split, write a STATE.md / VISION.md / AGENTS.md persistence layer, or audit an existing loop that "fails quietly", drifts, burns tokens, or ships unreviewed code. Trigger even without the word "loop" — on "automate this repetitive task for the agent", "schedule the agent", "run until the tests pass on its own", "stop me from having to re-prompt", and their Japanese equivalents (ループ化 / 自動化したい / エージェントに自分でプロンプトさせたい / 定期実行 / ループを設計 / loop engineering). Also fires on /loop-engineering.
trigger: /loop-engineering
---

# Loop Engineering

> The leverage point moved — from **typing prompts** to **designing the system that prompts**.
> A *loop* is a small system that **finds the work, hands it to the agent, checks the result, records what happened, and decides the next move — on its own.** You design it once; it prompts the agent from then on.

This skill applies that discipline to a real project **in stages**. It does not just build a loop on request — it first proves the project *should* have one, then builds the smallest one that works, then hardens it against the failure modes that turn loops into money pits.

**The honest version, stated up front:** loop engineering is real, and **most projects don't need it yet.** A loop earns its cost only under four conditions (Phase 1). Miss one and the loop costs more than it returns — say so plainly and stop at a good manual prompt. Never build a loop just because you were asked to; build it only when the test passes.

## When to use

Fire proactively — even without the word "loop" — when the user wants to: automate a recurring agent task, schedule/cron an agent, run an agent "until the tests pass", set up `/loop` / `/goal` / a routine / an automation, do CI-triage / dependency-bumps / lint-and-fix / issue→PR drafting automatically, run agents in parallel (worktrees), split a maker from a checker, persist agent state (STATE.md / VISION.md / AGENTS.md), or **audit an existing loop** that fails quietly, drifts, burns tokens, or ships unreviewed code.

## The mental model (read once)

A loop is a cycle of six primitives. Five are *building blocks*; the sixth (**state**) is the spine that lets tomorrow's run **resume** instead of **restart**.

```
            ┌──────────────────────── NEXT MOVE ◄───────────────────────┐
            ▼                                                            │
   ① Find work ──► ② Hand it to the agent ──► ③ Check result ──► ④ Record ──► ⑤ Decide
   (automation)     (skill + connectors)      (gate)          (state file)   (stop/retry/handoff)
```

- **Automations** = the heartbeat. Schedule / event / trigger. Everything hangs off this.
- **Worktrees** = parallel without chaos. Each agent gets its own checkout; edits can't collide.
- **Skills** = project knowledge written once, read every run. Without them the loop re-derives context from zero each cycle.
- **Connectors (MCP)** = the loop acts in your real tools (GitHub, Linear/Jira, Slack, Sentry), not just the filesystem.
- **Sub-agents** = keep the maker away from the checker (the evaluator-optimizer pattern). The model that wrote the code is "way too nice grading its own homework."
- **State file** = the agent forgets; the file does not. The single dumbest-sounding, most load-bearing piece.

**Inner loop vs. outer loop.** The diagram above is the *outer*, self-prompting loop you design. Inside each handoff, the agent runs an *inner* per-turn loop — `gather context → take action → verify results` — which you can still interrupt, steer, or add context to. Loop engineering builds the **outer** loop so the inner one runs without you in the chair. The source's title card names the lifecycle **Plan → Build → Run → Learn**; this skill's five phases (below) are the applied, project-improvement form of it.

Full source-faithful rules in `references/00-rules.md`. Read it before deep work.

## Operating procedure — run these phases in order

Work the phases **in sequence**. Do not skip ahead — *"get one manual run reliable first; turn it into a skill; wrap it in a loop; then schedule it. Skipping ahead is how loops fail in production."* Track progress with the task tools. Write findings into a `LOOP_REPORT.md` (template in `assets/loop-report.md.template`) so the analysis itself survives between sessions.

> **Phase 0 (SCAN) is mandatory, not preamble.** It produces the verification-surface verdict the entire gate decision depends on — "no automated gate → no loop" is decided here. Never jump to ANALYZE or BUILD without it.

### Phase 0 · SCAN — read the project before judging it

Goal: a factual inventory. Do **not** propose loops yet. Produce the "Scan" section of `LOOP_REPORT.md`.

Gather, by reading the repo (prefer the Explore agent for breadth):

1. **Verification surface** — what can *objectively fail bad output*? Test suite (and its real coverage, not just its existence), type checker, linter, build, CI config (`.github/workflows`, etc.). This is the make-or-break input: **no automated gate → no loop.**
2. **Reproduction surface** — can an agent *run the code it changes* and see what breaks? Dev server, test runner, fixtures, seed data, containers.
3. **Recurring-work surface** — grep history/issues/CI for tasks that repeat: flaky tests, dependency bumps, lint churn, triage, issue→PR. These are loop candidates.
4. **Existing steering config** — `.claude/` and `.codex/` (skills, agents, hooks, settings, MCP servers), `CLAUDE.md` / `AGENTS.md` / `VISION.md`, any current `STATE.md` or scheduled tasks. Note what's already there so you extend rather than duplicate.
5. **Budget & review reality** — metered consumer plan vs. unmetered? Who reviews merges, and is review *already* the bottleneck? (Decides Phase 1's economics.)

If the verification surface is thin, the most valuable thing this skill can do is say so and recommend building tests/CI **before** any loop. A loop on unverifiable code is "the agent agreeing with itself on repeat."

### Phase 1 · ANALYZE — prove it needs a loop (the gate decision)

Two tests. Both live in `references/01-tests-and-checklists.md`. Apply them honestly — the failure mode here is talking yourself into a loop the project can't support.

**A. The 4-condition test (strategic — per project/task class).** All four must pass:
1. **The task repeats** (≥ weekly). One-time job → a good prompt is faster and cheaper.
2. **Verification is automated** — a test/type-check/lint/build can fail the work *with no human in the room*.
3. **The token budget can absorb the waste** — loops re-read, retry, explore; that burns tokens whether or not a run ships.
4. **The agent has a senior engineer's tools** — logs, a reproduction environment, the ability to run code and see what breaks.

> Miss one box → keep it a **manual prompt.** Report *which* condition failed and what would have to change. Do not proceed to Phase 2 for that task.

**B. The 30-second loop check (tactical — per concrete task).** For each candidate that passed A, all five:
1. Happens at least weekly. 2. A test/type-check/build/linter can reject bad output. 3. The agent can run the code it changes. 4. The loop has a **hard stop** (token budget, iteration count, or time limit). 5. A **human reviews before merge, deploy, or dependency changes** (an approval gate before anything irreversible).

**C. Who-wins economics.** Good fits: repetitive machine-checkable work + budget, strong existing test suites, async multi-agent teams. Skip for now: solo builders on consumer plans, code with no automated verification, teams whose real constraint is **review capacity** (a loop just makes the review queue longer).

**Output of Phase 1:** a classified candidate list — `BUILD` (passed both tests) vs. `KEEP MANUAL` (which box failed + remedy). Good first loops: CI-failure triage, dependency-bump PRs, lint-and-fix passes, flaky-test reproduction, issue→PR on well-tested code. **Never auto-loop:** architecture rewrites, auth/payments code, production deploys, vague product work, anything where "done" is a judgment call.

**If nothing qualifies, stop here and say so.** That is a successful, honest outcome of this skill.

### Phase 2 · BUILD — the minimum viable loop, in the mandated order

For each `BUILD` candidate, assemble **four parts, no swarm** (details + templates in `references/02-building-blocks.md` and `templates/`). **Order is non-negotiable:**

> **① Reliable manual run → ② One skill → ③ One state file → ④ One gate → ⑤ One automation → then schedule.**

1. **Prove one manual run reliable.** Run the task by hand, agent-assisted, until it produces an accepted result. If you can't do it once by hand, you can't loop it.
2. **One skill** (`templates/skill.md.template`) — a single `SKILL.md` holding the project context the agent would otherwise re-derive every cycle: conventions, build steps, "we don't do it like this because of *that* incident", classification/fix rules, and a `## Never do` list.
3. **One state file** (`templates/STATE.md.template`) — markdown in-repo (solo/small team) or Linear/Issues/DB (production, multi-human). Records last run, in-progress, completed, **escalated-to-humans**, and **lessons learned (written here, not in chat)**. For long runs, pair it with a standing **`VISION.md` / `AGENTS.md`** (`templates/VISION.md.template`) reread each run — *state says where it is; spec says where to go.*
4. **One gate** — the objective check that can **say no**: a test that passes/fails, a build that compiles or doesn't, a linter returning zero/non-zero. **Not** a second agent "reviewing" with an opinion. This is the part that decides whether the loop helps or just spends.
5. **One automation** (`templates/goal-automation.md.template`) — the heartbeat. In Claude Code: `/loop` for cadence, `/goal` for run-until-true (a *separate small model* checks completion — the maker isn't the grader), Desktop scheduled tasks / Routines for restart-survival and laptop-off runs, hooks for lifecycle events. In Codex: the Automations tab (project + prompt + cadence + worktree; results land in a Triage inbox). Use `/loop` for "check regularly regardless of state"; `/goal` for "keep going until a written condition is *actually* true." **Note:** `/goal`'s checker verifies the **stop condition** (is the loop done?); it does **not** replace the verifier sub-agent that checks the **diff** (is this code good?). A hardened loop needs both — see the maker/checker split below and `templates/verifier-subagent.md.template`.

Add the remaining building blocks **only when the task needs them**: **worktrees** (`isolation: worktree`, `--worktree`) once more than one agent runs in parallel; **connectors/MCP** (GitHub first, then Linear/Jira, Slack, Sentry) when the loop must act in real tools; **sub-agents** (a separate verifier with different instructions, sometimes a stronger model) to enforce the maker/checker split. Tool-by-tool mapping (Codex ↔ Claude Code) in `references/04-codex-vs-claude.md`.

### Phase 3 · HARDEN — design against the failure modes

A loop runs while no one is watching, so the verifier you trust is the only reason you can walk away. Walk `references/03-failure-modes.md` and confirm each defense is in place:

- **Ralph Wiggum loop** (fails quietly, keeps spending — emits "done" early on a half-done job). Defense: an **objective hard gate** + a **hard stop**, never a soft "looks good." No real verifier + soft completion + no hard stop = two optimists agreeing.
- **Goal drift over long sessions** (each summarization is lossy; "don't do X" vanishes by turn 47). Defense: a standing `VISION.md`/`AGENTS.md` reread every run.
- **Self-preferential bias** (the maker is too nice grading its own homework). Defense: a separate verifier sub-agent with **no exposure to the maker's reasoning**, sometimes a different model.
- **Agentic laziness** ("done enough" at partial completion). Defense: `/goal` with an objective stop condition checked by a fresh model.
- **Comprehension debt & cognitive surrender** (the faster it ships code you didn't write, the larger the gap between what the repo contains and what you understand). Defenses are **not technical**: read the diffs, spot-check that gates actually catch the failure they claim to, keep the loop off architecture/judgment work, pair-design the loop with a teammate.
- **The security tax** (an unattended loop is an unattended attack surface). Add SAST + dependency audit + secret scanning to the gate; **audit skill sources before installing** (prompt injection hides in descriptions — *520 of 17,022 audited skills leak credentials*); disable verbose logging in production loops and sanitize what's logged; **re-audit permissions every 30 days** (read-only creeps to write "just once" and never gets re-checked).

### Phase 4 · MEASURE — the only metric that matters

Track **cost per accepted change** — *not* tokens spent, tasks attempted, or loops scheduled. Record in `STATE.md`/`LOOP_REPORT.md`: cost-per-accepted, accepted count, reject rate, MTTA, lead time.

> **If the accepted-change rate is below 50%, the loop is losing** — you're doing the review work the loop was supposed to save you from. Tighten the gate, narrow the task, or retire the loop.

## Hard rules (never violate)

1. **No automated gate → no loop.** A second agent "reviewing" without a test/type-check/build is just a second optimist.
2. **Never let one agent both write and verify.** Separate the maker from the checker.
3. **Always a hard stop** — token budget, iteration count, or time limit. No exceptions.
4. **Always a human approval gate before anything irreversible** — merge, deploy, dependency or auth/payments changes.
5. **Order is mandatory:** manual run → skill → state → gate → automation → schedule. Never skip ahead.
6. **Never loop judgment-call work** — architecture, auth, payments, vague product. Keep loops on small, machine-checkable changes.
7. **Never auto-install unaudited skills/connectors.** Read the source first.
8. **Always keep a state file**, or tomorrow's run restarts from zero.
9. **If the test in Phase 1 fails, the deliverable is "don't build a loop yet" + what to fix.** Stopping is a valid, correct outcome — never fabricate a loop to look productive.

## Reference & template map

| File | Use it for |
|------|-----------|
| `references/00-rules.md` | The complete, source-faithful 14-step roadmap (read before deep work) |
| `references/01-tests-and-checklists.md` | 4-condition test, 30-second check, who-wins economics, the money-pit mistakes |
| `references/02-building-blocks.md` | The 5 building blocks + state file, in depth |
| `references/03-failure-modes.md` | Ralph Wiggum, goal drift, bias, comprehension debt, security tax + defenses |
| `references/04-codex-vs-claude.md` | Primitive-by-primitive mapping across Codex and Claude Code |
| `templates/skill.md.template` | One skill (with `ci-triage` worked example) |
| `templates/STATE.md.template` | One state file |
| `templates/VISION.md.template` | Standing spec for long-running loops |
| `templates/goal-automation.md.template` | One automation (`/loop` + `/goal`) |
| `templates/verifier-subagent.md.template` | Maker/checker split sub-agent |
| `assets/loop-report.md.template` | Scan + analysis report carried between sessions |
