# AUDIT Playbook — scanning and fixing existing config

The procedure to follow when asked to "tidy up `.claude`" or "review it against the official docs". **Do not speak from guesswork; read the real files first, then report.**

---

## Step 0 — inventory

Enumerate the targets mechanically — both project root and user-level.

```bash
# All CLAUDE.md (root + subdirectory + local + user-level)
fd -H -t f 'CLAUDE\.md|CLAUDE\.local\.md' . ~/.claude 2>/dev/null
# Each mechanism's directory
ls -la .claude/rules .claude/skills .claude/agents .claude/output-styles 2>/dev/null
# settings (hooks / permissions)
cat .claude/settings.json .claude/settings.local.json 2>/dev/null
```
(If `fd` is unavailable, fall back to `find . -name 'CLAUDE.md'` etc.)

Measure each CLAUDE.md's **line count** (shell-independent, no duplicates):
```bash
find . ~/.claude \( -name 'CLAUDE.md' -o -name 'CLAUDE.local.md' \) 2>/dev/null -exec wc -l {} +
```

---

## Step 1 — detection signatures

Each signature is a "symptom grep pattern" + the "right mechanism". On a hit, add it to the findings table. **The patterns are a starting point** — make the final call by reading the content (don't put false positives in the table).

### S1. Bloated CLAUDE.md → split
- **Detect**: `wc -l` is **> 200 lines** (this blog's bar). `claude-code-best-practices` recommends ~100.
- **Decide**: ask each section "is this a fact or a procedure?", "is it needed for every task?".
- **Fix**: procedures → skill; domain-specific conventions → path-scoped rule; useless lines → delete. Keep only build/layout/immutable conventions.

### S2. "every time / must always run" → hook
- **Detect (grep)**: `every time|always run|after (each|every)|whenever you|毎回|必ず.*実行|都度|each commit`
- **Decide**: should that action (formatter/linter/notification/test) "run automatically" rather than "Claude choosing to run it"? If YES → hook.
- **Fix**: a `PostToolUse` (prettier after Edit, etc.) / `Stop` (Slack on completion, etc.) hook in `settings.json`. Make it fail-open, scope it with a matcher, add an env bypass.

### S3. A hard ban → hook / permissions / managed
- **Detect (grep)**: `never|do not|don't|must not|禁止|絶対に.*ない|forbidden|under no circumstances`
- **Decide**: is it "a guideline that's OK to miss" or "a guardrail that must not be broken"? The latter is insufficient as an LLM instruction (breaks under pressure / injection / long sessions).
- **Fix**: a `PreToolUse` hook that inspects the tool call and **blocks with exit code 2**. For org-wide, un-overridable enforcement, **managed settings**.

### S4. A procedure / runbook / checklist → skill
- **Detect**: a numbered multi-step block (roughly ≥ 5 steps) in CLAUDE.md / the words "checklist", "runbook", "steps", "deploy", "release", "review process".
- **Decide**: is it an always-needed fact, or a procedure needed only during a specific task?
- **Fix**: move it to `.claude/skills/<name>/SKILL.md` and delete it from CLAUDE.md. Put triggering keywords in the description. Add `disable-model-invocation: true` if it has side effects.

### S5. An unscoped / domain-specific rule loaded always → path-scope it
- **Detect**: a `.claude/rules/*.md` with no `paths:` frontmatter, or CLAUDE.md text that mentions a specific path ("in `src/api/` …", "`*.handler.ts` should …").
- **Decide**: should the constraint apply to all code, or only one area?
- **Fix**: add `paths:` to make it a rule. Note that "an unscoped rule is mechanically identical to CLAUDE.md (always billed)".

### S6. A personal preference in a project file → move to user-level
- **Detect (grep)**: first-person / preference phrasing `I prefer|I like|個人的に|私は|always use semantic commit|my preference`, inside a project `CLAUDE.md`.
- **Decide**: is it a convention for the whole team, or a personal preference?
- **Fix**: move personal preferences to `~/.claude/CLAUDE.md` (or the user-level of the relevant mechanism). Keep in the project file only what is team-wide but specific to that codebase.

### S7. An output style that overrides defaults → keep-coding-instructions / built-in
- **Detect**: a `.claude/output-styles/*.md` exists whose frontmatter **lacks** `keep-coding-instructions: true`.
- **Decide**: do you really want to swap the role wholesale, or just add tone?
- **Fix**: if you want to keep the defaults (scope/comment/security/verify instructions), set `keep-coding-instructions: true`. If you only want to add tone/formatting, prefer **append-system-prompt** or a built-in style (Proactive/Explanatory/Learning) over an output style.

### S8. Duplication (CLAUDE.md ∧ hook, CLAUDE.md ∧ rule)
- **Detect**: a synonymous instruction in multiple mechanisms (e.g. "run prettier" in both CLAUDE.md and a hook).
- **Fix**: consolidate. If determinism is needed, keep the hook and delete it from CLAUDE.md.

### S9. A subagent with excessive tools
- **Detect**: `.claude/agents/*.md` whose `tools:` include `Edit`/`Write`/`Bash` for a read-only role.
- **Fix**: minimize to least privilege (Read/Grep/Glob-centric).

### S10. A weak skill description (under-trigger)
- **Detect**: a `.claude/skills/*/SKILL.md` whose `description` only says "what it does" with no "when to use", or is one vague sentence.
- **Fix**: add "what it does + when to use + trigger phrases" with the key use case first (within the 1,536-char cap).

---

## Step 2 — the findings report (report format)

Always return scan results as a **table + real file quotes**. Use no hedging words ("probably", "likely").

```
## Steering Audit — <project>

Scanned: CLAUDE.md (N lines), .claude/rules/ (M), .claude/skills/ (K), ...

| # | location:line | current | detected | recommended | why | action |
|---|---------------|---------|----------|-------------|-----|--------|
| 1 | CLAUDE.md:42-71 | 30-line deploy procedure in CLAUDE.md | S4 | skill | always-resident, heavy, buries the rest | move to `.claude/skills/deploy/`, delete from CLAUDE.md |
| 2 | CLAUDE.md:88 | "always run prettier after editing" | S2 | hook | LLM instruction has no execution guarantee | PostToolUse(Edit) prettier in settings.json |
| 3 | .claude/rules/api.md | no paths:, content is src/api-only | S5 | path-scoped rule | unscoped = always billed | add paths: ["src/api/**"] |

### Summary
- CLAUDE.md: 240 → ~95 lines achievable (2 procedures → skills, 1 ban → hook)
- Always-on context saved: ~X tokens/session
- Guardrails made deterministic: N
```

---

## Step 3 — fix recipes (representative)

### R-S2: "always prettier" → PostToolUse hook
Delete the line from CLAUDE.md and add to `.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "if [ -z \"$PRETTIER_BYPASS\" ]; then f=$(jq -r '.tool_input.file_path // empty'); [ -n \"$f\" ] && npx prettier --write \"$f\" 2>/dev/null || true; fi" }
        ]
      }
    ]
  }
}
```
A PostToolUse hook receives its **tool input as JSON on stdin**, so extract the edited path with `jq` from `tool_input.file_path` (there is **no** env var like `$CLAUDE_FILE_PATHS` — the real hook env vars include `$CLAUDE_PROJECT_DIR`). Fail-open (`|| true`), env bypass (`PRETTIER_BYPASS`), matcher limited to Edit/Write.

### R-S3: "don't delete migrations" → PreToolUse block
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/guard-migrations.sh" }
        ]
      }
    ]
  }
}
```
`guard-migrations.sh` detects a dangerous command, prints the reason to stderr, and **exits with code 2**. If org-wide enforcement is needed, put the equivalent in managed settings.

### R-S4: deploy procedure → skill
`.claude/skills/deploy/SKILL.md`:
```yaml
---
name: deploy
description: Production deploy procedure. Use when asked to "deploy", "release", or "ship to prod".
disable-model-invocation: true   # has side effects, so manual only
allowed-tools: Bash(npm run *) Bash(git push *)
---
1. Run the test suite
2. Build
3. Push to the deploy target
4. Verify the deploy succeeded
```
Delete the procedure from CLAUDE.md; if needed, keep only a one-liner "deploy: see the /deploy skill" (delete even that if you can).

### R-S5: unscoped rule → path-scoped
Add to the top of `.claude/rules/api.md`:
```markdown
---
paths:
  - "src/api/**"
  - "**/*.handler.ts"
---
```

---

## Principles when applying

- **Deleting beats adding** by default. CLAUDE.md is the "index".
- For each line/section, ask **"Would removing this cause Claude to make mistakes?"** — NO = delete / YES but rare = move to a skill / YES and always = keep.
- Apply changes **only after the user approves**. AUDIT is propose → agree → apply.
- After applying, report "lines removed / guardrails made deterministic" where possible, to make the impact visible.
