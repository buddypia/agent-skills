# Enforcement matrix — CLI 別の配線・契約差・落とし穴

完了ゲートを**確実に**効かせるため、各 CLI で「決定論的 hook 層」と「AGENTS.md steering 層」の二段で守る。hook は単独では穴がある（Codex の trust-gate、Claude の branch 依存、Antigravity の fail-closed）。steering 層は穴埋めであり、本スキルのハードルール1（READ-ONLY で出さない）は hook の有無に関わらず手動でも守る。

> 信頼度: Claude Code の Stop/SessionStart 契約は公式ドキュメントで**検証済み**。Codex / Antigravity の hook 仕様は公式 + 複数二次情報で**裏取り**したが、フィールド名は CLI バージョンで変わりうる。`gate.sh` は snake_case / camelCase / 別名を順に試して吸収する。

## 共通の出力契約（`gate.sh` が満たすもの）

- 黙る: `{}` を stdout、exit 0。
- 発火: `{"decision":"block","reason":"..."}` を stdout、exit 0。**余分なフィールドを足さない**（Codex は strict schema で全体が無効化される）。`reason` に `"` `\` 改行を入れない。
- 何が起きても **exit 0 + 有効 JSON**（Antigravity fail-closed 対策）。

## Claude Code（検証済み・第一級）

- 配線: `.claude/settings.json` の `hooks.Stop` / `hooks.SessionStart`（**Stop に matcher は無い**）。本リポジトリでは tracked（コミット）。
- stdin: `session_id` / `cwd` / `transcript_path` / `stop_hook_active` / `permission_mode` / `hook_event_name`。
- block: `{"decision":"block","reason":...}` exit 0、または exit 2 + stderr。`reason` が次の指示として model に渡る。
- マージ規則: user(`~/.claude`) / project(`.claude`) / local(`.claude/settings.local.json`) の hook は**全て実行**される（同一コマンドは重複排除）。
- worktree: linked worktree では**その checkout の `.claude/settings.json`** を読む。tracked かつ worktree の branch にその commit があれば配線される。
  - ⚠️ **落とし穴:** hook commit を**含まない古い base branch**から切った worktree には `.claude/settings.json` が無く、配線されない。→ 対策: hook を main に入れて、worktree は main 起点で切る（このリポジトリの運用）。全 branch で効かせたいなら `~/.claude/settings.json`（user 設定）に入れ、ガード4でメインリポを除外する手もある。
  - ⚠️ gitignore された `settings.local.json` は worktree に自動コピーされない（`.worktreeinclude` が要る）。本ゲートは tracked な `settings.json` を使うので影響なし。
- env: `${CLAUDE_PROJECT_DIR}` が使える（worktree ではその worktree ルート）。

## Codex CLI（決定論的 hook 有り + AGENTS.md）

- **決定論的層:** `.codex/hooks.json` の `Stop` / `SessionStart`（GA、既定 on）。本リポジトリに同梱（`gate.sh` を再利用）。
  - ⚠️ **strict schema:** Stop の出力は `deny_unknown_fields`。許されるのは `decision` + `reason`（または `continue`/`stopReason`）のみ。`hookSpecificOutput` 等を足すと**ペイロード全体が無効**になり no-op。`gate.sh` は `{}` か `{"decision":"block","reason":...}` だけを出すので適合。
  - ⚠️ **trust-gate / hash-pin:** 未信頼プロジェクトでは project-scoped の `.codex`（hooks 含む）が**スキップ**される。スクリプトを編集すると hash が変わり**信頼が取り消される**。→ 対策: 一度 `/hooks` で信頼。無人/CI は `--dangerously-bypass-hook-trust` か managed `requirements.toml`（`allow_managed_hooks_only`）。
  - stdin: `stop_hook_active` / `cwd` / `transcript_path` / `last_assistant_message` / `turn_id` 等。loop guard は `stop_hook_active`。
  - worktree: `.git` から project root を解決するので、repo ルートの `.codex/hooks.json` と `AGENTS.md` は**全 worktree が継承**。
  - `notify`（`~/.codex/config.toml`）は**ゲートに使えない**（fire-and-forget、project config では無視）。
- **steering 層:** repo ルート `AGENTS.md`。グローバル `~/.codex/AGENTS.md` → root → cwd の順に**連結**（深いほど優先、32KiB 上限）。**binding ではない**ので hook と併用する。

## Antigravity（agy）（決定論的 hook 有り + AGENTS.md）

- **決定論的層:** `.agents/hooks.json`（または `~/.gemini/config/hooks.json`）の `Stop` / `PreInvocation`。本リポジトリに同梱。
  - ⚠️ **スキーマが他CLIと違う:** Antigravity は**トップレベルに名前付き hook-group**を置く（`"hooks"` ラッパー**無し**）。本リポジトリでは group 名 `worktree-review-gate` の下に `PreInvocation` と `Stop` を配線:
    `{ "worktree-review-gate": { "enabled": true, "PreInvocation": [...], "Stop": [...] } }`
  - ⚠️ **`SessionStart` イベントが無い。** Antigravity のライフサイクルは `PreInvocation` / `PostInvocation` / `PreToolUse` / `PostToolUse` / `Stop`。baseline 記録（READ-ONLY ガードの前提）は **`PreInvocation` にマップ**し、ランチャから `gate.sh SessionStart`（内部モード名）を呼ぶ。`gate.sh` は `conversationId` で write-once するので、PreInvocation が毎ターン発火しても baseline はセッション最初の1回だけ記録される。
  - ⚠️ **fail-closed:** 壊れた hook は**全ツール呼び出しをブロック**しうる。だから `gate.sh` は何があっても `{}` exit 0（trap で保証）。**必ず fail-open。** ランチャも script 不在時に `{}` を出す。
  - ⚠️ `Stop` の `block`→継続は**遅い hook で不安定**（race）。`gate.sh` は軽量・同期で高速に保つ。
  - stdin: `transcriptPath` / `workspacePaths` / `conversationId` 等（camelCase）。`gate.sh` が吸収。
  - decision 契約: 他イベント（PreToolUse 等）は `allow|deny` だが、`Stop` は Claude 互換の `{"decision":"block","reason":…}` で継続を促す（earlier research で確認）。万一この層が効かなくても下記 `AGENTS.md` steering と本スキルのハードルールが完了ゲートを担保する。
- **steering 層:** `agy` は repo ルート `AGENTS.md`（と `~/.gemini/AGENTS.md` / `GEMINI.md`）を読む。→ **同じ tool-agnostic な `AGENTS.md` ゲートがそのまま効く**。Antigravity 専用調整が要れば `GEMINI.md`（優先度上）に書く。
  - 公式が「worktree ごとに `AGENTS.md` を置く」運用を推奨。並列 agent にはこれが最も確実な steering。

## まとめ: 二段防御

| CLI | 決定論的層（強制） | steering 層（穴埋め） |
|-----|------------------|--------------------|
| Claude Code | `.claude/settings.json` Stop+SessionStart hook ✅検証済 | （CLAUDE.md があれば。本ゲートは hook 主体）|
| Codex | `.codex/hooks.json` Stop+SessionStart（trust 要） | repo ルート `AGENTS.md` |
| Antigravity | `.agents/hooks.json` Stop + PreInvocation(=baseline)、名前付きgroup・fail-open 必須 | repo ルート `AGENTS.md`（agy が読む）|

3CLI とも `gate.sh` 1本を共有する。フィールド名差は `gate.sh` が吸収。最悪 hook が効かなくても、`AGENTS.md` の steering とハードルール1で「READ-ONLY で出さない／完了時に出す」を守る。
