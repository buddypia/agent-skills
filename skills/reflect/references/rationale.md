# Reflect — design rationale & sources

This file holds the provenance of the skill's design. It is reference material — the
execution procedure lives entirely in `SKILL.md`.

## Why this procedure — industry pillars

| Pillar | Source | Reflected in |
|----|------|-------------|
| **Blameless postmortem + 5 Whys** | Google SRE / Atlassian | Step 1 system language · Step 2 "people are not the root cause" · Step 8 action tracking |
| **Hierarchy of Controls / Poka-Yoke** | NIOSH / Shingo (Toyota) | Step 4 decision tree (Eliminate > Prevent > Detect > Mitigate) |
| **3-pillar placement frame** | Memory-policy / Hook / Skill | Step 4 ② Hook ④ Skill ⑤ Rule/Memory + ⑥ "no over-engineering" |
| **Reflexion** (Actor–Evaluator–Self-Reflection + memory) | Shinn et al. 2023 | Outer loop — one problem per "trial" + prior ledgers carried as long-term memory |
| **AutoGen Reflection** (Generator–Critic) | Microsoft AutoGen | Inner loop — converge the placement proposal through a Critic approval gate (APPROVE/REVISE) |

## The two source patterns of the dual loop

> Sources: Reflexion — `promptingguide.ai/en/techniques/reflexion` · AutoGen Reflection — `microsoft.github.io/autogen/.../design-patterns/reflection`

| Pattern | Shape | Termination | Memory |
|------|------|----------|--------|
| Reflexion | Actor (generate) → Evaluator (score) → Self-Reflection (verbal feedback) | reward threshold / trial cap | short = current trajectory / long = accumulated reflections |
| AutoGen Reflection | Generator → Critic → revise | `approved` flag (APPROVE/REVISE) | per-session history; prior feedback carried into next generation |

Note: the max-3 inner-iteration cap is **stricter** than the AutoGen source pattern (which
documents no cap). This is deliberate — self-bias amplifies across critique rounds
(Xu et al., arXiv:2402.11436) and Self-Refine's gains concentrate in iterations 1–2. Do not
"fix" the cap back toward the uncapped source pattern.

## What v2.0 changed and the evidence behind it

### Grounded Critic verdicts (per-item PASS/FAIL with evidence; located refutations)
- Intrinsic verbal self-critique degrades outcomes; "assume it is wrong" framing flips
  correct answers unless failure-to-refute defaults to APPROVE — Huang et al., *LLMs Cannot
  Self-Correct Reasoning Yet* (arXiv:2310.01798).
- Error **localization** is the bottleneck: critique works once the error location is named —
  *LLMs cannot find reasoning errors, but can correct them given the error location*
  (arXiv:2311.08516).
- Self-correction works only with reliable **external/mechanical feedback** — Kamoi et al.,
  *When Can LLMs Actually Correct Their Own Mistakes?* (arXiv:2406.01297, TACL 2024).
- The self-correction blind spot is ownership-based: models correct external errors they
  leave uncorrected in their own output — *Self-Correction Bench* (arXiv:2507.02778). Hence
  the Critic restates the proposal as externally submitted material.
- Same-model self-preference persists even in a separate context — *LLM Evaluators Recognize
  and Favor Their Own Generations* (arXiv:2404.13076); *Self-Preference Bias in LLM-as-a-Judge*
  (arXiv:2410.21819). A separate subagent reduces context anchoring; it cannot remove
  self-preference — the evidence-citation requirement carries that weight.

### Scope guard (Critic gate covers Step 4/6 only, never Step 2)
- Self-correction succeeds where verification is easier than generation and decomposable
  into objective sub-checks (tier placement); it fails on open-ended reasoning (causal
  narrative) — Kamoi et al. (arXiv:2406.01297); Huang et al. (arXiv:2310.01798). Step 2
  therefore keeps a *human* agreement gate.

### Executed negative test + positive test on legitimate history
- Reflexion's gains come from **executed** feedback signals (91% HumanEval via executed
  tests), not predicted ones — Shinn et al. (arXiv:2303.11366).
- A control aimed at a rare failure mode mostly intersects legitimate work — Besnard &
  Hollnagel, quoted in Adaptive Capacity Labs' *CritiquesOnRootCause*. The positive test
  turns C3's "zero false-block" from assertion into evidence.
