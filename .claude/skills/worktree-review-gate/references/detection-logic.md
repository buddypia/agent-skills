# Detection logic — ガード節と設計根拠

`scripts/gate.sh` の `Stop` イベントは、以下のガード節を**上から順に**評価する。1つでも外れたら `{}` を出して `exit 0`（＝何もしない）。**あらゆる不確実性は「黙る」側に倒す。** これは「READ-ONLY で誤発火しない」を発火漏れより優先する、というユーザー要求に直結している。

## Stop のガード節（順序が重要）

| # | 条件 | 外れたら | 守るリスク |
|---|------|---------|-----------|
| 0 | 出力前に `trap … EXIT` で fail-open を保証 | 予期せぬ終了でも `{}` exit 0 | **Antigravity の fail-closed**（非0終了で agent が wedge） |
| 1 | `stop_hook_active == true` | 黙る | **無限ループ**（自分の block が次の Stop を誘発） |
| 2 | cwd を JSON から解決し `cd` | 黙る | cwd 誤り |
| 3 | `git rev-parse --is-inside-work-tree == true` | 黙る | git 管理外・READ-ONLY な非リポジトリ |
| 4 | `absolute-git-dir` ≠ `abs(git-common-dir)` | 黙る（＝メインリポ） | **メインリポでの誤発火**。命名に依存しない正準シグナル |
| 5 | `WTRG_WORKTREE_DIR`（既定 `.worktrees`）を path に含む | 黙る | 対象 worktree の限定（ユーザー規約）。**空にすれば任意の linked worktree で発火** |
| 6 | **session baseline が存在し、このセッションで HEAD かダーティ状態が変化** | 黙る | **READ-ONLY 誤発火（最重要）**。下記参照 |
| 7 | `PLAN.md` が worktree ルートに存在 | 黙る | 計画なき作業 |
| 8 | `- [x]` が1つ以上 かつ `- [ ]` が0個 | 黙る | 未完了（チェック残り） |
| 9 | base を `origin/HEAD`→`origin/main`→`origin/master`→`main`→`master` の順で**実在検証**して解決 | 黙る | base 誤検出（`--abbrev-ref origin/HEAD` はリモート無しでも文字列 `origin/HEAD` を返す罠を `--verify` で排除） |
| 10 | `git rev-list --count base..HEAD` が1以上 | 1未満なら「commit first」を block / rc≠0 なら黙る | 未コミット完了の取りこぼし（黙らず commit を促す） |
| 11 | transcript に `WTRG:APPROVAL:<short-HEAD>` が**無い** | あれば黙る | 同一 HEAD での二重出力・nag |
| → | 上記を全通過 → `{"decision":"block","reason":…}` で承認依頼を強制 | | |

## ガード6: READ-ONLY ガードはなぜ「セッション baseline」なのか

**誤った設計（敵対的レビューで否決）:** 「コミットが base より先行している」「PLAN.md が全チェック」を作業完了の代理指標にする。これらは**リポジトリ状態**であって**セッション状態**ではない。前のセッションで作業済み（コミット済み・PLAN 全チェック済み）の worktree を、新しいセッションが**ただ開いて読んだだけ**でも、stale なコミットと checklist を見て**誤発火**する。これはユーザーの「READ-ONLY で出すな」に真っ向から反する。

**正しい設計:** `SessionStart` で**そのセッションの起点**を記録する:

```
HEAD  <git rev-parse HEAD>
DIRTY <git status --porcelain | sort | sha1>
```

`Stop` で現在値と比較し、`HEAD` が進んだ **or** `DIRTY` が変わったときだけ「このセッションが変更した」とみなす。

- 読むだけ → HEAD 同じ・ダーティ同じ → **黙る** ✅
- コミットした → HEAD 進む → 変更あり ✅
- 未コミット編集だけ → ダーティ変化 ✅
- 起動時から残っていた未コミット変更（前セッションの残骸）→ baseline の DIRTY に含まれる → 読むだけなら一致 → **黙る** ✅

baseline が無ければ「このセッションが変更したか証明できない」→ **黙る**（fail-safe）。そのため `SessionStart` hook の併設が必須。

### baseline の書き込み規則

- **安定したセッション ID がある**（Claude: `session_id`, Antigravity: `conversationId`）→ **write-once**。resume / compaction で `SessionStart` が再発火しても上書きしない（セッション途中で起点がリセットされ、それ以前の作業が「無かったこと」になるのを防ぐ）。
- **安定 ID が取れない CLI** → `SessionStart` を新セッション境界とみなし**毎回上書き**（stale baseline による誤発火を防ぐ）。

## ガード11: なぜ transcript sentinel で、なぜ HEAD 固有か

**否決された設計:** block する前に marker ファイルを書く。→ model が block 指示を無視/失敗すると marker だけ残り、**その HEAD では永久に承認依頼が出せなくなる**（発火漏れ）。

**採用:** 承認依頼テンプレ末尾の `<!-- WTRG:APPROVAL:<short-HEAD> -->` を **transcript から grep**。

- **HEAD 固有**だから、修正で新コミット → HEAD 変化 → 再度承認依頼を促す（修正後の再承認が自然に効く）。同じ HEAD では二重に出さない。
- **自己満足の罠の回避:** block の `reason` には実 sha を入れず、プレースホルダ `SHORTHEAD` を書く。`reason` テキストが transcript に入っても grep（実 sha）にヒットせず、model が実 sha を埋めて初めてヒットする。
- transcript が読めない場合は「sentinel 無し」とみなし**発火**する。これは安全な degrade — 誤発火はガード6（baseline、transcript 非依存）が独立に防ぐので、最悪でも「変更済み・完了済み worktree で1回多く促す」だけ。READ-ONLY では決して出ない。

## 実証済みの git 挙動（throwaway worktree で検証）

| 問い | 結論 |
|------|------|
| linked worktree 判定 | `--absolute-git-dir` と abs `--git-common-dir` が**メイン=一致 / linked=不一致**。`--is-inside-work-tree` は両方 true で無意味。`--show-toplevel` の `.worktrees/` 判定は規約依存なので追加フィルタ止まり |
| 非コミット marker 置き場 | `<absolute-git-dir>/review-gate/`（= linked worktree 専用の `.git/worktrees/<name>/`）。`git status` に出ず、兄弟 worktree と衝突しない |
| base 不明時の `rev-list --count` | rc=128・stdout 空 → rc を見て fail-safe |
| `--abbrev-ref origin/HEAD`（リモート無し） | 文字列 `origin/HEAD` を返す → `--verify --quiet <cand>^{commit}` で実在検証してから採用 |
| PLAN チェック正規表現 | `^[[:space:]]*[-*][[:space:]]+\[[xX]\]`(done) / `\[[[:space:]]\]`(todo)。インデント・`*` 弾も許容 |
