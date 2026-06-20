---
name: reflect
description: |
  Run a fact-based, blameless incident retrospective that turns a bug, near-miss, repeated friction, or AI self-correction into root cause, fix placement, cure, prevention, verification, and a written ledger. Use when the user asks for a retrospective, postmortem, root-cause analysis, recurrence prevention, "make sure this never happens again", "why did this happen", "reflect", or incident analysis; also use proactively after a merged bug, repeated friction, near-miss, or self-correction.
argument-hint: "[incident description (optional)]"
metadata:
  version: "2.0"
  review_interval_days: 90
---

# Reflect — Incident Reflection & Fix-Placement Routing

> **Core idea**: "Prevention over Detection — pick the highest control tier first. But never over-engineer a one-off (⑥ 'do nothing structural' is a first-class option)."
>
> If your project keeps a companion *policy* rule for incident routing, keep the policy/decision-tree there and treat this skill as the **execution-procedure SSOT**. Standalone, this skill is self-contained.
>
> Design rationale and sources: `references/rationale.md`.

When a problem appears (incident / repeated friction / near-miss / AI self-correction), fire immediately while context is fresh and close **root cause → fix placement → cure + prevention → ledger**. The 8 steps below are "what to do per problem"; two nested loops wrap around them.

---

## Iterative Refinement Loop (why "step by step", not "all at once")

Both source patterns (Reflexion, AutoGen Reflection — see `references/rationale.md`) share: **"generate → critique (against criteria) → stop at an approval gate, else refine and repeat"** + **carry prior reflections forward as memory**.

**Scope guard**: the Generator–Critic gate covers **only Step 4/6 placement** — a rubric-verifiable, decomposable judgment. The Step 2 causal narrative is open-ended reasoning where LLM self-critique is unreliable; it gets a **human agreement gate** (collaboration Phase 2) instead. Do not extend the inner loop to Step 2.

```
[Outer loop — Reflexion "trials" · step by step]
  0 trigger → 1 facts (blameless) → 2 5 Whys → 3 class, then per problem:
  · Handle problems one at a time, by priority (NO batch — don't fix everything at once)
  · On entry, read long-term memory: scan prior ledgers
        e.g. grep -l "<class keyword>" <ledger-dir>/retro-*.md → compare same-class Decisions
    · Empty grep is suspect, not proof of a new class: before minting a new keyword, list
      existing ones (grep -A1 -h '^## Class' <ledger-dir>/retro-*.md) or grep 1–2 synonyms;
      REUSE an existing class keyword when it fits — mint new only when none does.
    · While reading same-class ledgers, also check their ## Next for open "- [ ]" items:
      do them now, or close them with a one-line reason in the new ledger's Next —
      never silently carry.
    · If a same-class ledger you rely on is older than review_interval_days, re-run its
      ## Verify cmd before trusting its Decision; if it fails → new Step 0 near-miss (gate gap).
    → carry past tier decisions forward; don't re-litigate ("why this tier" rationale) —
      UNLESS the recurrence check below falsifies the prior decision
    → RECURRENCE CHECK: if a prior same-class ledger's Decision installed tier ①–⑤, confirm
      (i) the new incident actually falls inside that ledger's ## Class definition (a keyword
      grep hit alone is NOT confirmation) and (ii) the prevention was implemented and active
      at incident time. Both hold → the prior prevention is falsified: do NOT carry its
      decision forward; Step 2's first Why becomes "what made it possible for this to recur
      despite the prevention"; the Generator's default proposal is a higher tier (re-proposing
      the same tier requires explaining the observed failure mode). The Critic gate (esp.
      C2/C4) still decides — recurrence licenses re-litigation, not automatic escalation.
    │
    └─[Inner loop — AutoGen Generator–Critic · approval gate]
         Generator : propose the Step 4 tier + Step 6 prevention design
                     + a named concrete violating input (feeds C5 and Step 8)
                     + a maintenance-cost enumeration: who/what updates the mechanism, what
                       breaks when stale, expected trigger frequency per the ledger grep (feeds C4)
         Critic    : evaluate with the Critic checklist below → APPROVE / REVISE (+reason)
         Gate      : REVISE names the violated C# + one concrete redirection (this is what
                     the ledger's "Rejected tiers + reason" records) → Generator re-proposes
                     APPROVE → exit to implementation
         Stuck     : in round 2+, the Critic's FIRST check is the diff vs the prior proposal —
                     same tier + same mechanism with cosmetic rewording = a failed round;
                     the same C# firing twice consecutively → escalate to human now (skip round 3)
         Stop      : approved OR inner iterations max 3
                     (no convergence → escalate to human approval, collaboration Phase 4)
    │
  Step 5 cure + Step 6 prevent + Step 8 negative test
  Self-Reflection : record the final approved rationale + rejected REVISE reasons in the Step 7
                    ledger Decision (accumulates as long-term memory → read by the next problem)
  → next problem (re-enter outer loop)
```

