# Reflect — Incident Reflection & Fix-Placement Routing

A pure-prompt skill that turns a bug, near-miss, repeated friction, or AI self-correction into a
fact-based, blameless retrospective: root cause → fix placement → cure + prevention → a written
ledger. It runs entirely in the host agent's context — no external CLIs, no setup.
For the skill definition (invocation summary), see [SKILL.md](./SKILL.md).

## What it does

When a problem appears, `reflect` fires while context is fresh and closes the loop in 8 steps,
wrapped by two nested loops:

```
[Outer loop — Reflexion "trials"]  trigger → facts (blameless) → 5 Whys → class →
  per problem (one at a time, by priority), carry prior ledgers forward as memory
    └─[Inner loop — Generator–Critic gate]  propose fix tier → critique (C1–C6) →
         APPROVE / REVISE (max 3) → cure + prevention + executed negative test → ledger
```

The heart is the **placement decision tree** (Step 4): pick the highest applicable control tier —
① Eliminate (make the bad state unrepresentable) > ② Hook > ③ Gate/CI > ④ Skill > ⑤ Rule/Memory
> ⑥ do nothing structural — with **anti-over-engineering** built in (⑥ is a first-class option).
A Generator proposes the tier; an adversarial Critic interrogates it against six criteria before
approving. The result is recorded in an append-only ledger that becomes long-term memory for the
next retrospective.

## When to use

Use when the user asks for a retrospective, postmortem, root-cause analysis, recurrence
prevention, "make sure this never happens again", "why did this happen", "reflect", or incident
analysis — and proactively after a merged bug, repeated friction (2×+), a near-miss or bypassed
prevention, or an AI self-correction. Do **not** run a full loop for a true one-off; it uses a
lightweight single-pass path so the loop itself never becomes the over-engineering.

## Usage

Invoke via the `reflect` trigger (optionally naming the incident, e.g. `/reflect <description>`).
The skill copies a pre-flight checklist into its response, runs the 8 steps, and writes a filled
ledger to `<ledger-dir>/retro-<YYYY-MM-DD>-<slug>.md`. It presents a short digest for human
review before closing — an unreviewed postmortem might as well never have existed.

## References & Attribution

This skill is an original implementation; its **design was inspired by the ideas and processes**
of the published work below. Methods and ideas are not subject to copyright — these citations are
a scholarly courtesy and do not imply endorsement. Full provenance, the evidence behind each
design choice, and the complete source list live in
[`references/rationale.md`](./references/rationale.md).

- **Blameless postmortem + 5 Whys** — Google SRE / Atlassian (system language; people are not
  the root cause; action tracking).
- **Hierarchy of Controls / Poka-Yoke** — NIOSH / Shingo (Toyota) (Eliminate > Prevent > Detect
  > Mitigate decision tree).
- Shinn, N., et al. (2023). *Reflexion: Language Agents with Verbal Reinforcement Learning.*
  NeurIPS 2023 (arXiv:2303.11366). https://arxiv.org/abs/2303.11366 — the outer "trials" + memory loop.
- **AutoGen Reflection** (Microsoft) — the inner Generator–Critic approval gate.
- Huang, J., et al. (2023). *Large Language Models Cannot Self-Correct Reasoning Yet*
  (arXiv:2310.01798). https://arxiv.org/abs/2310.01798 — why critique needs grounded, located refutations.
- Kamoi, R., et al. (2024). *When Can LLMs Actually Correct Their Own Mistakes?* TACL 2024
  (arXiv:2406.01297). https://arxiv.org/abs/2406.01297 — self-correction needs reliable external feedback.

## License

Released under the MIT License — © 2026 buddypia. See [LICENSE](./LICENSE).

## Disclaimer

This skill produces a retrospective and may propose governance changes (hooks, gates, rules).
Treat its analysis and any generated prevention mechanism as a draft to review — it does not
guarantee a correct root cause, and prevention should always be confirmed with an executed test
before you rely on it.
