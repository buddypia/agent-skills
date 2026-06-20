# Publish-Skill — One-Pass Skill Publishing

A pure-prompt maintenance skill that publishes a new or changed skill to this repo in one pass:
it completes the skill's required files for its archetype, registers it in all four root READMEs
(en/ja/ko/zh) at line-count parity, verifies parity, then stages and commits.
For the skill definition (invocation summary), see [SKILL.md](./SKILL.md).

This skill is **repo-specific tooling** for `buddypia/agent-skills` — it encodes that repo's
verified publishing conventions so you never have to remember them by hand. It runs entirely in
the host agent's context (no scripts, no external CLIs).

## What it does

Adding a skill to this repo is not just `git push`. Two things are easy to get wrong:
1. **File completeness** — the repo has two skill archetypes with different required files.
2. **Four-language README parity** — the root READMEs are line-number isomorphic and must be
   updated together, with per-language typographic rules (e.g. Chinese uses a double em dash).

This skill automates both, plus the LICENSE copy, parity verification, and the git steps.

## How it works

```
pre-flight → detect archetype (A script-type / B pure-prompt)
          → complete skill files (README.md, LICENSE byte-copy, scripts/+assets for A)
          → register in 4 root READMEs (Skills table + Use cases, with translation)
          → generalize positioning prose if the theme broadened
          → parity check (blocking)
          → git add + commit   (push is approval-gated)
```

- **Archetype A (script-type)** — drives vendor CLIs via `scripts/`; ships exactly 7 root
  entries plus the full `uv` project. Examples: `multi-llm-debate`, `multi-llm-reflection`,
  `multi-llm-recursive-meta-cognition`.
- **Archetype B (pure-prompt)** — runs in-context; `SKILL.md` + `README.md` + `LICENSE`
  (+ optional `references/`). Examples: `reflect`, and this skill.

## When to use

Use it right after adding a `skills/<id>/` directory, when you want to release/register it.
Triggers: "publish", "release", "register in the README", "公開", "リリース",
"READMEに登録". Not for unrelated edits or for shipping changes that are not a skill.

## Usage

Invoke the skill (e.g. via its trigger phrases) optionally naming the skill id; it defaults to
the untracked/changed skill under `skills/`. It will present prose/README changes for review and
will **not push** until you explicitly approve.

## References

- [`references/skill-archetypes.md`](./references/skill-archetypes.md) — file manifests + build recipes per archetype
- [`references/translation-glossary.md`](./references/translation-glossary.md) — en/ja/ko/zh terms + translate/don't-translate rules
- [`references/parity-check.md`](./references/parity-check.md) — the blocking verification commands
- [`references/publish-checklist.md`](./references/publish-checklist.md) — the full ordered master checklist

## License

Released under the MIT License — © 2026 buddypia. See [LICENSE](./LICENSE).

## Disclaimer

This skill runs git commands and edits repository files on your behalf. Review its proposed
changes (it shows a diff and gates `git push` on your approval), and treat any generated prose
or translations as a draft to verify before publishing.
