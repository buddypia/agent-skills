# UI キャッシュ — プロジェクト UI 資産のスキャンと再利用

対象プロジェクトの UI 資産（デザイントークン・コンポーネント・UI 文字列 SSOT）を
**一度だけスキャンしてキャッシュ**し、以後の生成で再利用する。スキャンは
**フレームワーク横断**（Web CSS / Tailwind / React / Next.js / React Native /
Flutter / Android / iOS — 下の対応表）。狙いは 2 つ:

1. **コストカット** — 毎回 globals.css / tailwind.config / theme.dart / components を
   読み直さない。fresh なキャッシュがあれば **ソース再調査を省略**し、
   キャッシュだけで「元 UI とほぼ同じ見た目」を一発生成する。
2. **元 UI の再現** — キャッシュした実トークンから `skin.css` を生成し、
   プレビューを対象プロダクトの見た目に寄せる。人間が「自分のプロダクトの話だ」と
   即認識でき、レビュー精度が上がる。

## キャッシュの場所（対象プロジェクト側・gitignore 前提）

```
<project>/.tmp/spec-preview/ui-cache/
├── ui-cache.json   # manifest（ui-scan.mjs が生成、AI が確定）
└── skin.css        # AI が生成する見た目上書き CSS（shared.css の後に link）
```

`.tmp/` が対象プロジェクトの `.gitignore` に含まれるか確認する（spec-preview の
出力規約と同じ）。キャッシュは**消えても再 scan で完全復元できる**使い捨て資産 —
prune されて困るものは置かない。

## フロー（生成のたびに最初に実行）

```bash
node <skill>/assets/ui-scan.mjs check --project <project-root>
```

| exit | status | 次のアクション |
|---|---|---|
| 0 | fresh | **再スキャン禁止**。`ui-cache.json` + `skin.css` をそのまま使う。`confirmed: false` なら下記「AI 確定」だけ行う |
| 1 | stale | `scan` を再実行 → 変更されたソース（`changed[]`）だけ読み直して AI 確定を更新 → `skin.css` を再生成 |
| 2 | missing / corrupt | `scan` を実行 → AI 確定 → `skin.css` 生成（初回フルフロー。manifest が JSON 破損している場合も `corrupt` として exit 2） |

```bash
node <skill>/assets/ui-scan.mjs scan --project <project-root>
```

scan は決定論的 draft を作るだけで、既存 manifest の AI 確定フィールド
（`confirmed` / `aiNotes` / `skin` / `project.lang` / 確定済み `targetSurface`）は保存される。

## フレームワーク別トークン抽出（scan が自動で行う）

scan はプロジェクトを 1 回 walk してトークン候補ファイルを発見し、
フレームワークごとの抽出器で 2 つのマップに正規化する:

- **`tokens.cssVars`** — CSS 変数（`:root` / `@theme` / CSS-in-JS の `--var`）
- **`tokens.colors`** — 名前→色（CSS 以外由来。ネストは `brand.primary` のようなドット path）

| フレームワーク | 発見対象 | 抽出内容 |
|---|---|---|
| Web (Next/React/Vue/Svelte…) | `globals.css` / `tokens.css` / `theme.scss` 等 | `:root`/`@theme` の CSS 変数、SCSS `$vars`、font-family |
| Tailwind | `tailwind.config.{js,ts,mjs,cjs}` | `theme.colors` 系の色リテラル（ドット path） |
| React / React Native | `theme.ts` / `colors.ts` / `tokens.ts` / `palette.ts`（`theme/` 配下の `index.ts` 含む） | ネスト色オブジェクト、`fontFamily` |
| Flutter | `lib/**/theme*.dart` / `colors.dart` 等（テーマファイル不在時は `lib/main.dart` / `lib/app.dart` に fallback） | `Color(0xAARRGGBB)` 定数・`ColorScheme` 名前付き引数（alpha は rgba に正規化）、`seedColor: Colors.deepPurple` 等の Material 名前色（500 番で解決）、`fontFamily`。`Colors.x.shade300` 等の shade 指定は解決不可 → AI 確定時に aiNotes で補完 |
| Android | `res/values*/colors.xml` | `<color name>`（`#AARRGGBB` → hex/rgba） |
| iOS | `*.colorset/Contents.json` | sRGB components → hex/rgba |

