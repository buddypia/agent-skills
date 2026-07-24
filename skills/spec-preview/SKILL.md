---
name: spec-preview
description: >-
  仕様・要件・UI改善案を、人間がブラウザで目視確認できる自己完結HTMLに起こして自動で開く。
  proposals（複数案比較）/ spec（仕様ダッシュボード）/ review（before/after差分）の3モード。
  target surface（mobile-app〜diagram）と言語（ja/ko/en）を判定し、
  モバイルアプリでは phone-first プレビューを既定にする。対象プロジェクトの UI 資産を
  スキャンして .tmp/spec-preview/ にキャッシュし、fresh なら再調査なしで元 UI の見た目を再現。
  UI レビュー時は人間向けチェックリストを埋め込み、判定を CLI エージェントに構造化して還流できる。
  「HTMLで画面UIを提案して」「モックで見せて」「UIを改善案として見せて」「仕様を可視化して」
  「要件を整理して見せて」「複数案を比較したい」「before/afterを並べて」
  「UIレビューして/レビューできる形にして」「目視で確認できる形にして」等で必ず発動する。
  /spec-preview でも起動。
---

# spec-preview — 目視確認できるHTMLに起こすスキル

## なぜこのスキルがあるか

仕様・要件・UI案を文章だけで渡すと読み飛ばされ、意思決定が遅れる。
ブラウザで「触れる」自己完結HTMLにすると、人間が一目で全体像をつかみ、
その場で選択・指摘できる。このスキルは、その成果物を**毎回同じ作法で素早く**
作り、必ずブラウザで開いて確認まで導くためのもの。

成果物のゴールは「きれいなHTML」ではなく「**人間が見て即決できること**」。
飾りより、現状・選択肢・トレードオフが一目で分かることを優先する。

## いつ・どのモードを使うか

ユーザーの意図から次の3モードを選ぶ。曖昧なら `AskUserQuestion` で確認する。

| 状況 | モード | index に並ぶもの |
|------|--------|------------------|
| 方向性が複数あり、その中から選んでほしい | **proposals** | 各案の比較 + 推奨。各案はフル画面ビューへ |
| 機能・要件・画面フロー・データを1枚で俯瞰したい | **spec** | 要件ダッシュボード（区画ごとに整理） |
| ある変更の前後・影響を見せたい | **review** | before / after の並置 + 影響範囲 |

各モードの具体的な作り方は `references/` を読む（**生成前に必ず該当ファイルを読む**）:
- proposals → `references/proposals.md`
- spec → `references/spec.md`
- review → `references/review.md`
- target / viewport / lang の判定 → `references/target-surface.md`
- テンプレートの埋め方（DOM フック・プレースホルダ一覧・ラベル対訳）→ `references/assets-contract.md`
- UI キャッシュ（スキャン / 鮮度判定 / skin.css）→ `references/ui-cache.md`
- 人間レビュー項目の選定と埋め込み → `references/review-checklist.md`

## ワークフロー

1. **モード判定** — proposals / spec / review のどれかを決める。迷ったら AskUser。
2. **Target Surface 判定** — `references/target-surface.md` を読み、
   `--target=auto|mobile-app|tablet-app|web-app|desktop-app|document|diagram`,
   `--viewport=auto|phone|tablet|desktop`,
   `--preview-mode=app|explainer|comparison`（`comparison` は index 比較ページ自体を指し、
   view では `app|explainer` のみ）, `--lang=auto|ko|ja|en` の実効値を決める。
   これらの flag は CLI ではなく、ユーザー指定と自動判定の結果を表す正規語彙
   （生成 HTML の URL クエリも同じ語彙を使う）。
   韓国語/日本語の prompt phrases も target 判定の一次情報として扱う。ブラウザで開くことと
   Web UI を作ることを混同しない。Flutter / iOS / Android / React Native なら
   既定は `target=mobile-app`, `viewport=phone`。Trip Jarvis のように
   `CLAUDE.md` が韓国語 MVP を宣言する場合は `lang=ko`。
3. **Scope把握** — 対象（コード・要件・変更）を読み、現状と課題を 1〜2 段落に整理する。
   コードが対象なら関連箇所を Grep/Read（広いときは Explore サブエージェント）で特定する。
   推測で書かない。実際のコード・ファイルに基づく。
4. **（任意）根拠収集** — UI/UX やドメインのベストプラクティスが効くとき（特に proposals）は
   `WebSearch` で 1〜2 件調べ、index の industry guidance（韓国語なら「업계 참고/방향」）
   や各案の reference（韓国語なら「참고」）に出典を添える。
5. **UI キャッシュ（デザイントークン + コンポーネント）** — `references/ui-cache.md` を読み、
   `node <skill>/assets/ui-scan.mjs check --project <project-root>` で鮮度を判定:
   - **fresh** → `ui-cache.json` + `skin.css` をそのまま再利用。**ソース再調査は省略する**
     （コストカットの本体。fresh なのに globals.css / theme.dart 等を読み直さない）。
   - **stale / missing** → `scan` を実行 → AI 確定（targetSurface / lang / aiNotes）→ `skin.css` 生成。
     scan はフレームワーク横断（Web CSS / Tailwind / JS・TS theme / Flutter Dart /
     Android colors.xml / iOS colorset）— 抽出結果は `tokens.cssVars`（CSS 変数）と
     `tokens.colors`（名前→色）に入る。
   - プロジェクト構造が特殊で scan が何も拾えない場合のみ、従来どおり `globals.css` /
     `tailwind.config` / theme ファイルを手動調査し、`:root` 上書きで fallback する。
