# The tests, the checklists, the economics, the mistakes

This is the decision machinery of Phase 1. Apply it literally and honestly. The most common way this skill fails is talking the user *into* a loop the project can't support — these tests exist to stop that.

---

## A. The 4-condition test (strategic — decide per project / task class)

> "Loops earn their cost under four conditions. **Miss one and the loop costs more than it returns.**"

| # | Condition | Passes when… | Fails when… → consequence |
|---|-----------|--------------|----------------------------|
| 1 | **The task repeats** | The work recurs **≥ weekly** | One-time/rare → setup never amortizes; a good prompt is faster & cheaper |
| 2 | **Verification is automated** | A test / type-check / lint / build can **fail the work with no human in the room** | No automated check → you're back in the chair reading every diff — the job the loop was meant to remove |
| 3 | **Token budget can absorb the waste** | Retries, re-reads, exploration are affordable | Metered/consumer plan → rate limits or a surprise invoice; "reckless" |
| 4 | **Agent has a senior engineer's tools** | Logs + reproduction env + can run code and see what breaks | No repro/observability → the loop iterates **blind** |

**Decision:** all four pass → proceed to test B. **Any miss → KEEP MANUAL.** Report *which* condition failed and the concrete remedy (e.g. "Condition 2 fails: no test suite on `src/orders` — add coverage first, then revisit").

---

## B. The 30-second loop check (tactical — decide per concrete task)

Run on a *specific* task after it clears test A. **Miss one box → keep it a manual prompt.**

- [ ] **1. Cadence** — happens **at least weekly**. (Less → setup cost never amortizes.)
- [ ] **2. Rejectable** — a test, type-check, build, or linter **can reject** bad output. (Else the agent grades its own homework.)
- [ ] **3. Runnable** — the agent **can run the code it changes**. (No repro env → blind iteration.)
- [ ] **4. Hard stop** — token budget, iteration count, **or** time limit. (Else it runs until someone notices the bill.)
- [ ] **5. Human approval gate** — a human **reviews before merge, deploy, or dependency changes**. (Anything irreversible needs human sign-off before action.)

---

## C. Who-wins economics (sanity-check before building)

> "The economics are not universal. Loops favor whoever can spend."

**Build (good fit):**
- Repetitive, machine-checkable work **with the budget** to run it — continuous test triage, dependency bumps, lint-and-fix, issue→PR on strong coverage.
- Codebases with **strong existing test suites** — "if a junior could do it from a checklist and a test suite would catch their mistakes, a loop fits."
- Async-first teams already using multi-agent patterns — routines are their missing orchestration layer.

**Skip for now:**
- **Solo builders on consumer plans** — the token bill arrives before the productivity gain.
- **Code with no automated verification** — a loop with no real check is the agent agreeing with itself on repeat.
- **Teams whose real constraint is review capacity**, not typing speed — a loop generates more code, so it just makes the review queue longer.

> For one-off tasks, exploratory work, or anything where "done" is a judgment call, **a single well-aimed prompt still wins.**

---

## D. Candidate classification (the Phase 1 deliverable)

Produce a table. Each recurring-work candidate from the SCAN lands in exactly one column.

| Task | Test A result | Test B result | Verdict | If KEEP MANUAL: which box + remedy |
|------|---------------|---------------|---------|------------------------------------|

**Good first loops** (favor these): CI-failure triage (nightly), dependency-bump PRs (weekly), lint-and-fix passes (on PR-open), flaky-test reproduction (loop until a theory survives), issue→PR drafts on well-tested code.

**Never auto-loop** (always KEEP MANUAL, regardless of tests): architecture rewrites, auth/payments code, production deploys, vague product work, anything where "done" is a judgment call.

> If **nothing** qualifies, the correct deliverable is "don't build a loop yet" + the shortest path to qualifying (usually: add automated verification). Stopping here is a success.

---

## E. The money-pit mistakes (audit an existing loop against these)

When AUDITing a loop that already exists, check every item. Each maps to a defense in `03-failure-modes.md`.

1. **No 4-condition test was run.** → Run it now (Section A). Most loops fail ≥1 condition.
2. **No objective gate.** A second agent asked to "review" without a test/type-check/build is just a second optimist. → add a real gate.
3. **One agent writes *and* verifies.** Self-preferential bias — the maker grades its own homework "A+." → split maker/checker (`templates/verifier-subagent.md.template`).
4. **No state file.** Tomorrow's run restarts from zero. → add `STATE.md` (`templates/STATE.md.template`).
5. **Vague stop conditions.** "Done when it looks good" never holds. → a test, a type pass, or a passing build.
6. **No token-budget cap.** Without a cap, ambitious loops burn **5–10×** expected tokens. → set a hard stop.
7. **Consumer plan + heavy verification.** Token bill or rate limit gets you. → move to an unmetered plan or shrink the loop.
8. **Auto-installing community skills.** **520 of 17,022** audited skills leak credentials. → read the source before installing.
9. **Loops on judgment-call work.** Architecture, auth, payments, vague product. → keep loops on lint-and-fix, not strategy.
10. **Not reading the diffs.** Comprehension debt at compound interest. → read them; spot-check gates.

---

## F. The metric (Phase 4)

Track **cost per accepted change** — *not* tokens spent, tasks attempted, or loops scheduled. Companion figures: accepted count, **reject rate**, MTTA, lead time. Worked example from the source's MVL dashboard: `COST/ACCEPTED $12.37 · ACCEPTED 128 · REJECT RATE 17% · MTTA 14.2 min · LEAD 6.8 hr`.

> **Accepted-change rate < 50% → the loop is losing.** You're doing the review work the loop was supposed to save. Tighten the gate, narrow the task, or retire the loop.