### Critic checklist (the approval gate — criteria for the Step 4 placement)

The Critic interrogates the Generator's placement proposal. Any hit → **REVISE** (the gate *uses* tiers ①–⑥ without redefining them):

| # | Critic question | REVISE trigger |
|---|------------|--------------|
| C1 | Highest applicable tier? (① Eliminate > ② Hook > ③ Gate ...) | a higher tier could prevent it but a lower one was chosen |
| C2 | Not over-engineered? (is ⑥ "do nothing" the right answer?) | a one-off / low-risk case is getting a new hook/rule |
| C3 | If ② hook: zero risk of false-blocking legitimate work? | false-block possible → need the signal at the moment of action? ②-warn; gate-time is enough? ③ |
| C4 | Prevention value > future maintenance cost? | maintenance-cost enumeration missing, incomplete, or negative ROI |
| C5 | Can the prevention be shown to fail on a concrete, named violating input? (N/A for ⑤/⑥ — no executable gate) | no concrete violating input named, or an unverifiable "I blocked it" claim |
| C6 | No contradiction/duplication vs prior ledgers? (long-term memory) | unexplained conflict with a prior Decision; OR the class recurred after a ①–⑤ prevention and the proposal reuses the failed tier without explaining its failure. Exception: new evidence justifies a higher tier → APPROVE only with the `Superseded-by:` back-edit on the old ledger |

**Verdict format** (full path only — the lightweight path keeps its one-pass, C2-only verdict): before issuing APPROVE/REVISE the Critic emits six lines, `C1: PASS/FAIL — evidence` … `C6: PASS/FAIL — evidence`. A holistic verdict-first judgment is invalid. Evidence rules:
- **C6** — quote the matched Decision lines from the outer-loop ledger grep (or write `0 matches`); if that grep was not actually run, run it now — never answer C6 from memory.
- **C5** — PASS requires the violating input named in the Generator's proposal; if none is named, REVISE for that reason alone.
- **C4** — the Critic verifies the Generator's maintenance-cost enumeration is complete and consistent with the C6 grep frequency; it does not re-judge ROI by feel.

All pass → **APPROVE** → Steps 5/6/8.

**Critic independence (the core of both source patterns = separating generation from evaluation)**:
- **Adversarial default (always)**: the Critic assumes "this proposal is wrong" and tries to refute it via C1–C6; only when refutation fails does it APPROVE — so the Generator doesn't defend its own answer. A hunch is not a refutation: a REVISE is valid only if it names (1) the violated C-item, (2) the exact part of the proposal that violates it, and (3) a concrete violating scenario or counter-example. Adversarial framing biases toward manufacturing objections — a correct ⑥ (do-nothing) proposal must not be upgraded without such a located refutation. The Critic begins by restating the proposal as externally submitted material ("A proposal was submitted: …"), not as a continuation of the Generator's narrative.
- **High-risk placements or classes (① schema redesign · ② new hook · Step 3 class = irreversible/externally visible)**: run the Critic in an **independent context** to reduce context anchoring (same-model self-preference persists even in a separate context — the evidence rules above carry that weight). Run it as a Task-tool subagent (strongest available reasoning model, e.g. opus) and require the full C1–C6 refutation reasoning BEFORE stating APPROVE/REVISE. Still no convergence after 3 → human approval (collaboration Phase 4).

