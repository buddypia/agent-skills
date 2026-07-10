# review モード — 変更前後の差分を見せる

ある変更の **before / after と影響範囲**を、人間が目視で確認できるようにする。
実装前の方針確認、または実装後のレビュー補助に使う。

生成前に `references/target-surface.md` を読み、対象 surface を決める。
`mobile-app` target の before/after は基本的に phone viewport を並べる。
説明用の差分表は別領域に置き、iframe/embed preview はアプリ画面だけを見せる。
User/project language も同時に決める。Korean prompt / Trip Jarvis では差分見出し・
ラベル・説明文を Korean にし、英語や日本語の固定文を残さない。

**UI 変更のレビューでは `references/ui-cache.md` と `references/review-checklist.md` を必ず読む** —
before は UI キャッシュの実トークン/実コンポーネント構造で「現状を忠実に」再現し
（キャッシュが fresh ならソース再調査は省略）、after だけを変更案にする。
before 自体が現状と違うと差分レビューの前提が崩れる。

## 構成

```
.tmp/<slug>/
├── shared.css
├── skin.css          # UI キャッシュ由来の見た目上書き（shared.css の後に link）
├── preview.js        # target surface / viewport / チェックリスト制御
└── index.html        # before/after 並置 + 影響範囲 + レビューチェックリスト + 根拠
```

UI 変更で「実画面の before/after」を見せたいときは `view-before.html` / `view-after.html` を作り、
index に 2 つの `.frame` を**横並び**で iframe 表示する（`fitFrames()` がフィット）。

## index.html の構成

1. **変更の概要** — 何を、なぜ変えるか（1 段落）。
2. **Before / After 並置** — `.grid2` で左右に置く。種類別に:
   - **UI 変更**: 左右に `.frame > iframe`（view-before / view-after）。
   - **テキスト/構造変更**: 左右の `.card` に箇条書きで対比（旧 → 新）。
   - **コード変更**: `<pre>` を左右。変更行を `background: rgba(52,211,153,.12)`（追加）/
     `rgba(248,113,113,.12)`（削除）でハイライト。
3. **影響範囲** — `table.grid` で `対象（ファイル/領域） / 種別（UI/API/データ/挙動） / リスク`。
   リスクは `badge-ok`（小）/ `badge-warn`（要注意）。
4. **レビューチェックリスト（UI 変更では必須）** — `references/review-checklist.md` の
   選定ルールで変更種別に合った項目を 5〜12 個生成し、before/after の直下に置く。
   各項目の確認方法は実トークン・実ファイル名で具体化する。
5. **根拠 / ロールバック** — なぜこの変更が妥当か + 元に戻す手段（PR revert 等）。

## Before/After 並置スニペット

```html
<div class="grid2">
  <div>
    <div class="section-label" style="margin-bottom:8px;">Before</div>
    <div class="frame"><iframe src="view-before.html?embed=1" data-view-src="view-before.html" scrolling="no"></iframe></div>
  </div>
  <div>
    <div class="section-label" style="margin-bottom:8px;">After</div>
    <div class="frame"><iframe src="view-after.html?embed=1" data-view-src="view-after.html" scrolling="no"></iframe></div>
  </div>
</div>
```

`data-view-src` は preview.js の必須フック（viewport 切替時に src を再構築する。
詳細は `assets-contract.md`）。省くと viewport 切替が iframe に反映されない。

## 原則

- **対称に並べる** — 同じ枠・同じ縮尺で左右を比べられるようにする。差分が一目で分かることが価値。
- **影響範囲を省かない** — 「見た目」だけでなく、どのファイル/領域に波及するかを表で示す。
- 実変更（diff・実ファイル）に基づく。やってない変更を盛らない。

## 仕上げ

`open index.html` 後、`AskUserQuestion`（レビューチェックリストがある場合はそれを踏まえる —
正本は `references/review-checklist.md` の「仕上げ」節）:
- Korean prompt / Trip Jarvis: 「체크리스트를 확인하고 진행해도 될까요?」 選択肢 = 「전 항목 OK, 진행」 / 「지적 있음」 / 「보류」。
- Japanese prompt: 「チェックリストを確認して進めてよいですか？」 選択肢 = 「全項目 OK、進めて」 / 「指摘あり」 / 「保留」。
- 「指摘あり」の場合はどの項目かを聞き、修正タスクにそのまま渡す。

## チェックリスト

- [ ] before / after が対称に並ぶ
- [ ] before が UI キャッシュの実トークン/構造に基づく（現状の忠実な再現）
- [ ] `mobile-app` target では phone viewport 同士で比較されている
- [ ] 影響範囲の表がある（ファイル/領域・種別・リスク）
- [ ] UI 変更ではレビューチェックリスト区画がある（5〜12 項目・確認方法が具体的）
- [ ] 差分（追加/削除/変更）が視覚的に分かる
- [ ] ロールバック手段を明記
- [ ] 残存プレースホルダ 0 件（`grep -RnoE '__[A-Z0-9_]+__' .tmp/<slug>/`）
- [ ] 生成後に `open index.html` 実行
