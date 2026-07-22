# レビューチェックリスト — 人間の目視レビュー項目を最適化して表示する

AI が UI を変更（新規・修正）したとき、人間が**何を見て承認/指摘すべきか**を
プレビュー内にチェックリストとして埋め込む。項目はブラウザ上でクリックでき、
判定（OK / 要修正）とメモが localStorage に保存され、進捗が集計表示される。
判定は目視で終わらせず、「結果をコピー」ボタンで CLI エージェントに構造化して還流できる（下記「CLI 連携」節）。

ゴールは「レビュー漏れを構造的に防ぐ」こと。**関連する項目だけを 5〜12 個**に
絞って出す（全部盛りは読み飛ばされて逆効果 — 選択的提示が本体）。

## いつ出すか

- **review モード**: 必須（UI 変更の before/after を見せる場面が主戦場）。
- **proposals / spec モード**: UI の新規実装・修正が後続するときだけ任意で付ける。
- 変更が UI に触れない（純ロジック・ドキュメント）場合は出さない。

## 項目の選び方（最適化ルール）

1. **変更種別を判定**する:

   | 種別 | 例 |
   |---|---|
   | `NEW_SCREEN` | 画面・ビューの新設 |
   | `MODIFY_SCREEN` | 既存画面のレイアウト/要素変更 |
   | `FLOW_CHANGE` | 画面遷移・導線・ステップの変更 |
   | `STYLE_ONLY` | 色・余白・フォント等スタイルのみ |
   | `TEXT_ONLY` | 文言のみ |

2. **下の項目プールから該当セルの項目だけ**選ぶ（●=必須 / ○=該当時のみ / −=出さない）:

   | カテゴリ | 確認内容の例 | NEW | MOD | FLOW | STYLE | TEXT |
   |---|---|---|---|---|---|---|
   | **忠実性** | デザイントークン準拠（色・フォント・角丸が ui-cache のトークンと一致 / 勝手な新色がない） | ● | ● | − | ● | − |
   | **状態網羅** | loading / empty / error / 長文・データ 0 件時の表示が壊れない | ● | ○ | ○ | − | − |
   | **機能整合** | SPEC/要件の FR と画面要素の対応（欠けている操作・余計な操作がない） | ● | ● | ● | − | − |
   | **導線** | 前後の画面から自然に到達・離脱できる / 戻る・キャンセルの行き先 | ○ | ○ | ● | − | − |
   | **文言** | UI 文字列が SSOT（MESSAGES / i18n）経由か・言語とトーンの一貫性・誤字 | ● | ○ | ○ | − | ● |
   | **a11y** | コントラスト（特に muted 文字）・フォーカス順序・aria-label / alt | ● | ○ | − | ● | ○ |
   | **レスポンシブ** | 対象 viewport（target-surface 準拠）での崩れ・折返し | ● | ○ | − | ● | − |
   | **回帰** | 変更していないはずの隣接領域が変わっていない（before/after 比較） | − | ● | ● | ● | ○ |

3. 各項目には**その画面での具体的な確認方法**を 1 文で書く
   （「コントラストを確認」ではなく「補足テキスト #B0A189 が背景 #14110D 上で読めるか」）。
   実ファイル・実トークンに基づいて書く。一般論だけの項目は削る。

## DOM 契約（preview.js が自動で動かす）

以下の構造で index.html（review では before/after の下）に置く。
**フック名を変えると黙って壊れる**（assets-contract.md と同じ原則）:

```html
<section class="card checklist" data-checklist="ui-review">
  <div class="between">
    <h3 style="margin:0; font-size:16px;">レビューチェックリスト</h3>
    <span class="badge check-progress" data-checklist-progress></span>
  </div>
  <ul class="check-list">
    <li class="check-item" data-check-item="fidelity-tokens">
      <div class="check-label">
        <b>トークン準拠</b>
        <span class="muted">ボタン/バッジの色が brand-600 (#be4c2e) 系か。新色の発明がないか</span>
      </div>
      <div class="check-actions"></div>
    </li>
    <!-- data-check-item はページ内で一意の英語 slug。項目数だけ複製 -->
  </ul>
</section>
```

| フック | 役割 |
|---|---|
| `[data-checklist="<id>"]` | チェックリスト区画。id は localStorage キーの一部 |
| `li[data-check-item="<slug>"]` | 1 項目。slug は一意（判定の保存キー） |
| `.check-label` | 項目名 `<b>` + 確認方法 `<span class="muted">` |
| `.check-actions` | **空のまま置く** — preview.js が OK / 要修正ボタンを生成する |
| `[data-checklist-progress]` | 進捗バッジ。preview.js が「確認 n/m · 指摘 k」を表示 |
| `.check-note`（自動生成） | 要修正時のみ表示されるメモ欄。**テンプレート側マークアップ不要** |
| `.check-footer` / `.check-copy`（自動生成） | 回収 UI（結果をコピー）。**テンプレート側マークアップ不要** |

- 判定は `li[data-state="ok"|"ng"]` として付与され、localStorage
  （`spec-preview-check:<pathname>:<id>`、値は `{"<slug>": {"state": "ok"|"ng", "note": "…"}}`）
  に保存 → リロードしても保持。
- ボタンラベル・進捗文言・メモ placeholder は `html lang`（ja/ko/en）から preview.js が
  自動選択する（`__LABEL_*__` プレースホルダではない）。
- 見出し「レビューチェックリスト」と各項目テキストは **AI が生成時に
  user/project language で書く**（上の例は ja）。

## CLI 連携 — 判定を目視で終わらせず構造化して回収する

判定・メモは口頭報告に頼らず、チェックリスト下部の「結果をコピー」ボタン（preview.js が生成）から
**slug 付き Markdown** としてクリップボードに入れ、CLI エージェント（Claude Code / Codex CLI / Cursor 等）に渡す。
ユーザーがそのまま CLI チャットに貼れば、どのエージェントでも修正タスクに変換できる:

```
## UIレビュー結果 — ui-review
確認 8/9 · 指摘 2
- [要修正] トークン準拠 (fidelity-tokens) — ボタンが #5b8cff のまま。brand-600 に
- [OK] 文言 (copy-ssot)
- [未確認] 回帰 (regression-header)
```

## 仕上げ（レビュー結果の回収）

`open index.html` 後の AskUserQuestion に、チェックリストを踏まえた選択肢を出す:

- 「チェックリストを確認して進めてよいですか？」
  選択肢 = 「全項目 OK、進めて」 / 「指摘あり（判定を貼る）」 / 「保留」
- 回答後、「結果をコピー」の貼り付けを受け取るか、どの項目（slug）かを聞いて修正タスクに渡す。

## アンチパターン

- **全部盛り** — プール全項目を毎回出す。5〜12 個に絞れないなら変更種別の判定が甘い。
- **一般論の項目** — 「デザインを確認」のような確認方法のない項目。実トークン・実ファイル名で書く。
- **`.check-actions` に手書きボタン** — preview.js が生成する。手書きすると保存機構と二重化する。
- **slug の重複** — `data-check-item` が重複すると判定の保存が混線する。
- **チェックリストだけ出して before/after を省く** — チェックは比較対象があって初めて機能する。