> **Lightweight path (avoid over-engineering)**: for a genuine one-off / low-risk case (Step 3 anticipates ⑥), shorten the inner loop to **one pass** — the Critic only needs to clear C2 (over-engineered?), then record and proceed. The loop itself must not become the over-engineering.

---

## Execution protocol (required)

### Pre-flight checklist (before running)

Copy this checklist into your response and check off items as you complete them:

- [ ] 1. Trigger confirmed (merged-bug / repeated-friction 2x+ / near-miss or bypassed prevention / AI self-correction / user-explicit)
- [ ] 2. Evidence gathered (relevant PR/diff/log/command output — precondition for a fact-based retro)
- [ ] 3. Work in an isolated branch/worktree (required for governance changes)

→ Proceed only when all checked. Any unchecked → stop + report why.

### Post-flight checklist (after running)

Copy this checklist into your response and check off items as you complete them:

- [ ] 1. Ledger `<ledger-dir>/retro-<date>-<slug>.md` written (all 9 sections of `references/ledger-template.md`)
- [ ] 2. Decision section states the tier + "why this tier" rationale (prevents re-litigation)
- [ ] 3. All existing instances cured (not prevention-only)
- [ ] 4. Negative test EXECUTED; observed output recorded in the ledger (+ positive test for blocking gates)
- [ ] 5. Governance change → separate single-purpose PR + rationale in body
- [ ] 6. Inner Generator–Critic loop converged to APPROVE (max 3; else human escalation; one-off uses the lightweight single pass)
- [ ] 7. Superseded a prior decision → old ledger back-edited with `Superseded-by:` pointer (N/A when no supersession)

→ All checked → report done. Any unchecked → fix and re-verify.

---

## The 8 steps in detail

### Step 0 — Trigger check
Confirm it's one of the five. If none, no retro needed → stop.
merged bug / same friction 2x+ / near-miss (gate gap, or an installed prevention overridden/bypassed/disabled — `--no-verify`, hook removed, gate skipped) / AI self-correction / user-explicit request.
If arguments name an incident, take it as the trigger candidate; otherwise identify the most recent qualifying trigger.

### Step 1 — Fact-finding (blameless)
- Lay out the timeline + evidence (PR/diff/log/command output) in **system language**.
- Not "who" but "what / how". No sentences that blame a person as the subject. Also no counterfactual or judgment phrasing in **any** sentence, system-subject included ("should have", "failed to", "forgot to", "obviously", "careless") — state what happened, and phrase causes as "what made X possible".

