# Ledger template

Write the filled copy to `<ledger-dir>/retro-<YYYY-MM-DD>-<slug>.md`. All 9 sections are required.

````markdown
# Retro <YYYY-MM-DD> — <one-line title>

## Trigger
(which of the five triggers + the direct cause, 1–2 lines)

## Facts
(timeline + evidence PR/diff/log. System language — no blaming a person,
no counterfactual or judgment phrasing: "should have", "failed to", "obviously")

## 5 Whys → Root Cause
1. Why ... → ...
2. Why ... → ...
...
**Root cause(s) (the class-blocking point(s)):**
occurrence: ... · detection: ... (or "detection: N/A — one-off, no gate warranted")

## Class
<stable class keyword on this first line>
recurrence_of: <prior ledger filename, or none>
(one-off / recurring class + blast radius + reversibility of the failure action)

## Decision
- Tier: one of ①–⑥ (+ combination)
- **Why this tier:** (rationale — so the next session doesn't re-litigate)
- Rejected tiers + reason (the inner loop's REVISE reasons: violated C# + redirection):
- (tier ② only) hook failure mode: fail-open accepted / internal errors converted to exit 2 — why:

## Cure (existing instances)
- [x] <instance> — PR #...

## Prevent (prevention mechanism)
- <new gate/rule/skill> — PR #...
- negative test: <violating input> → 1–3 lines of the ACTUAL executed failure output (or "N/A — metadata alignment")
- positive test (blocking gates only): <legitimate-history sample> → 0 false-blocks

## Verify cmd
```bash
<reproducible verification command>
```
(must be standalone re-runnable — no session state — so a future audit can execute it)

## Next
(deferred follow-ups ONLY — cure/prevention happen in Steps 5/6, never here)
- [ ] <verb-first action> — <observable done-condition>
(or "none")
````

Notes:

- **Stable class keyword** (`## Class` first line) is the grep key for the outer loop's
  memory lookup — reuse an existing keyword when the class matches; mint new only when none fits.
- **`recurrence_of`** is always present (even as "none") so repeat rate is computable by
  grep across ledgers (industry benchmark: repeat rate <5% healthy; >30% means retros are
  producing documentation, not learning).
- Ledgers are **append-only**. The only permitted back-edit is appending one line to a
  superseded ledger's Decision section: `Superseded-by: retro-<date>-<slug>.md`.
