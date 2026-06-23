# Claude Code Steering — Instruction Routing & Config Audit

A pure-prompt skill that decides **where a Claude Code instruction should live** and **audits an
existing `.claude` config** against the official steering model. It runs entirely in the host
agent's context — no external CLIs, no setup. For the skill definition (invocation summary), see
[SKILL.md](./SKILL.md).

## What it does

Claude Code has **7 mechanisms** for steering its behavior — `CLAUDE.md` / rules / skills /
subagents / hooks / output styles / `--append-system-prompt`. The same instruction behaves very
differently depending on *where you put it*: **when it loads, whether it survives compaction, how
many tokens it keeps costing, and how strongly it gets followed**. This skill takes the decision
model from Anthropic's [Steering Claude Code](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more)
blog and runs it in two modes:

- **ROUTE** — given a new instruction or behavior you want to make permanent, pick the single
  right mechanism via the **4-axis decision table** (load timing / compaction / context cost /
  authority) plus an anti-pattern check, and return the location with a minimal implementation.
  Core rule: *every instruction has a home* — chosen by the 4 axes and one question, "does this
  need to be deterministic?", not by topic. "Don't write it at all" stays on the table.
- **AUDIT** — scan an existing project's config (`CLAUDE.md` / `.claude/rules` / `.claude/skills`
  / `.claude/agents` / `.claude/output-styles` / `settings.json`), detect misplacements (a
  bloated `CLAUDE.md`, an unscoped domain rule, a 30-line procedure that should be a skill, an
  output style that clobbers the default coding instructions, CLAUDE.md∧hook duplication), and
  present a refactor plan as a findings table grounded in real file quotes — fixes applied only
  after you approve.

## When to use

Fire — even without the word "steering" — when someone asks **where an instruction should go**
("CLAUDE.md vs rule vs skill vs hook vs subagent vs output style", "make this behavior
permanent"), wants to **tidy up / audit a `.claude` config** ("CLAUDE.md has bloated", "Claude
ignores a rule", "review my config against the docs"), or hits a symptom of a misplaced
instruction ("make X run every time", "never let Claude do X", "context feels heavy"). Do **not**
fire for ordinary code implementation, bug fixing, or general session workflow (explore → plan →
implement, `/clear` strategy) — that belongs to the sibling `claude-code-best-practices`.

## Usage

Invoke via the `claude-code-steering` trigger. The skill reads the situation, applies the 4-axis
routing table (see [`references/mechanisms.md`](./references/mechanisms.md) for the precise
per-mechanism details), and for AUDIT scans first, then reports — following the detection
signatures and report template in [`references/audit-playbook.md`](./references/audit-playbook.md).

## References & Attribution

This skill operationalizes Anthropic's **official guidance**; the decision model and the
"symptom → right mechanism" anti-patterns are translated from the source below and applied to the
user's concrete files. The citations are an attribution courtesy and do not imply endorsement.

- **Anthropic — *Steering Claude Code: skills, hooks, rules, subagents, and more*** (the source
  blog): https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more — the
  7-mechanism model, the 4 axes (load timing / compaction / context cost / authority), and the
  Quick-tips anti-pattern map.
- **Claude Code official docs** — per-mechanism specifics referenced in
  [`references/mechanisms.md`](./references/mechanisms.md):
  [skills](https://code.claude.com/docs/en/skills),
  [memory](https://code.claude.com/docs/en/memory),
  [hooks](https://code.claude.com/docs/en/hooks),
  [sub-agents](https://code.claude.com/docs/en/sub-agents).

## License

Released under the MIT License — © 2026 buddypia. See [LICENSE](./LICENSE).

## Disclaimer

This skill produces a placement recommendation and may propose config changes (hooks, rules,
permissions, output styles, skills). Treat its analysis and any generated mechanism as a draft to
review — the official guidance evolves, and the only true guardrails are hooks and permissions, so
confirm enforced behavior actually fires before relying on it. In AUDIT mode it reads your config
files; review the proposed refactor before applying it.