トークンファイルの**追加/削除**は合成ソース `::token-discovery` で検知され、
`check` が stale を返す（ファイル内容の変更は個別ハッシュで検知）。
v1 manifest（`tokens.colors` なし）は `check` が自動で stale 判定し再 scan へ誘導する。

## AI 確定（scan 後に一度だけ行う意味づけ）

scan の draft は機械抽出なので、AI が以下を確定して manifest を更新する:

1. **`project.targetSurface` / `project.lang`** — `guidanceDocs`（CLAUDE.md 等）を読み、
   `references/target-surface.md` の判定規則で確定する（例: 「日本語 / ダークモード専用」
   の宣言 → `lang: "ja"`）。
2. **`aiNotes`** — skin 生成で使った判断を 2〜4 行で記録する
   （どの CSS 変数を primary にしたか / 特徴的な UI パターン / 注意点）。
   次のセッションはソースを読まず aiNotes + tokens だけで生成に入れる。
3. **`skin`** — `skin.css` を生成したら `{ "path": "skin.css", "basedOn": ["<主要トークン名>"] }`
   を記録する。
4. **`confirmed: true`** に更新。

## skin.css 契約 — shared.css を上書きする

`skin.css` は **shared.css の既定トークン/クラスを上書きする**専用ファイル。
生成 HTML では必ず shared.css の**後**に link する:

```html
<link rel="stylesheet" href="shared.css" />
<link rel="stylesheet" href="skin.css" />
```

### 最低限マッピングする変数（shared.css `:root` と同名で上書き）

| shared.css 変数 | 対応させるプロジェクトトークン（例） |
|---|---|
| `--background` | アプリ背景色（`--color-background` / bg 系） |
| `--surface` / `--surface-2` | カード / 面の色（なければ背景から明度 +5〜8% を作る） |
| `--border` | 境界線色 |
| `--text` / `--muted` | 前景 / 補助テキスト色 |
| `--accent` / `--accent-2` | primary / secondary ブランド色 |
| `--accent-grad` | ブランド gradient（単色しかなければ同色 2 stop） |
| `--ok` / `--warn` | success / warning 色 |
| `--radius` | 基本角丸 |

加えて `body { font-family: ... }` をプロジェクトのフォントスタックで上書きする
（heading 用 serif があれば `.title { font-family: ... }` も）。ボタン等の見た目が
特徴的な場合のみ `.btn-primary` / `.badge` 等を追加上書きする（過剰な再現は不要 —
「馴染む」レベルで止める。これはモックであり本実装ではない）。

### 値の出どころ

- 第一候補: `ui-cache.json#tokens.cssVars`（Web: `@theme` / `:root` 抽出値）と
  `#tokens.colors`（Flutter / React Native / Tailwind / Android / iOS 等の抽出値）。
  `skin.css` は**ソースのフレームワークによらず常に CSS** — プレビューは HTML なので、
  Dart の `primary` も RN の `brand.primary` も shared.css の `--accent` 等へマッピングする
- 補助: `designDocs`（DESIGN.md 等）に意味づけ（primary / semantic）が書かれていればそれに従う
- **発明しない** — キャッシュにない色を勝手に作らない（明度調整で導出する場合は aiNotes に明記）

## 生成時の使い方

1. `check` → 上表のフロー。
2. `.tmp/<slug>/` に `shared.css` / `preview.js` と一緒に **`skin.css` をコピー**する。
3. view の骨格（ヘッダー構成・レイアウト）は `ui-cache.json#components` を参考に
   実プロダクトの部品名・構造（例: AppHeader + TwoPaneLayout）へ寄せる。
4. UI 文字列は `strings.sources`（MESSAGES / i18n）が指す言語・トーンに合わせる
   （ダミーデータも実プロダクトの語彙で書く）。

## アンチパターン

- **fresh なのに再スキャン** — コストカットの目的を壊す。`check` の exit 0 を信じる。
- **stale 放置** — トークン変更後の古い skin で「元 UI の再現」を騙る。stale なら scan。
- **skin.css をスキル `assets/` に置く** — キャッシュはプロジェクト側 `.tmp/`。スキル資産は全プロジェクト共通で汚染禁止。
- **manifest の手書き偽装** — `confirmed: true` はソース由来の値を確認した時だけ。検証していない値を書かない。
- **キャッシュを git commit** — `.tmp/` の gitignore を確認。tracked にしない。
