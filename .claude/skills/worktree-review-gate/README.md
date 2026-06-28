# worktree-review-gate

`.worktrees/` 配下の linked worktree で作業が**完了したときだけ**、人間にレビュー承認を求める構造化レポート（§1-11）を確実に出力し、承認後に PR 完了報告（§1-5）を出すための完了ゲート。**READ-ONLY（読むだけ・worktree 外・未完了）では絶対に発火しない。**

決定論的な強制は **hook**（`scripts/gate.sh`）が、中身の生成は **SKILL.md の手順**が、hook の無い/効かない環境の穴埋めは **リポジトリルート `AGENTS.md`** が担う三層構成。Claude Code / Codex / Antigravity の3CLIで `gate.sh` 1本を共有する。

## ファイル

```
.claude/skills/worktree-review-gate/
├ SKILL.md                                   # ゲート判定・手順・ハードルール（モデルが読む本体）
├ README.md                                  # これ
├ scripts/gate.sh                            # 3CLI共通の Stop/SessionStart hook（fail-open）
├ templates/approval-request.md.template     # §1-11 承認依頼（末尾に冪等性マーカー）
├ templates/pr-completion-report.md.template # §1-5 PR 完了報告
└ references/
   ├ detection-logic.md                      # ガード節と設計根拠（誤発火/発火漏れ対策）
   └ enforcement-matrix.md                   # CLI別の配線・契約差・落とし穴
リポジトリルート/
├ AGENTS.md            # Codex/Antigravity が読む tool-agnostic ゲート（steering 層）
├ .claude/settings.json # Claude Code の Stop+SessionStart 配線（tracked）
├ .codex/hooks.json     # Codex の決定論的配線
└ .agents/hooks.json    # Antigravity の決定論的配線
```

## 仕組み（なぜ確実 & なぜ READ-ONLY で出ないか）

- **SessionStart** がそのセッションの起点（`HEAD` と `git status` のスナップショット）を記録する。
- **Stop**（ターン終了ごと）が、起点と比較して**このセッションが worktree を変更したか**を見る。変更が無ければ即「黙る」。これがリポジトリ状態（既存コミット/古い checklist）に騙されない READ-ONLY ガードの核心。
- 変更あり ∧ linked worktree(`.worktrees/`) ∧ PLAN.md 全チェック ∧ base より1コミット以上先行、を全て満たすと、`{"decision":"block","reason":...}` で「承認依頼を出してから止まれ」と**強制**する。
- 承認依頼末尾の `<!-- WTRG:APPROVAL:<short-HEAD> -->` を transcript から見て、**同じ HEAD では二重に要求しない**（修正で HEAD が変われば再承認を促す）。

詳細は `references/detection-logic.md`。

## セットアップ（このリポジトリでは設置済み）

- **Claude Code**: `.claude/settings.json` に配線済み。worktree でも効かせるため tracked（コミット）。**worktree は hook commit を含む base（main）から切ること**（古い branch 起点の worktree には配線されない）。
- **Codex**: `.codex/hooks.json` に配線済み。初回だけ `/hooks` で**信頼**が必要（編集すると hash が変わり再信頼が要る）。無人/CI は `--dangerously-bypass-hook-trust` か managed `requirements.toml`。加えて `AGENTS.md` を読む。
- **Antigravity (agy)**: `.agents/hooks.json` に配線済み（**名前付き hook-group** 形式・`"hooks"` ラッパー無し。`SessionStart` が無いので baseline は `PreInvocation` にマップ）。`gate.sh` は fail-open（agy hook は fail-closed なので必須）。加えて `AGENTS.md` を読む（Antigravity 専用調整が要れば `GEMINI.md` を任意で追加可。既定では未設置）。

> ⚠️ Codex / Antigravity の hooks.json スキーマは CLI バージョンで差がありうる。導入後に各 CLI の `/hooks`（と `agy inspect`）で**配線を一度確認**すること。万一 hook が効かなくても `AGENTS.md` の steering 層とハードルールで「READ-ONLY で出さない／完了時に出す」は守られる。

## 動作確認

```bash
# メインリポ（= linked worktree でない）から呼ぶと、ガード4(worktree判定)で必ず黙る。
# READ-ONLY ガード(ガード6)そのものの確認は、下記の throwaway worktree シナリオで行う。
printf '{"cwd":"%s","session_id":"test"}' "$PWD" | bash scripts/gate.sh SessionStart   # => {}
printf '{"cwd":"%s","session_id":"test","stop_hook_active":false}' "$PWD" | bash scripts/gate.sh Stop  # => {} (worktree でないため)
```

実 worktree での完全なシナリオ検証（READ-ONLY 誤発火 / 発火漏れ / ループ / jq無しを確認する手順と期待値）:

```bash
R=$(mktemp -d); cd "$R"; git init -q -b main; git config user.email t@t; git config user.name t
echo x>a; git add .; git commit -qm base
WT="$R/.worktrees/feat"; git worktree add -q -b feat "$WT" >/dev/null; cd "$WT"
G=/path/to/.claude/skills/worktree-review-gate/scripts/gate.sh
J(){ printf '{"cwd":"%s","session_id":"s","stop_hook_active":%s}' "$WT" "${1:-false}"; }
printf '%s' "$(J)" | bash "$G" SessionStart                 # {}  baseline 記録
printf '%s' "$(J)" | bash "$G" Stop                         # {}  READ-ONLY（何も変えてない）
printf -- "- [x] done\n" > PLAN.md; git add .; git commit -qm work
printf '%s' "$(J)" | bash "$G" Stop                         # {"decision":"block",...}  発火
printf '%s' "$(J true)" | bash "$G" Stop                    # {}  ループガード
```

設計根拠と全ガード節は `references/detection-logic.md` を参照。

## 設定

| env | 既定 | 意味 |
|-----|------|------|
| `WTRG_WORKTREE_DIR` | `.worktrees` | worktree を示す path セグメント。`""` にすると任意の linked worktree で発火（canonical 判定のみ） |