### Step 2 — 5 Whys → root cause (opus)
- Start at the proximate cause and go down to "the point that blocks this **class**".
- Run a second short chain for **detection**: "what made this go uncaught until now?" — that chain is where tier-③ candidates surface. Multiple root causes are normal (SRE's field is "Root Causes", plural); mark every class-blocking point. For a ⑥-bound one-off, one line suffices ("no gate exists; none warranted").
- Ground each Why link in Step 1 evidence where possible; a link with no artifact behind it is a **hypothesis** — verify it or label it as such before it drives the Step 4 tier.
- **Gate**: stopping at "the AI was careless" / "a human slipped" is incomplete. Go to "why was that slip even possible by design?" — and "what made the action locally rational at that moment (context contents, ambiguous instruction, missing tooling)?".
- Example: "my grep was wrong" → "why did the first pass use a single pattern that missed the inline case" → "existence verification isn't mechanized, so it relied on manual grep".

### Step 3 — Class
- One-off, or a recurring **class**?
- Blast radius: code / rules / data SSOT / deploy?
- Reversibility of the failure action: read-only / reversible write / **irreversible write or externally visible effect**. (This one field is consumed by ②'s "high severity", the independent-Critic trigger, and the Phase-4 "high-risk" gate.)
- If one-off / low-risk, anticipate landing on ⑥ (do nothing structural) at Step 4.

### Step 4 — Placement decision tree (opus) — the heart of the skill

> **Runs inside the inner loop**: the **Generator** proposes a tier with the tree below; the **Critic checklist (C1–C6)** above interrogates it as the approval gate. REVISE → re-propose with the critique; APPROVE → Step 5. (max 3 → human approval)

Evaluate top-down, take the **highest applicable tier** (prevention > detection):

```
① Make the invalid state structurally unrepresentable? → type/schema/API redesign (Eliminate, strongest)
     e.g.: a type-level oracle, a strict filename regex gate
     (boundary caution: strongest for invariants fully internal to this system; for states
      crossing a producer/consumer or schema-evolution boundary, prefer parse-at-the-boundary
      + a ③ regression gate — C1 may cite this to revise DOWNWARD.)
② If not, block at every tool call with no judgment / objective decision? → PreToolUse Hook
     (blocks ONLY on exit 2; hook errors/timeouts fail OPEN — the tool call proceeds)
     e.g.: a commit guard, a path/policy guard
     conditions: high severity (= Step 3 class is an irreversible write or externally visible
                 effect) + decidable exactly + zero false-block of legitimate work
     ②-warn: warn-mode PreToolUse/PostToolUse feedback — immediate in-session signal, zero false-block
③ Blocking at CI/test/gate time (not tool time) is enough? → check script / test gate (Detection)
④ Needs a context-dependent multi-step procedure / judgment? → Skill
     e.g.: this /reflect, a final-review skill
⑤ A standing advisory policy every session must know + not machine-checkable? → a Rule, or one line in the agent memory file (keep it light!)
⑥ One-off, low recurrence risk, a better prompt is enough? → no structural mechanism, record only (anti over-engineering)
```

**Decision aids**:
- ② vs ③: must it be blocked the **moment** a tool is created (②), or is a commit/PR/CI **gate** not too late (③)? Latter → ③ (lighter than a hook, lower false-block risk).
- ⑤ vs ⑥: a recurring **class** → ⑤ (Rule); a true one-off → ⑥.
- **If any false-block risk exists**: need the signal at the moment of action → ②-warn; gate-time is enough → ③. Blocking legitimate work is a hook's worst failure.
- Combine: Step 3 class = irreversible/externally visible → the chosen ①/② prevention **MUST** be paired with an independent ③ detection layer (every prevention layer has holes — Swiss cheese). For all other classes, ① + ③ remains the most robust common pair but stays optional.
- Mitigation companion: the tree is prevention/detection-only — when the approved tier is slow to land (① redesign) or weak (⑤/⑥), also evaluate a cheap, immediately-landing mitigation (isolated worktree, narrowed permissions, backup / fast revert) so the plan balances near-term and structural (SRE anti-pattern: "focusing on elimination at the cost of mitigation").

### Step 5 — Cure existing instances
- Find **all** current instances of the same class (grep/search exhaustively) and fix them.
- Prevention while leaving instances behind isn't a closed loop.

### Step 6 — Build the prevention mechanism
- Implement at the tier Step 4 chose.
- Tier ②: a hook's internal failure does not block (fail-open). Choose the failure mode deliberately — accept fail-open (risk: silent rot) or convert internal errors to exit 2 (risk: false-blocking legitimate work, weigh against C3) — and record the choice + rationale in the ledger Decision.
- Tier ②/③: design an observable override path (bypass requires a logged reason or a flag visible in the PR) — this is what makes the bypassed-prevention trigger in Step 0 fire-able.
- Tier ⑤: verify the rule line actually **landed** — grep the memory/rule file for the new line and record the match in the ledger (the only tier whose output Step 8 can't negative-test).
- Adding a governance line (rule/hook/script) → prefer a **separate single-purpose PR**.
- For a new mechanism, an ROI (KISS/YAGNI) self-check is recommended.

### Step 7 — Ledger
Read `references/ledger-template.md` and write the filled copy to `<ledger-dir>/retro-<YYYY-MM-DD>-<slug>.md` (all 9 sections). Decision must state the tier + why-this-tier + rejected REVISE reasons; put the stable class keyword on the first line under `## Class`.
- **Self-Reflection carry-over**: the **rejected REVISE reasons** (1–2 lines) — "why the other tiers weren't chosen" — become long-term memory that the next problem's Critic C6 reads.
- **Stable class keyword**: reuse the keyword found by the outer-loop memory read; mint new only when none fits. If this Decision supersedes a prior ledger's tier for the same class, append exactly one line to the OLD ledger's Decision section — `Superseded-by: retro-<date>-<slug>.md` — never rewrite or delete the old ledger.
- **Consolidation (episodic → semantic)**: when ≥3 ledgers share a class keyword, distill the repeated Decisions into one compact tier-⑤ rule line. Eligibility: only ledgers whose negative test passed and that were not falsified by recurrence. The rule must cite its source ledger filenames (so a future C6 verifies instead of trusts). Regenerate from the raw ledgers each time — never summarize a previous summary. Do this inside a retro, never as a session hook.

### Step 8 — Loop closure (negative test)
- **EXECUTE** the negative test: run the violating input against the gate and confirm it fails (exit code / message). Record 1–3 lines of the actual observed output in the ledger `## Prevent` — a predicted or claimed failure is not closure.
- If the gate does NOT fail as predicted: the loop is not closed. Implementation bug → fix the gate (Step 6) and re-run. If the mismatch shows the chosen tier cannot actually decide/block this case, return to Step 4 as a fresh decision, with the observed output as Critic evidence.
- For blocking gates (② and blocking ③), also run the **positive test**: run the gate's predicate against recent legitimate history (last N commits / tool calls / existing tree; fallback when no representative history exists: documented sample legitimate inputs) and record `positive test: <history sample> → 0 false-blocks` under the negative-test line.
- For tier-② hooks: pipe a sample PreToolUse JSON into the script and assert exit code 2; because hook errors fail open, also confirm what happens when the hook itself breaks (e.g., dependency missing) — or record in the ledger why that simulation is impractical.
- N/A when the fix is data/metadata alignment rather than a blocking gate (record this honestly).

---

## Collaboration pattern

| Phase | Driver | AI role | Human role | Approval gate |
|-------|------|---------|-----------|:-----------:|
| 1 fact-finding | AI | organize evidence | add context | N |
| 2 5 Whys | Both | propose the causal chain | agree on root cause(s) + fix point | Y |
| 4 placement | Both | Generator proposal + Critic gate | approve the tier (Step 3 irreversible class / non-convergence) | Y |
| 5·6 cure+prevent | AI | implement + negative test | code review | N |
| 7 ledger | AI | write + present a 5-line digest (causes · tier + why · negative-test output · open Next items) | review the digest — "an unreviewed postmortem might as well never have existed" | Y-lite |

---

## Constraints

| Constraint | Why | On violation |
|------|------|--------|
| New Hook only when tier ② explicitly warrants it | a hook is itself future debt | re-evaluate ⑥/③ |
| No Stop-hook "scan every session" retro automation | pollutes unrelated session context | intent-driven only |
| No omitting the Decision rationale | endless re-litigation next retro | reject the ledger |
| No "I blocked it" without an EXECUTED negative test; no blocking gate without a positive test on legitimate history | loop not closed / silent false-blocks erode trust in the gate | re-run Step 8 |
| Governance changes → isolated branch/worktree + separate PR | revert protection | split before shipping |
| Inner loop must not exceed max 3 | self-bias amplifies across critique rounds — the cap is deliberate, never raise it | escalate to human approval |
| No full loop for a true one-off | the loop itself becomes over-engineering | lightweight path (Critic C2 only) |
| Ledgers are append-only; supersession = one `Superseded-by:` pointer line | deleting/rewriting old decisions destroys the temporal memory C6 reads | restore the old ledger, mark with pointer |

---

## References

- `references/ledger-template.md` — the 9-section ledger template (read it at Step 7)
- `references/rationale.md` — design rationale, industry pillars, and research sources
