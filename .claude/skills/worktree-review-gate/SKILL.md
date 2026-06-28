---
name: worktree-review-gate
description: |
  Worktree 作業が「完了」したときにだけ、人間にレビュー承認を求める構造化レポートを確実に出力し、承認後に PR 完了報告を出力するための完了ゲート。READ-ONLY セッション・worktree 外・未完了では絶対に発火しない。Claude Code / Codex / Antigravity の3CLIで動く決定論的 hook（Stop + SessionStart）+ 共通の AGENTS.md ゲート + 本スキルのテンプレで構成する。次のいずれかで使う — (1) `.worktrees/` 配下の linked worktree で PLAN.md のチェックリストが全て [x] になり、かつ「そのセッションで」コミット/変更を行って作業を終えたとき、§1-11 の承認依頼を出力する; (2) ユーザーが「✅ 承認して進める」を選んだあと、merge / cleanup を実行し §1-5 の PR 完了報告を出力する。Stop hook がこの手順を強制的に呼び出すが、hook が無い環境でも本スキルの READ-ONLY ガードを手動で適用すること。日本語トリガ: 「worktree 完了」「承認依頼」「マージしていい?」「PR 完了報告」「レビューして」。Also fires on /worktree-review-gate.
trigger: /worktree-review-gate
---

# Worktree Review Gate

> worktree 作業が**本当に終わったときだけ**、人間に承認を求める。READ-ONLY では絶対に黙る。

`.worktrees/` 配下の linked worktree で作業を終えたとき、(A) **承認依頼**（§1-11）を出して人間の merge/cleanup 承認を取り、承認後に (B) **PR 完了報告**（§1-5）を出す。この2つを**確実に**出力し、かつ **READ-ONLY（読むだけ・worktree 外・未完了）では誤って出さない**ことが唯一の目的。

決定論的な強制は **hook**（`scripts/gate.sh` を Stop / SessionStart に配線）が担う。本スキルは hook から呼ばれて中身を生成する手続きであり、hook が無い環境（手動運用）でも同じ判定を自分で適用するための判断基準でもある。

## いつ発火し、いつ黙るか（最重要）

**発火する条件は AND で全て満たすときだけ:**

1. cwd が **linked worktree**（`git rev-parse --absolute-git-dir` ≠ `git-common-dir` の絶対パス）であり、かつ path に `.worktrees/` を含む（既定。`WTRG_WORKTREE_DIR` で変更可）。
2. **このセッションが worktree を変更した** — SessionStart 時点の `HEAD` と `git status` スナップショットに対して、現在の `HEAD` が進んでいる **または** working tree のダーティ状態が変化している。
3. `PLAN.md` が worktree ルートに存在し、チェックリストが **`- [x]` を1つ以上含み `- [ ]` が0個**（＝全完了）。
4. base（`origin/HEAD`→`origin/main`→…の順で実在検証）に対して **HEAD が1コミット以上先行**。

**黙る（出力しない）条件 — どれか1つでも該当したら何もしない:**

- READ-ONLY セッション（このセッションで HEAD もダーティ状態も変えていない）。**過去のセッションで作業済みの worktree を「開いて読んだだけ」でも、コミットや checklist が残っていても発火してはならない。** これがこのゲートの肝。
- worktree 外（メインリポジトリ）/ git 管理外 / `.worktrees/` 以外。
- PLAN.md が無い / 未完了（`- [ ]` が残っている）。
- base が解決できない / コミットが base と同じ。
- 同じ HEAD で既に承認依頼を出した（transcript に `WTRG:APPROVAL:<short-HEAD>` がある）。

> 迷ったら**黙る**。誤発火（READ-ONLY で出す）は発火漏れより悪い、というのがこのスキルの設計方針。

## 2つの出力

### A. 承認依頼（§1-11） — hook に block されたら、または上記条件を自分で満たすと判断したら

1. **必ず実データを集める**（推測で埋めない）:
   - `git log --oneline <base>..HEAD`、`git rev-list --count <base>..HEAD`
   - `git diff --stat <base>..HEAD`、変更ファイル一覧
   - `git status --porcelain`（未コミットの取りこぼし確認）
   - lint/format/typecheck/test を**実際に実行**して結果を控える（無ければ「該当なし」）
   - Draft PR があれば URL / status / CI、無ければ「未作成」
