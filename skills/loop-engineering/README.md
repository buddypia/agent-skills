# Loop Engineering — from prompter to loop designer

A pure-prompt skill that turns a project into a place where **loops** (self-prompting agent
systems) can safely run — or proves it shouldn't have one yet. It runs entirely in the host
agent's context — no external CLIs, no setup. For the skill definition (invocation summary), see
[SKILL.md](./SKILL.md).

> A *loop* is a small system that **finds the work, hands it to the agent, checks the result,
> records what happened, and decides the next move — on its own.** You design it once; it prompts
> the agent from then on. The honest version, stated up front: loop engineering is real, and
> **most projects don't need it yet.**

## What it does

Loops fail in predictable ways — they emit "done" on half-finished work, drift over long
sessions, grade their own homework, and ship unreviewed code while no one is watching. This skill
applies the "Loop engineering: 14-step roadmap from prompter to loop designer" discipline to a
**real codebase in stages**: it first proves the project *should* have a loop, then builds the
smallest one that works, then hardens it against the failure modes that turn loops into money
pits. It never builds a loop just because it was asked to — only when the gate test passes.

## How it works

Five phases, run **in order** (findings carried in a `LOOP_REPORT.md` so the analysis survives
between sessions):

1. **SCAN** *(mandatory)* — read the project before judging it: verification surface (tests /
   types / lint / build / CI), reproduction surface, recurring-work surface, existing steering
   config, and the budget/review reality. **No automated gate → no loop** is decided here.
2. **ANALYZE** — prove it needs a loop via the **4-condition test** (repeats · verification is
   automated · budget absorbs the waste · agent has senior-engineer tools) and the **30-second
   loop check**. Output: each candidate classified `BUILD` or `KEEP MANUAL` (which box failed +
   remedy). If nothing qualifies, the skill stops and says so — a correct, honest outcome.
3. **BUILD** — the minimum viable loop in the mandated order: **manual run → one skill → one
   state file → one gate → one automation → then schedule.** No swarm; add worktrees /
   connectors / sub-agents only when the task needs them.
4. **HARDEN** — design against the named failure modes: the **Ralph Wiggum loop** (fails
   quietly, keeps spending), goal drift, self-preferential bias, comprehension debt, and the
   security tax.
5. **MEASURE** — track the only metric that matters: **cost per accepted change**. Below a 50%
   accepted-change rate, the loop is losing.

The skill's [`references/`](./references) hold the source-faithful rules, tests, building blocks,
failure-mode defenses, and a Codex↔Claude Code mapping; [`templates/`](./templates) and
[`assets/`](./assets) provide ready-to-fill `SKILL.md` / `STATE.md` / `VISION.md` /
automation / verifier-subagent / report scaffolds.

## When to use

Fire proactively — even without the word "loop" — when someone wants to: automate a recurring
agent task, schedule/cron an agent, "run until the tests pass", set up `/loop` / `/goal` / a
routine / an automation, do CI-failure triage / dependency-bumps / lint-and-fix / issue→PR
drafting automatically, run agents in parallel (worktrees), split a maker from a checker, persist
agent state (`STATE.md` / `VISION.md` / `AGENTS.md`), or **audit an existing loop** that fails
quietly, drifts, burns tokens, or ships unreviewed code. It also triggers on the Japanese
equivalents (ループ化 / 自動化したい / エージェントに自分でプロンプトさせたい / 定期実行 /
ループを設計).

Do **not** reach for it for one-off tasks, exploratory work, or anything where "done" is a
judgment call — a single well-aimed prompt still wins there, and the skill will say so.

## Usage

Invoke via the `loop-engineering` trigger or `/loop-engineering`. The skill reads the situation,
runs the five phases in sequence, and consults its `references/` for the source-faithful rule set
before deep work. Stopping at "don't build a loop yet" + what to fix is a valid, intended result.

## References & Attribution

This skill operationalizes a synthesis of public engineering writing; the citations are an
attribution courtesy and do not imply endorsement. The full, source-faithful rule set lives in
[`references/00-rules.md`](./references/00-rules.md).

- **"Loop engineering: the 14-step roadmap from prompter to loop designer"** (Codez / @0xCodez) —
  the synthesizing source whose 14-step roadmap and Plan → Build → Run → Learn lifecycle this
  skill applies as SCAN → ANALYZE → BUILD → HARDEN → MEASURE.
- **Addy Osmani** — the long-form essay on loop engineering: the six-part decomposition (five
  building blocks + **state**), "the agent forgets, the repo does not", and the
  comprehension-debt / cognitive-surrender risks.
- **Anthropic engineering** — the December 2024 evaluator-optimizer pattern that the source
  credits as the origin of the maker/checker split (the vocabulary that went viral in 2026 was
  documented eighteen months earlier).
- **Geoffrey Huntley** — the **"Ralph Wiggum loop"**: loops that emit completion early and fail
  quietly without a hard gate.
- **AlphaSignal** — the honest 4-condition framing and the "most developers don't need a loop
  yet" conclusion that the gate decision is built on.

## License

Released under the MIT License — © 2026 buddypia. See [LICENSE](./LICENSE).

## Disclaimer

This skill produces a recommendation (build a loop, or don't yet) and may propose config — skills,
state files, automations, gates, sub-agents, hooks, and MCP connectors. Treat its analysis and any
generated mechanism as a draft to review: the only true guardrails are objective gates, hard
stops, and human approval before anything irreversible, so confirm the gate actually fails bad
work before relying on a loop. **Never auto-install unaudited skills or connectors** — prompt
injection hides in their descriptions; read the source first.
