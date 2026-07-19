# assets 契約 — テンプレート・preview.js・shared.css の使い方

`assets/` はスキル本体の資産で**読み取り専用**。生成時は `.tmp/<slug>/` にコピーし、
**コピー先だけ**を編集する（スキル本体を書き換えると全プロジェクトに波及する）。

## ファイルの役割

| ファイル | 役割 | 生成時の扱い |
|---|---|---|
| `index.template.html` | 比較/ダッシュボードページの骨格 | 中身を埋めて `index.html` として保存 |
| `view.template.html` | フル画面ビューの骨格 | ビューごとに `view-*.html` として保存 |
| `shared.css` | 共通スタイル + デザイントークン | コピー後、コピー先の `:root` を対象プロダクトに合わせ調整 |
| `preview.js` | viewport / mode / embed / iframe fit / チェックリスト制御（メモ・コピー・ブリッジ送信含む） | **無編集で**コピー |
| `ui-scan.mjs` | プロジェクト UI 資産のスキャン + キャッシュ鮮度判定 | コピーせず**スキル内から直接実行**（`references/ui-cache.md` 参照） |
| `review-bridge.mjs` | チェックリスト判定の受信 → `review-result.json` 書き出し（CLI 連携） | コピーせず**スキル内から直接実行**（`references/review-checklist.md`「CLI 連携」節参照） |

UI キャッシュ（`<project>/.tmp/spec-preview/ui-cache/`）に `skin.css` がある場合は
`.tmp/<slug>/` にコピーし、各 HTML で `shared.css` の**後に** link する
（skin が shared の既定トークンを上書きする — 順序を逆にすると効かない）:

```html
<link rel="stylesheet" href="shared.css" />
<link rel="stylesheet" href="skin.css" />
```

## preview.js が要求する DOM フック

以下の属性・クラス名を変えたり消したりすると**黙って壊れる**。生成時は名前を維持する。

| ページ | フック | 効果 |
|---|---|---|
| 共通 | `body[data-page="index"\|"view"]` | ページ種別の宣言。JS 分岐の起点 |
| index | `body[data-frame-viewport]` | ミニプレビューの初期 viewport（`__DEFAULT_VIEWPORT__` を置換） |
| index | `.frame > iframe[data-view-src]` | `fitFrames()` が枠幅に合わせ縮小。viewport 切替時に `data-view-src` から `src` を再構築 |
| index | `.frame .open-overlay` | hover で出る全画面リンク。クリック時は**画面遷移せず現在画面の全画面モーダル**で開く（下記参照）。viewport 切替時に `href` も再構築 |
| index | `a[data-fullview]` | 任意のリンクを全画面モーダル表示にする opt-in。`data-fullview-title` でモーダルのタイトルを指定可 |
| index | `button[data-frame-viewport="phone\|tablet\|desktop"]` | ミニプレビュー全体の viewport 切替 |
| view | `body[data-viewport]` | device-frame の端末寸法切替（shared.css が参照） |
| view | `body[data-mode="app"\|"explainer"]` | app = 製品画面のみ / explainer = 説明文併記 |
| view | `button[data-viewport-target]` / `button[data-mode-target]` | view 内の viewport / mode 切替ボタン |
| index | `[data-checklist]` / `li[data-check-item]` / `.check-actions` / `[data-checklist-progress]` | レビューチェックリスト（OK/要修正トグル + localStorage 保存 + 進捗表示）。要修正時のメモ欄・回収 UI（結果をコピー / ブリッジ接続状態）は preview.js が自動生成する。マークアップ契約の正本は `references/review-checklist.md`。ボタンラベル・進捗文言は `html lang` から JS が自動選択（`__LABEL_*__` ではない） |

## 全画面モーダル（「全画面で開く」の挙動）

`a.open-overlay` と `a[data-fullview]` のクリックは preview.js が横取りし、ページ遷移せず
**現在画面のオーバーレイ**（`.fullview-overlay` / `.fullview-bar` / `.fullview-iframe`）で
view を全画面表示する。テンプレートに追加マークアップは不要 — DOM は JS が生成し、
スタイルは shared.css が持つ。

- `href` は no-JS 時・修飾キー付きクリック（Cmd/Ctrl/Shift/Alt）時のフォールバックとして
  そのまま新規タブで開く。リンクの `href` / `target="_blank"` を消さないこと
- 閉じる: ✕ ボタン / Esc キー。モーダル内には「新しいタブで開く」リンクも出る
- バーの「閉じる」「新しいタブで開く」ラベルは `html lang`（ja/ko/en）から JS が自動選択する
  （`__LABEL_*__` プレースホルダではない）
- 表示中は `body[data-fullview="1"]` が付き、背面のスクロールがロックされる

**viewport 属性は2系統ある**ことに注意:
- index の `data-frame-viewport` = ミニプレビュー**枠の縮尺**（fitFrames が iframe を scale）
- view の `data-viewport` = **device-frame の端末寸法**（shared.css の `--device-width` 切替）

名前が似ているが役割が違う。混同しない。

