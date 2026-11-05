# html-artifacts - 自己完結HTMLアーティファクト生成スキル

任意の入力（レポート / 仕様 / コードレビュー / ダッシュボード / 図解 / プロトタイプ / ワイヤーフレーム など）を、**単一の自己完結 `.html`** に変換する Agent Skills 対応スキル。Claude Code、Codex などで利用できる。
CDN・外部ライブラリ・ビルドステップは一切不要（Vanilla HTML/CSS/JS のみ）。CSS は `<style>`、JS は `<script>` にすべてインラインされ、生成物は**オフラインのままどのブラウザでも開ける**。
スキル本体は `~/.agents/skills/html-artifacts/` にあり、`~/.claude/skills/html-artifacts` はそこへの symlink。

> まず **[`index.html`](./index.html)** を開くこと - ライブテーマ切替つきのマスターギャラリー（このファイル自体がシステムの一例）。

## インストールと実行環境

`buddypia/agent-skills` の `skills/html-artifacts/` を、利用するエージェントのスキルディレクトリへコピーする。リポジトリのインストール方法は [agent-skills](https://github.com/buddypia/agent-skills#install) を参照。

生成・検査ツールは Node.js 18 以降の標準機能のみを使用する。生成した HTML の閲覧には Node.js もネットワーク接続も不要。ブラウザ自動検査には別途 `chrome-cli`（旧名 `pw-agent`）が必要で、未導入の場合は未検証として報告する。

---

## 使い方

**(a) コマンド**

```
/html-artifacts <作りたいもの>
```

**(b) 暗黙トリガ** - 「HTMLにして」「ダッシュボードにして」「図解して」「インタラクティブにして」「可視化して」「ワイヤーフレームにして」等のフレーズでも自動発動する（韓国語・日本語の依頼表現も第一級の判定シグナル）。

**(c) 明示的な上書き** - `--shape=` / `--theme=` / `--target=` をリクエストに添える。ブランドカラーは `--accent` の上書きで適用する。

例:

```
/html-artifacts Q2メトリクスのインタラクティブダッシュボード --theme=dark-focus
/html-artifacts 決済サービスのER図（ドラッグ可能） --shape=diagram --target=diagram
```

---

## 生成フロー（8フェーズ + 任意のSCANゲート）

```
DECIDE → TARGET → (SCAN if current UI) → DETECT → THEME+LAYOUT → ASSEMBLE → FILL → VALIDATE → DELIVER
```

| # | フェーズ | 1行要約 |
|---|---------|---------|
| 1 | DECIDE   | そもそも HTML 化する価値があるか判断（視覚階層・図・インタラクション・共有性が要るなら HTML） |
| 1b | BRIEF   | 規模（S / M / L）を見積もり、ユーザーの明示的な要求を `brief.requirements` に 1 件ずつ書く。各セクションが `covers` で担当を宣言し、未対応の要求があるとビルドが止まる |
| 2 | TARGET   | target surface（mobile-app / tablet-app / web-app / desktop-app / document / diagram）と viewport・言語を判定 |
| 2b | SCAN     | 現行UI・既存画面・ローカルURL・スクショを忠実に写す要求なら、repo / running app / computed style / responsive / states を先に収集 |
| 3 | DETECT   | 出力 shape（report / spec / code-review / data-viz / diagram / infographic / prototype / editor）を決定 |
| 4 | THEME+LAYOUT | テーマ + ページ軸（layout / header / density）を**明示的に**選択（黙って既定に落とすのは契約違反）。`--theme=` や `--accent` 上書きも可 |
| 5 | ASSEMBLE | `base.template.html` を骨格に、コアCSSとモジュールをインライン合成 |
| 6 | FILL     | 各モジュールの `{{VARIABLES}}` に実データを充填（言語・SVG座標を含む） |
| 7 | VALIDATE | build 前の spec チェック（型・列挙値の誤字 / 必須データ / 未対応の要求 / blueprint のサンプル残り）→ `tools/render-check.mjs`（1280px・390px のブラウザ検査とスクリーンショット）→ `tools/validate.mjs`（外部依存ゼロ / `{{ }}` 残置なし / SVG a11y など） |
| 7b | LOOK    | スクリーンショットを実際に見て、結論が最初の画面にあるか・数値に単位があるか・詰まりや切れがないかを確認して直す |
| 8 | DELIVER  | 単一の自己完結 `.html` を出力し、絶対パス・要求台帳・選んだ 4 軸・未確認事項を提示（`open <file>` で開く）。セッションのスクラッチには置かない |

詳細 → [`reference/01-overview-and-flow.md`](./reference/01-overview-and-flow.md)

---

## テーマ（10種）

`<html data-theme="…">` の属性ひとつで全要素が切り替わる。`data-theme-toggle` ボタンでダークへトグル。

| テーマ | 配色の印象 | 向く用途 |
|--------|-----------|---------|
| `birchline`（既定） | 暖色アイボリー地 + クレイ系アクセント。落ち着いたプロフェッショナル調 | report / spec / 長文 |
| `dark-focus` | ダーク地 + ブルーアクセント。内側グローで高コントラスト | data-viz / diagram / code |
| `interactive-warm` | クリーンな白地 + ブルーアクセント。影でインタラクティブ要素が際立つ | prototype / editor |
| `minimal` | セリフ見出し + 静かな余白広めの文書調 | エッセイ・長文リーディング |
| `midnight` | ダーク地 + バイオレットアクセント | ダーク系の雰囲気替え（図解・ダッシュボード） |
| `slate` | ライト地 + ブルーグレー。ビジネス資料調 | 業務レポート・管理画面系 |
| `forest` | ライト地 + アースグリーン | 自然・環境・落ち着いたトーンの資料 |
| `rose` | ライト地 + 暖色マゼンタ | プロダクト紹介・柔らかいトーンの資料 |
| `nord` | ダーク地 + 北欧系アイスブルー（Nord 配色） | コード・技術文書のダーク代替 |
| `sunset` | ダーク地 + 暖色アンバー | 暖色系ダークの雰囲気替え |

カスタムパレットは `<html data-theme="birchline" style="--accent:#2563EB;--on-accent:#fff">` のように `--accent` を上書きする（`color-palette` スキルで11段スケールを生成して `--accent`/`--cat-*` に流し込むのも可）。
**詳細・WCAG コントラスト値の正は [`reference/03-themes-and-palettes.md`](./reference/03-themes-and-palettes.md)。**

---

## ページの軸（layout / header / density）

テーマに加えて、ページ全体のシルエットを決める 3 つの軸を選べる。spec で未指定の軸はビルダーがセクション構成から決定的に導出し、導出結果を 1 行ログに出す（`defaults: theme=… layout=… header=…` - 明示指定が常に優先）。

| 軸 | 置き場所 | 値 |
|----|---------|-----|
| layout | `<html data-layout>` + `<main class="container layout-…">` | `stack`（縦積み・既定） / `bento`（12カラムグリッド、セクション毎に `--span`） / `sidebar`（固定サイドレール + 本文） / `split`（全幅ヒーロー + 2カラム） |
| header | `.page-header` のマークアップバリアント | `standard` / `compact`（1行） / `banner`（全幅の帯） / `split`（タイトル + メタ表） / `none`（コントロールのみ） |
| density | `<html data-density>` | `comfortable`（既定） / `compact` / `spacious` - `--sp-unit` 経由で余白スケール全体が変わる |

各テーマは色に加えて**構造的な個性**（`--type-*` / `--radius-*` の上書き）も持ち、セリフ編集系（birchline / rose / forest / minimal）・太字サンセリフ系（sunset / nord / interactive-warm）・テクニカル系（slate / midnight / dark-focus）の3系統に分かれる。余白（`--sp-*` / `--sp-unit`）とページ幅（`--container-max`）はテーマが触らず、density / layout / artifact 側の専有。

連続する2つの成果物が theme+layout+header の組をそのまま共有しないこと（内容が要求する場合を除く）。詳細の正: spec キー・導出表 → [`reference/07-build-spec.md`](./reference/07-build-spec.md)、テーマ個性と density トークン → [`reference/03-themes-and-palettes.md`](./reference/03-themes-and-palettes.md)、モジュール variant（kpi / chart / table / comparison / decision） → [`reference/04-module-catalog.md`](./reference/04-module-catalog.md)。

---

## ディレクトリ構成

```
html-artifacts/
├── SKILL.md                       ← スキル定義（コマンド・8フェーズ・制約の正）
├── README.md                      ← このファイル（人間向けの入口）
├── index.html                     ← マスターギャラリー（ライブテーマ切替・カタログ）
├── templates/
│   ├── base.template.html         ← {{VARIABLES}} 骨格（インライン順序を記載）
│   ├── core/                      ← 基盤レイヤ一式
│   │   ├── reset.css  tokens.css  themes.css  elements.css  interactions.js
│   ├── modules/                   ← 名前つきモジュール 117種・5ファミリー（カタログは reference/04、索引は index/）
│   └── blueprints/                ← 文書ジャンル別の設計図 11種（そのまま build 可能な spec + _recipe 適応ガイド。基準は reference/10）
│       ├── charts: kpi-grid / stat-trend / chart-bar / chart-line / chart-donut
│       │           chart-stacked / gauge / radar / funnel / progress / chart-bullet / heatmap / cal-heatmap
│       ├── diagrams: flow-diagram / arch-diagram / erd / node-graph / mindmap
│       │             timeline / stepper / mockup-frame / screen-flow / wireframe-block
│       ├── interactive: data-table / tabs / collapsible / tree / slider-control / kanban-board / form-fields
│       ├── document: callout-box / comparison-grid / decision-matrix / diff-block / stat-list / activity-feed / empty-state / checklist
│       └── content: feature-grid
├── index/                         ← コンポーネント索引（モジュール選定の入口）
│   ├── components.json            ← 単一の正: 全117モジュールの機械可読メタ（tags/intent/useWhen/inputShape…）
│   ├── INDEX.md                   ← 超小型の要約索引（約9KB・1行/モジュール、まず読む層）
│   └── COMPONENTS.md              ← フル散文索引（components.json から自動生成）
│       # 検索: node tools/index.mjs --find "<keywords>" → --details <id>
├── examples/                      ← shape 別の自己完結サンプル（specs/ の spec から再生成可能な成果物）
│   ├── example-app-flow.html         example-code-review.html
│   ├── example-dashboard.html        example-decision.html
│   ├── example-diagram.html          example-editor.html
│   ├── example-interactive-dashboard.html
│   ├── example-interactive-graph.html
│   ├── example-form.html             example-report.html           example-spec.html
│   ├── example-spec.json          ← build spec（JSON 入力）の最小サンプル。reference/07 から参照
│   └── specs/                     ← 上記の各 .html に 1 対 1 対応するビルド入力（spec JSON。example-demo-gallery のみ spec は examples/ 直下）
│       ├── example-app-flow.spec.json        example-code-review.spec.json
│       ├── example-dashboard.spec.json       example-decision.spec.json
│       ├── example-diagram.spec.json         example-editor.spec.json
│       ├── example-form.spec.json           example-gallery.spec.json
│       ├── example-interactive-dashboard.spec.json
│       ├── example-interactive-graph.spec.json
│       └── example-report.spec.json          example-spec.spec.json
├── reference/                     ← 詳細ドキュメント（00〜10）
│   ├── 00-target-surface.md          01-overview-and-flow.md
│   ├── 02-decision-criteria.md       03-themes-and-palettes.md
│   ├── 04-module-catalog.md          05-components-interactions.md
│   └── 06-usage-guide.md             07-build-spec.md             08-project-scan.md
│       09-framework-scan-playbooks.md 10-composition-standards.md
└── tools/
    ├── build.mjs                  ← JSON spec からの決定的ビルド（先に spec チェックを実行し、要求台帳を表示）
    ├── render-check.mjs           ← ブラウザ検査: 1280/390px で横はみ出し・リンク切れ・小さすぎる文字・孤立行など＋スクリーンショット
    ├── validate.mjs               ← 静的な契約検証（PASS/FAIL）
    ├── index.mjs                  ← index/COMPONENTS.md を生成＋モジュール↔索引↔ビルダー整合を検証
    └── lib/                       ← spec-check.mjs（spec チェック）/ render-audit.js（ブラウザ内の検査）/ search.mjs
```

---

## クイックスタート

### 経路A: 手動組み立て（6ステップ）

1. `templates/base.template.html` をコピーする
2. `<html data-theme="..." data-layout="..." data-density="...">` でテーマとページ軸を選択する（header バリアントは `.page-header` 側）
3. `<style>` 内に **`reset → tokens → themes → elements → 使用モジュールのCSS`** の順でインラインする
4. `templates/modules/<name>.html` のマークアップを `<main>` に貼り付け、`{{variables}}` を実データで充填する
5. `interactions.js` を `</body>` 直前の `<script>` にインラインする
6. `node tools/validate.mjs <out.html>` と `node tools/render-check.mjs <out.html> --shots=<dir>` で検証し、スクリーンショットを見る

詳細手順 → [`reference/06-usage-guide.md`](./reference/06-usage-guide.md)

### 経路B: 決定的ビルド（推奨）

```bash
node tools/build.mjs spec.json out.html    # spec チェック → コアCSS+モジュール+interactions.js を自動合成
node tools/render-check.mjs out.html --shots=<dir>   # ブラウザ検査（1280/390px）＋スクリーンショット
node tools/validate.mjs out.html           # 静的な契約検証（PASS/FAIL）
```

座標計算・インライン順序・モジュールCSSの取り込みをツール側が決定的に行うため、手組みより事故が少ない。
spec の書き方 → [`reference/07-build-spec.md`](./reference/07-build-spec.md)

---

## 制約（このシステムが常に守ること）

- **外部ライブラリ・CDN を一切使わない**（Vanilla HTML/CSS/JS のみ、オフラインで動作）
- 色は**セマンティックトークン経由のみ**（生の hex を直接書かない）
- 図は**インライン SVG のみ**（ASCII 図は不可。`role="img"` + `aria-label`/`<title>` 必須）
- 出力は常に**単一の自己完結 `.html`**

加えて:

- **target-aware**: target が `mobile-app` なら、最初に目に入るプレビューは phone-first のアプリ画面であること（汎用 Web ページやダッシュボードにしない）
- **language-aware**: プロンプト/プロジェクトの言語が韓国語なら、表示ラベル・説明文は韓国語にする（canonical なフラグと実装識別子のみ英語を維持）

---

## ドキュメントの歩き方（オーナー対応表）

件数・一覧の正は各オーナー文書にのみ記載されている。迷ったら以下を引く。

| 知りたいこと | オーナー文書 |
|------------|------------|
| コマンド名・8フェーズ・制約 | [`SKILL.md`](./SKILL.md) |
| target 判定（mobile-app / web-app / document …） | [`reference/00-target-surface.md`](./reference/00-target-surface.md) |
| 全体像・フロー・レイヤ構成 | [`reference/01-overview-and-flow.md`](./reference/01-overview-and-flow.md) |
| HTML 化の判断基準と shape カタログ | [`reference/02-decision-criteria.md`](./reference/02-decision-criteria.md) |
| テーマ詳細・パレット・WCAG 値 | [`reference/03-themes-and-palettes.md`](./reference/03-themes-and-palettes.md) |
| どのモジュールを使うか（検索でタグ/意図から選ぶ） | `node tools/index.mjs --find "<keywords>"` → `--details <id>`（索引: [`index/INDEX.md`](./index/INDEX.md) / [`index/COMPONENTS.md`](./index/COMPONENTS.md) / 正は [`index/components.json`](./index/components.json)） |
| モジュールカタログ（変数・クラス） | [`reference/04-module-catalog.md`](./reference/04-module-catalog.md) |
| インタラクション契約（`data-*` 属性） | [`reference/05-components-interactions.md`](./reference/05-components-interactions.md) |
| 手動組み立て手順 | [`reference/06-usage-guide.md`](./reference/06-usage-guide.md) |
| build spec（JSON 仕様） | [`reference/07-build-spec.md`](./reference/07-build-spec.md) |
| 現行UIコピー/リデザイン時のプロジェクトスキャン | [`reference/08-project-scan.md`](./reference/08-project-scan.md) |
| フレームワーク別の探索順（Next.js App Router 等） | [`reference/09-framework-scan-playbooks.md`](./reference/09-framework-scan-playbooks.md) |
| 文書ジャンル別ブループリント・組成/タイポグラフィ基準 | [`reference/10-composition-standards.md`](./reference/10-composition-standards.md) |

---

## 保守メモ

- **デモの共通CSS/JSと生成済みHTMLを同期する**: `node tools/refresh-examples.mjs`。`index.html`、旧版ギャラリー、spec付きサンプルを更新する。`--check` は変更せずに同期ずれを検出する。
- **件数・一覧はオーナー文書にのみ詳細を記載する方針**（テーマ → reference/03、モジュール → reference/04、インタラクション → reference/05）。README を含む他の文書は参照に留め、数字を複製しない。
- **モジュール索引は `index/components.json`（手書きの正）→ `node tools/index.mjs` で `index/INDEX.md`＋`index/COMPONENTS.md` を自動生成**。AI は通読せず `--find "<keywords>"`（tag/keyword/intent(EN/KO/JA)/useWhen でランク付け）→ `--details <id>` で選んだ分だけ精読する。モジュール追加・変更時は (1) `templates/modules/<id>.html` と `tools/build.mjs` の `R.<section>` を追加、(2) `index/components.json` にエントリ追加、(3) `node tools/index.mjs`（または `--check`）で「全モジュールに索引エントリがあり、各エントリの section が実在するレンダラに対応する」ことを検証＋ 索引再生成、の順で行う。
- **`examples/` の各 .html は `examples/specs/*.spec.json` から決定的に再生成できる**: `node tools/build.mjs examples/specs/<name>.spec.json examples/<name>.html` を実行し、`node tools/validate.mjs examples/<name>.html` で契約検証する。サンプルを変更するときは `.html` を直接編集せず、spec 側を更新して再ビルドすること。

### 変更時の検証

```bash
node --test tools/*.test.mjs
node tools/index.mjs --check
node tools/reachability.mjs
node tools/refresh-examples.mjs --check
node tools/contrast-audit.mjs
```

テストは外部API・認証情報を使わず、ブループリントとサンプルの出力再現性、静的契約、コピーと切替動作を確認する。画面の見やすさと実操作は、別途 `tools/render-check.mjs` と画像・操作確認で検証する。

## ライセンス

MIT © 2026 buddypia。[LICENSE](./LICENSE) を参照。旧ローカルスキルの統合経緯は [`reference/01-overview-and-flow.md`](./reference/01-overview-and-flow.md) に記載。
