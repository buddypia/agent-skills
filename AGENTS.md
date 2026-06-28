# AGENTS.md

このリポジトリで動くすべてのコーディングエージェント（Claude Code / Codex / Antigravity ほか）への指示。

## Worktree completion gate（必須 — 「作業完了」を宣言する前に必ず実行）

`.worktrees/` 配下の linked worktree で作業し、それを「完了」「終わった」「レビューして」「マージしていい?」等と宣言して**ターンを終える前**に、必ずこのゲートを通すこと。決定論的 hook（`.claude/settings.json` / `.codex/hooks.json` / `.agents/hooks.json` の `scripts/gate.sh`）も同じことを強制するが、hook に頼らずまずここで自分で守る。詳細手順とテンプレは `.claude/skills/worktree-review-gate/`（SKILL.md）にある。

### Step 0 — READ-ONLY ガード（ゲートを適用するか否かを決める・最重要）

何よりも先に「**このセッションが worktree を変更したか**」を判定する:

- セッション開始時点に対して `git rev-parse HEAD` が進んだ、**または** `git status --porcelain` の内容が変化したか。
- 変更が無い（読んだだけ・調べただけ）なら **READ-ONLY**。

ルール:
- **READ-ONLY なら承認依頼を出さない。** 普通の要約で締める。過去のセッションで作業済みの worktree を開いて読んだだけでも、stale なコミットや checklist を理由に承認依頼を出すのは**プロトコル違反**。
- 変更した場合のみ Step 1 へ。

### Step 1 — 完了の前提条件（全て真でなければ「完了」と言わない）

1. worktree ルートに `PLAN.md` があり、未チェック項目が**ゼロ**（`grep -nE '^[[:space:]]*[-*][[:space:]]+\[[[:space:]]\]' PLAN.md` が空）かつ done 項目 `\[[xX]\]`（`- [x]` / `- [X]`）が1つ以上。※ BSD/POSIX grep 互換のため `\s` ではなく `[[:space:]]` を使う（gate.sh と同一契約）。
2. base（`origin/HEAD`→`origin/main`→…で実在検証）より HEAD が**1コミット以上先行**。未コミットの作業が残っていれば**先にコミット**する。
3. このリポジトリの lint / test / build を**実際に実行**して結果を把握（無ければ「該当なし」）。
- どれか欠けるなら「完了」と言わず、不足を埋めてから再判定する。

### Step 2 — 承認依頼を出力（Step 0=変更あり かつ Step 1=全充足のときだけ）

`.claude/skills/worktree-review-gate/templates/approval-request.md.template` の §1-11 を**実コマンド出力**で埋めて出力する（git log / diff --stat / rev-list --count / test 結果。捏造しない）。出力したら**止まり、ユーザーの承認を待つ**。承認前に merge / push / worktree remove をしない。

- 末尾のマーカー `<!-- WTRG:APPROVAL:<short-HEAD> -->` を `git rev-parse --short HEAD` の実出力に置換して必ず残す（hook の冪等性キー）。

ユーザーの3択:
- **✅ 承認して進める** → Step 3 へ。
- **✏️ 修正が必要** → 対応して再コミット。HEAD が変わるので完了後に承認依頼を出し直す。
- **⛔ 停止する** → merge せず worktree を残して保留。

### Step 3 — PR 完了報告（「✅ 承認して進める」のあとだけ）

merge / cleanup を実行し、`.claude/skills/worktree-review-gate/templates/pr-completion-report.md.template` の §1-5 を**実測値**で埋めて出力する。失敗ステップは正直に書く。「修正が必要 / 停止」では出さない。

### Hard rules

- READ-ONLY セッションで承認依頼を**絶対に出さない**（Step 0）。
- 変更ありのセッションで「完了」を言うなら、承認依頼ブロック無しに終えない。
- git / PLAN / test の値は**実コマンド出力**から。捏造しない。
- 不可逆操作（merge / push / branch 削除 / worktree remove）はユーザーの「✅」後だけ。
- hook が継続を促してこのブロックを要求したら、素直に出力する。
