# Failure modes & defenses — the Phase 3 (HARDEN) checklist

A loop runs while no one is watching, so **the verifier you trust is the only reason you can walk away.** Walk every item below and confirm the defense is in place before a loop runs unattended. Each is a measured/named failure mode from the source material.

---

## 1. The Ralph Wiggum loop — loops that fail quietly

Named by engineer **Geoffrey Huntley**. An agent meant to emit a completion token *only when finished* emits it **early**, and the loop exits on a half-done job. **Without a hard gate, loops fail quietly and keep spending.**

It happens when **all three** are true:
- **No real verifier** — just a second agent asked to "review," no objective signal. Two optimists agreeing.
- **Soft completion conditions** — "done" defined by the agent's judgment, not a test/build/type-check.
- **No hard stops** — the loop runs until something *external* kills it (rate limit, you noticing) instead of until success is *verified*.

**Defense:** an **objective gate** — a test that passes/fails, a build that compiles or doesn't, a linter returning zero/non-zero. **Not a verifier that has an opinion.** Plus a **hard stop** (budget / iteration count / time). If the loop can't say a hard "no," it will say a soft "yes."

> Audit question: *"What single objective signal makes this loop stop? Name the command and its exit code."* If the answer is "the agent decides," it's a Ralph Wiggum loop.

---

## 2. Goal drift over long sessions

Each summarization/compaction step is **lossy**; "don't do X" constraints quietly disappear around turn 47. The loop is still running, just no longer toward the original goal.

**Defense:** a standing **`VISION.md` / `AGENTS.md` reread every run.** State tells the agent *where it is*; the spec tells it *where to go*. The spec must restate the non-negotiable constraints (the `## Never do` list) so they survive compaction.

---

## 3. Self-preferential bias

The agent that wrote the code is **too nice grading its own homework** — it's always "A+."

**Defense:** a **separate verifier sub-agent with no exposure to the maker's reasoning**, sometimes a different (stronger) model on higher effort. This is the evaluator-optimizer split (`templates/verifier-subagent.md.template`). The `/goal` checker model must not be the maker model.

---

## 4. Agentic laziness

The loop declares **"done enough"** at partial completion.

**Defense:** **`/goal` with an objective stop condition checked by a fresh model.** "All tests in `test/auth` pass and lint is clean" is checkable; "the auth flow is fixed" is not.

---

## 5. Comprehension debt & cognitive surrender

The failure mode that gets **sharper as the loop gets better, not worse.**
- **Comprehension debt** — the faster the loop ships code you didn't write, the larger the gap between what the repo *contains* and what you *understand*. The expensive day isn't the token bill; it's debugging a system **no one on the team has read.**
- **Cognitive surrender** — the pull to stop forming an opinion and accept whatever the loop returns. Designing the loop is the **cure** with judgment, the **accelerant** when done to avoid thinking. Same action, opposite result.

**Defenses are not technical:**
- **Read the diffs.** Don't, and you rent comprehension debt at compound interest.
- **Spot-check the gate.** Pick a few loop-opened PRs; verify the approving test actually catches the failure mode you care about. **Gates rot.**
- **Block the loop from architecture work.** Keep it on small, machine-checkable changes.
- **Pair-design the loop with a teammate.** A second pair of eyes catches blind spots the loop would otherwise exploit forever.

---

## 6. The security tax — an unattended loop is an unattended attack surface

| Threat | Mechanism | Defense |
|--------|-----------|---------|
| **Unreviewed code shipping** | The loop opens PRs faster than a human can read them | Gate must include **SAST + dependency audit + secret scanning**; keep the human approval gate before merge |
| **Skills as injection vectors** | A loop that auto-installs skills inherits prompt injection hiding in descriptions (*520 / 17,022 audited skills leak credentials*) | **Audit skill sources before installing.** Never auto-install community skills |
| **Credentials in logs** | Verbose/debug logging scatters secrets across logs you don't monitor | **Disable verbose logging in production loops; sanitize what's logged** |
| **Permission scope creep** | Read-only loop gets "just one" write permission for convenience, never re-audited | **Re-audit permissions every 30 days** |

---

## Phase 3 sign-off checklist

Before any loop runs unattended, confirm:

- [ ] **Objective gate** names a command + exit code (not an agent opinion).
- [ ] **Hard stop** is set (budget / iterations / time).
- [ ] **Human approval gate** before merge / deploy / dependency / auth / payments.
- [ ] **Maker ≠ checker** (separate verifier, ideally different model; `/goal` checker ≠ maker).
- [ ] **`VISION.md`/`AGENTS.md`** restates non-negotiable constraints and is reread each run.
- [ ] **Security gate** includes SAST + dependency audit + secret scanning.
- [ ] **No auto-install** of unaudited skills/connectors.
- [ ] **Verbose logging off**; logs sanitized.
- [ ] **Permission re-audit** scheduled (≤ 30 days).
- [ ] A human owns **reading the diffs** and **spot-checking gates** on a cadence.