6. **生成** — `references/assets-contract.md` を読み、`.tmp/<slug>/`（slug は内容を表す
   短い識別子。例 `home-ui` / `auth-spec`。プロジェクトルート直下に作る）に出力:
   - `shared.css` … `assets/shared.css` を無編集でコピー
   - `skin.css` … UI キャッシュからコピーし、各 HTML で `shared.css` の**後に** link
     （スキルの `assets/` 配下は読み取り専用。トークン調整はキャッシュ側 skin.css で行う）
   - `preview.js` … `assets/preview.js` を無編集でコピー（viewport / embed / iframe fit /
     チェックリスト制御）
   - `index.html` … `assets/index.template.html` を骨格に、モード別 `references` の指示で中身を埋める
   - `view-*.html` … 必要に応じ `assets/view.template.html` を骨格にフル画面ビュー（proposals は案ごと）
   - **レビューチェックリスト** … UI の新規/修正を見せる場合は `references/review-checklist.md`
     の選定ルールで、変更種別に合った項目を 5〜12 個 index に埋め込む（review モードでは必須）
   - `__*__` 形式のプレースホルダは**すべて**置換する。一覧と ja/ko/en ラベル対訳は
     `references/assets-contract.md` が正本。生成後に
     `grep -RnoE '__[A-Z0-9_]+__' .tmp/<slug>/` が 0 件であることを確認する。
   すべて**スタンドアロン**（`file://` でダブルクリック起動できる）。重い外部 CDN 依存は避け、
   共通スタイルは相対 `link` で `shared.css` を読む。JS は vanilla（タブ切替・iframe自動フィット程度）。
7. **自動で開く + 目視確認を促す**（下記2節）。

## 出力規約

- **置き場所は必ず `.tmp/<slug>/`**（プロジェクトルート直下）。対象プロジェクトの
  `.gitignore` に `.tmp/` が含まれるか確認し、なければ追記を提案する（勝手にコミットしない）。
- **自己完結**。1フォルダをそのまま渡せば誰でもブラウザで開ける。
- **言語は user/project に追従**。会話・説明・生成UIラベルはユーザーの言語を基本にし、
  project guidance が product language を宣言している場合はそれを優先する。
  Trip Jarvis では韓国語 UI を既定にする。デザイントークンは対象プロダクト準拠。
- **Target-aware UI**。ブラウザは配布手段であり、UI の既定形は target surface に従う。
  `mobile-app` なら index の iframe は `?viewport=phone&embed=1` を既定にし、
  view には viewport 切替（`phone / tablet / desktop`）と mode 切替（`app / explainer`）を置く。
- `index.html` には必ず: ①対象と課題のサマリ ②view を作る場合は各項目への導線
  （iframeミニプレビュー。spec で index 1 枚に収めるなら不要） ③proposals なら推奨。
- iframeミニプレビューは「マウスを乗せるとフル画面で開ける」+ `assets/preview.js` で
  target surface / viewport に合わせて自動フィットさせる。

## 自動で開く

生成後、OS に応じて `index.html` を開く（macOS 既定は `open`）:

```bash
open <path>/index.html          # macOS
xdg-open <path>/index.html      # Linux
start "" <path>\index.html      # Windows
```

開けない環境（ヘッダレス/リモート）では、フルパスを提示して
「ブラウザで開いてください」と案内する。作って終わりにしない。

## 仕上げ: 目視確認を促す

ブラウザを開いたら、`AskUserQuestion` で次に繋げる。質問文と選択肢の**正本は
各モードの references の「仕上げ」節**（user/project language に合わせる）。共通の型:

- **proposals**: 「どの案を採用しますか？」（各案 + 保留の選択肢）
- **spec / review**: 「この内容で進めてよいですか？」（OK + 修正ありの選択肢）

ユーザーの選択を、次のアクション（実装・修正）にそのまま渡す。
レビューチェックリストがある場合、判定の回収は口頭に頼らず
`references/review-checklist.md`「CLI 連携」節に従う（「結果をコピー」の貼り付け）。

## アンチパターン（最終チェック）

各規則の正本は上のワークフロー・出力規約と references。生成を終える前に再確認する:

- open 忘れ / `.tmp/<slug>/` 以外への出力 / スキル `assets/` の直接編集
- fresh キャッシュの再スキャン・stale キャッシュの放置（`ui-scan.mjs check` に従う）
- プレースホルダの置き残し（手順6の grep 検査を省かない）
- チェックリストの全部盛り（変更種別に合った 5〜12 個に絞る）・判定の回収忘れ
- 過剰な作り込み — モック/可視化であり本実装ではない。ダミーデータと簡易 JS、案は通常 2〜4 個
- 巨大インラインCSSの重複 — 共通は `shared.css`、index 固有の比較レイアウトだけ index 内 `<style>`
- Webページ化の取り違え（mobile-app なのに Web hero / landing で作る）・
  韓国語 product への英語/日本語ラベルの流出
- 推測で埋める — 現状分析は実ファイルに基づく。不明点は AskUser か明示の TODO に
