# spec モード — 仕様・要件ダッシュボード

機能・要件・画面フロー・データを **1 枚で俯瞰**したいときに使う。
レビューや合意形成の前に「全体像を目視で確認」する用途。

生成前に `references/target-surface.md` を読み、対象 surface を決める。
`mobile-app` target の仕様可視化では、要件ダッシュボードだけでなく主要画面/flow preview を
phone-first で含める。ブラウザ表示は配布手段にすぎず、製品の surface を Web dashboard と
取り違えない。
User/project language も同時に決める。Korean prompt / Trip Jarvis では見出し・ラベル・
説明文を Korean にし、英語や日本語の固定文を残さない（ラベル対訳は `assets-contract.md`）。
デザイントークンは `references/ui-cache.md` の UI キャッシュ（fresh なら再調査省略、
`skin.css` を link）を使う。

## 構成

```
.tmp/<slug>/
├── shared.css
├── preview.js        # target surface / viewport 制御
├── index.html        # ダッシュボード（区画ごとに整理）
└── view-*.html       # 任意: 個別画面/フローの詳細（多いときだけ）
```

多くの場合 **index.html 1 枚**で足りる。画面が多い・各画面の詳細を見せたいときだけ `view-*` を足す。

## index.html に置く区画（対象に合うものを選ぶ）

`assets/index.template.html` の上半分（hero + grid）をベースに、`.card` を縦に並べて区画化する。

1. **概要 / ゴール** — 何のための仕様か。対象ユーザーと価値を 1 段落。
2. **機能一覧** — `table.grid` で `機能 / 説明 / 優先度 / 状態`。優先度・状態は `badge`。
3. **画面フロー** — 横並びのステップを矢印でつなぐ（下記スニペット）。主要導線を可視化。
4. **データモデル** — 主要エンティティを `.card` + `table.grid`（`フィールド / 型 / 説明`）。関連は注記。
5. **受け入れ基準（DoD）** — チェックリスト（`✓`/`□`）。「完成」の定義を明文化。
6. **スコープ外 / 非対象** — やらないことを明示（誤解の予防）。
7. **未決事項 / 論点** — `badge-warn` で要決定を強調。AskUser の材料になる。

## フローのスニペット

```html
<div class="row" style="flex-wrap:wrap; gap:8px;">
  <span class="chip">① 入力</span><span class="muted">→</span>
  <span class="chip">② 確認</span><span class="muted">→</span>
  <span class="chip">③ 生成</span><span class="muted">→</span>
  <span class="chip">④ 編集・共有</span>
</div>
```

状態バッジ: `badge-ok`（実装済/合意）, `badge-warn`（要決定）, `badge`（未着手）。

## 原則

- **実ファイル/実要件に基づく**。コードがあるなら Grep/Read で裏取りし、推測で機能を捏造しない。
- **1 画面でスクロールしながら全体が掴める**ことを優先。区画見出しを明快に。
- 未確定は隠さず「未決事項」に出す。目視確認の目的は**抜け漏れと論点の発見**。

## 仕上げ

`open index.html` 後、`AskUserQuestion`:
- Korean prompt / Trip Jarvis: 「이 사양으로 진행해도 될까요?」 選択肢 = 「OK, 진행」 / 「수정할 점이 있음」 / （未決があれば）その決定。
- Japanese prompt: 「この仕様で合っていますか？」 選択肢 = 「OK、進めて」 / 「直したい点がある」 / （未決があれば）その決定。

## チェックリスト

- [ ] 概要・機能一覧・データ・受入基準・スコープ外 のうち対象に必要な区画が揃う
- [ ] 未決事項を `badge-warn` で明示
- [ ] 機能・データは実要件/実コード根拠
- [ ] 1 枚でスクロール俯瞰できる
- [ ] `mobile-app` target では主要画面プレビューが phone-first
- [ ] 残存プレースホルダ 0 件（`grep -RnoE '__[A-Z0-9_]+__' .tmp/<slug>/`）
- [ ] 生成後に `open index.html` 実行
