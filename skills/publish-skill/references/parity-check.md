# Parity check (blocking verification before git)

Run these from the repo root. **All must pass** before committing. If any fails, fix and re-run.

## 1. Equal line counts across the four READMEs
```bash
wc -l README.md README.ja.md README.ko.md README.zh.md
```
All four counts must be identical. (Adding one skill adds exactly 2 lines to each: one Skills
table row + one Use-cases bullet.)

## 2. Identical H2 set at identical line numbers
```bash
for f in README.md README.ja.md README.ko.md README.zh.md; do echo "== $f =="; grep -nE '^## ' "$f"; done
```
The header text and the line numbers must match across all four files (headers stay English).

## 3. First table column byte-identical across languages
```bash
for f in README.md README.ja.md README.ko.md README.zh.md; do
  echo "== $f =="; grep -nE '^\| \[`' "$f" | sed -E 's/\|[^|]*\|[^|]*\|$//'
done
```
The `` | [`<id>`](./skills/<id>) | `` prefix of every row must be identical in all four files.

## 4. Use-cases dash convention (zh uses double em dash)
```bash
echo "en/ja/ko single em ' — ':"; grep -nE '^- \*\*[^*]+\*\* — ' README.md README.ja.md README.ko.md
echo "zh double em ' —— ':";      grep -nE '^- \*\*[^*]+\*\* —— ' README.zh.md
echo "zh must have ZERO single-em bullets:"; grep -nE '^- \*\*[^*]+\*\* — ' README.zh.md || echo "  OK none"
```
Every zh use-case bullet must use ` —— `; en/ja/ko must use ` — `.

## 5. Single trailing newline per file (no missing/extra)
```bash
for f in README.md README.ja.md README.ko.md README.zh.md; do
  if [ -z "$(tail -c1 "$f")" ]; then echo "$f: ends with newline (OK)"; else echo "$f: NO trailing newline (FIX)"; fi
done
```

## 6. New skill is listed in all four (both sites)
```bash
for f in README.md README.ja.md README.ko.md README.zh.md; do
  printf "%s table:%s usecase:%s\n" "$f" \
    "$(grep -c "\[\`<id>\`\](./skills/<id>)" "$f")" \
    "$(grep -c '^- \*\*<id>\*\*' "$f")"
done
```
Replace `<id>`. Each file must show `table:1 usecase:1`.

> Exception: **intentionally-unlisted** skills (repo-maintenance tooling, e.g. `publish-skill`)
> are NOT registered in the root READMEs by design — skip this check for them.

## 7. Skill root file completeness
```bash
# Archetype A: must be exactly 7 entries
ls -1 skills/<id> | wc -l        # expect 7
ls -1a skills/<id>/scripts | grep -E '^\.env\.example$|^config\.yaml\.example$'   # both must appear
# Archetype B: SKILL.md README.md LICENSE present; NO config.example/env.example/scripts/assets
ls -1 skills/<id>
# Both: LICENSE byte-identical to root
cmp skills/<id>/LICENSE LICENSE && echo "LICENSE identical (OK)"
```

## 8. No secrets / runtime artifacts staged
```bash
git status --porcelain skills/<id> | grep -E '\.DS_Store|\.env$|config\.(yaml|yml|json)$|\.log$|raw_output' && echo "FIX: artifact staged" || echo "clean (OK)"
```
`*.example` files MUST be tracked; the above are the things that must NOT be.