- Noisy gates die: pooled clinician override of drug-interaction alerts is ~90%
  (Health Informatics J 2024; van der Sijs 2006: 49–96%); same trust-erosion mechanism in
  *Flaky Tests at Google*. Silent bypasses are how installed controls rot — Vaughan,
  normalization of deviance. Hence ②-warn, observable override paths, and
  bypassed-prevention as a Step 0 trigger.

### Fail-open hooks (corrected from v1.1's "fail-closed" label)
- Claude Code hooks block **only** on exit code 2 / explicit deny; exit 1, crashes, invalid
  JSON, and timeouts are non-blocking and the tool call proceeds —
  https://code.claude.com/docs/en/hooks. Tier ② must choose its failure mode deliberately
  and record it.

### Recurrence re-opens the prior decision (bounded "don't re-litigate")
- Agents imitate retrieved experience, so one wrong stored decision compounds; future
  outcomes serve as free quality labels on memory — *How Memory Management Impacts LLM
  Agents* (arXiv:2505.16067).
- "Failures that mirror previous incidents — time to dig deeper" — SRE Workbook, ch. 10.
  Recurrence rate is the postmortem-effectiveness truth detector (incident.io: <5% healthy,
  >30% = documentation, not learning).

### Multi-causal Step 2 (occurrence + detection chains; plural root causes)
- "Post-accident attribution to a 'root cause' is fundamentally wrong"; catastrophe requires
  multiple failures — Cook, *How Complex Systems Fail*. Google SRE's example postmortem has
  a plural "Root Causes" field plus separate Trigger and Detection fields.
- Counterfactual phrasing ("should have", "failed to") is hindsight bias, not explanation —
  Allspaw, *The Infinite Hows*; Etsy Debriefing Facilitation Guide (local rationality).

### Memory hygiene (keyword reuse, empty-grep fallback, supersession markers, consolidation)
- Curated retrieval keys, never ad hoc — Voyager (arXiv:2305.16291). Mark obsolete memories
  invalid rather than deleting, to preserve temporal reasoning — Mem0 (arXiv:2504.19413);
  naive DELETE silently destroys information (mem0 issue #4536). Append-only episodic log
  as source of truth; regenerating a consolidated view from raw traces avoids the semantic
  drift of summarizing summaries — SSGM (arXiv:2603.11768).
- Consolidation gating: distill only from episodes judged successful — Agent Workflow Memory
  (arXiv:2409.07429); insight lifecycle with source citations — ExpeL (arXiv:2308.10144);
  Generative Agents cite source records per insight (arXiv:2304.03442). Run off the critical
  path — Letta sleep-time compute.

### Reversibility axis, mitigation companion, detection pairing
- Rate actions by reversibility/write-access and escalate irreversible ones to human gates —
  OpenAI, *A Practical Guide to Building Agents*.
- Every prevention layer has holes — Reason's Swiss cheese model; "a single guardrail is
  unlikely to provide sufficient protection" (OpenAI guide). Irreversible classes pair ①/②
  with an independent ③ detection layer.
- Balance near-term mitigation against long-term elimination; "Focusing on Elimination (at
  the Cost of Mitigation)" is a named SRE anti-pattern — Lunney/Lueder/Beyer, *;login:*
  Spring 2017 (sre.google/static/pdf/login_spring17_09_lunney.pdf).
- Tier ① boundary caution: hard unrepresentability has a documented failure mode across
  producer/consumer or schema-evolution boundaries; prefer parse-at-the-boundary
  (Alexis King, *Parse, don't validate*) + a ③ regression gate.

### Ledger review Y-lite + Next-item follow-up
- "An unreviewed postmortem might as well never have existed" — Google SRE Book ch. 15.
- "The surest way to ensure an action item never gets completed is to leave it without an
  owner"; "the most common shortcoming is lack of follow-up" — Lunney et al. Open `## Next`
  items are checked on every same-class memory read: done now, or closed with a reason —
  never silently carried.

### Authoring/structure (v2.0 restructure)
- Progressive disclosure: lean SKILL.md + `references/` for on-demand detail; copy-off
  checklists ("Copy this checklist into your response and check off items"); frontmatter
  `argument-hint`; version in frontmatter metadata — Anthropic Agent Skills docs
  (code.claude.com/docs/en/skills) and best practices; agentskills.io spec.