## 寸法の対応（変更時は両方を更新）

| viewport | preview.js `frameBase`（iframe 外寸） | shared.css `--device-width/height`（端末枠） |
|---|---|---|
| phone | 430 × 840 | 390 × 780 |
| tablet | 820 × 860 | 760 × 820 |
| desktop | 1280 × 800 | 1040 × 720 |

`frameBase` は「device-frame + embed 表示時の余白」を包む外寸。端末サイズを変えるときは
preview.js と shared.css の両方を揃えて更新する。

## URL クエリ（生成 HTML が解釈する語彙）

- `?viewport=phone|tablet|desktop` — 表示する端末寸法
- `?mode=app|explainer` — app = 製品画面のみ / explainer = 説明文併記。
  `comparison` は index.html（比較ページ）自体を指す論理モードで、view の `?mode` には現れない
- `?embed=1` — ヘッダー・説明を隠し製品 surface だけ表示（index のミニプレビュー用）
- `?bridge=<port>` — review-bridge.mjs の待受 port（既定 7357。既定 port で起動していれば
  クエリ不要、ブリッジ未使用なら無視される）

## プレースホルダ一覧（`__*__` はすべて置換必須）

生成後に `grep -RnoE '__[A-Z0-9_]+__' .tmp/<slug>/` が **0 件**であることを確認する。
1個でも残ると、閲覧者のブラウザに `__LABEL_OPEN_FULL__` のような生文字列が表示される。

### 共通（両テンプレート）

| プレースホルダ | 入れるもの |
|---|---|
| `__LANG__` | `html lang` 属性値（`ko` / `ja` / `en`） |
| `__TITLE__` | ページタイトル（対象 + 目的） |
| `__TARGET__` | target surface（`mobile-app` 等。**英語のまま**） |
| `__DEFAULT_VIEWPORT__` | 既定 viewport（`phone` / `tablet` / `desktop`。**英語のまま**） |
| `__PRODUCT_NAME__` | 対象プロダクト名 |
| `__SUBTITLE__` | ヘッダーの補足ラベル |
| `__EYEBROW__` | 見出し上の小ラベル |

### index.template.html

| プレースホルダ | 入れるもの |
|---|---|
| `__HEADLINE__` / `__INTRO__` | ページ見出し / 導入1段落 |
| `__ISSUE_1__` …（複数可） | 現状課題（実ファイル根拠で3〜5個） |
| `__INSIGHT_1__` …（複数可） | 知見・業界の方向性（WebSearch したら出典を `.ref` に） |
| `__OPTION_A_TITLE__` / `__OPTION_A_DESC__` | 案のタイトル / 一言説明（案ごとに B, C…と複製） |
| `__PRO_1__` / `__PRO_2__` … | 長所（✓リスト） |
| `__TRADEOFF_OR_COST__` | 注意・トレードオフ |
| `__SOURCE_OR_SIMILAR_PRODUCT__` | 出典・類似プロダクト |
| `__SUMMARY_BODY__` | 推奨理由と次アクション |

### view.template.html

| プレースホルダ | 入れるもの |
|---|---|
| `__VIEW_HEADLINE__` / `__VIEW_DESC__` | この案/ビューの見出し / 説明（explainer mode で表示） |
| `__DECISION_NOTE__` | 判断材料・トレードオフ |
| `__STATUS_BADGE__` | アプリバーの状態表示 |
| `__BOTTOM_INPUT__` / `__CTA__` | 下部の入力/ナビ文言 / CTA 文言 |

### `__LABEL_*__` 対訳表（UI ラベルの正本）

生成のたびに訳語を即興で決めない。この表の値を使う。

| プレースホルダ | ja | ko | en |
|---|---|---|---|
| `__LABEL_PHONE__` | スマホ | 휴대폰 | Phone |
| `__LABEL_TABLET__` | タブレット | 태블릿 | Tablet |
| `__LABEL_DESKTOP__` | デスクトップ | 데스크톱 | Desktop |
| `__LABEL_APP__` | アプリ | 앱 | App |
| `__LABEL_EXPLAINER__` | 説明 | 설명 | Explainer |
| `__LABEL_OPEN_FULL__` | 全画面で開く | 전체 화면으로 열기 | Open full view |
| `__LABEL_OPEN_A__`（案ごとに複製） | 案Aを開く | A안 열기 | Open option A |
| `__LABEL_CURRENT_ISSUES__` | 現在の課題 | 현재 과제 | Current issues |
| `__LABEL_GUIDANCE__` | 業界の参考・方向性 | 업계 참고/방향 | Industry guidance |
| `__LABEL_CAUTION__` | 注意 | 주의 | Caution |
| `__LABEL_REFERENCE__` | 参考 | 참고 | Reference |
| `__LABEL_SUMMARY__` | まとめ・推奨 | 요약·추천 | Summary & recommendation |
| `__LABEL_RECOMMENDED__`（badge-rec） | おすすめ | 추천 | Recommended |

`title` / `aria-label` 属性も対象言語に揃える（canonical な flag 値・クエリ値のみ英語）。