2. `templates/approval-request.md.template` の全 `<...>` を実データで埋めて出力する。
3. **末尾のマーカー `<!-- WTRG:APPROVAL:<short-HEAD> -->` は必須**。`<short-HEAD>` を `git rev-parse --short HEAD` の実出力に置換する。これが hook の冪等性判定キー（同じ HEAD で二重に要求しない／新コミットで再承認を促す）。
4. 出力したら**そこで止まり、ユーザーの選択を待つ**。承認なしに merge / cleanup / push をしない。

ユーザーの3択:
- **✅ 承認して進める** → B へ。
- **✏️ 修正が必要** → 指摘に対応し、再度コミット。HEAD が変わるので、完了したら新しい HEAD で承認依頼を出し直す。
- **⛔ 停止する** → merge せず保留。worktree はそのまま残す。

### B. PR 完了報告（§1-5） — 「✅ 承認して進める」のあとだけ

1. merge / cleanup を実行する（プロジェクトの流儀に従う。例: PR を merge → `git worktree remove` → ローカル/リモートブランチ削除 → main を ff → stash 復元）。
2. **実行結果の実測値**で `templates/pr-completion-report.md.template` の `<...>` を埋めて出力する。
3. 失敗したステップは正直に書く（「未実施」「失敗 + ログ」）。成功は確認できたものだけ断定する。

> ⛔「停止」や「修正が必要」を選ばれたら **B を出してはいけない**。B は承認後の merge 実行報告に限る。

## ハードルール（違反しない）

1. **READ-ONLY で承認依頼を出さない。** worktree を「開いて読んだだけ」のセッションでは絶対に発火しない（セッション baseline で判定）。
2. **承認なしに不可逆操作をしない** — merge / push / `worktree remove` / ブランチ削除はユーザーの「✅」後だけ。
3. **数値・パスは実コマンド出力から。** git log / diff / test 結果を捏造しない。埋められない項目は「不明」ではなく実際に調べる。
4. **承認依頼は HEAD ごとに1回。** マーカー行を必ず残す。修正で HEAD が変わったら出し直す。
5. **B（完了報告）は承認後のみ。** 「修正が必要 / 停止」では出さない。
6. **hook が無い CLI でも** この判定基準（特にルール1）を手動で適用する。

## 構成ファイル

| ファイル | 役割 |
|---|---|
| `scripts/gate.sh` | 3CLI共通の決定論的 hook（`Stop` / `SessionStart`）。fail-open・session baseline・transcript sentinel を実装 |
| `templates/approval-request.md.template` | §1-11 承認依頼。末尾に冪等性マーカー |
| `templates/pr-completion-report.md.template` | §1-5 PR 完了報告 |
| `references/detection-logic.md` | 検知アルゴリズムのガード節と、各誤発火/発火漏れリスクへの対処（設計根拠） |
| `references/enforcement-matrix.md` | Claude Code / Codex / Antigravity 別の配線方法・契約差・落とし穴（trust-gate, fail-closed 等） |
| リポジトリルート `AGENTS.md` | Codex / Antigravity が読む tool-agnostic な完了ゲート（hook が効かない/未信頼でも steering で効く層） |
| リポジトリルート `.codex/hooks.json`, `.agents/hooks.json` | Codex / Antigravity 用の決定論的 hook 配線（`gate.sh` を再利用） |

## このスキル自体のアンチパターン

- **READ-ONLY で出力する** → 最大の事故。必ずセッション baseline（SessionStart で記録した HEAD/ダーティ）と比較し、変更していなければ黙る。
- **hook を信じすぎる** → Codex は trust-gate で未信頼だと hook が走らない／Claude は worktree の branch に hook commit が無いと配線されない。だから AGENTS.md の steering 層を必ず併設し、本スキルのルール1を手動でも守る。
- **マーカーを消す/書き換える** → 冪等性が壊れ二重出力 or 永久抑制。テンプレ末尾のマーカーは実 short-HEAD に置換して必ず残す。
- **承認前に merge** → ルール2違反。出力して止まり、ユーザーの選択を待つ。
