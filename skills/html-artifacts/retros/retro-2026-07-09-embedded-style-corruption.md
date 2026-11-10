# Retro 2026-07-09 — 手貼りモジュール埋め込みで先頭CSSルールが無音脱落（validate PASSのまま）

## Trigger
AI self-correction + near-miss（ゲート空隙）。v7 blueprint作業で、埋め込みモジュールのstyleブロックにヘッダーコメントのproseが混入し、build/validate/プレースホルダ検査すべてPASSのままグリッドレイアウトが崩壊。スクリーンショット目視で発覚。1次修復regexも誤っており（二重styleタグ化）、2次修復で解決。

## Facts
1. v7で3サブエージェントが blueprint 10種を生成。手貼りモジュール(v3–v6)は `<style data-module="X">`+markup を build spec の `html` セクションに埋め込む方式。
2. モジュールファイルのヘッダーコメントは MODULE CSS 行に `<style data-module="X">` という文字列をproseとして引用する形式。
3. bp-exec 系の抽出処理は最初の文字列一致位置から切り出しを開始し、コメント内prose（"block once. INTERACTION: … USAGE: … ==== -->"）がstyle要素内に混入した状態が 3 blueprint × 7 箇所で成立した。
4. `tools/build.mjs` → ビルド成功、`tools/validate.mjs` → PASS（警告0）、`grep '{{'` → 0。既存の全ゲートを通過した。
5. フルページスクリーンショットで roadmap の期間ヘッダーが4列グリッドでなく縦積みになっているのが視認された。
6. ブラウザ診断: `styleEl.sheet.cssRules[0].selectorText` が `.rdm-title`（本来は `.rdm`）。CSSパーサがprose断片を無効プリリュードとして先頭ルール `.rdm { --rdm-lane: 132px; --rdm-cols: 4; }` ごと食い、`--rdm-lane` 未解決 → `grid-template-columns` が invalid at computed-value time で1列化。
7. 1次修復 `replace(/(<style data-module="[a-z-]+">)[\s\S]*?-->\s*\n/, "$1\n")` は prose断片側のタグ（$1）を残したため、後続の本物のタグと二重になり同症状が継続。
8. 2次診断で二重タグを特定。連続重複タグの1つ目を除去する2次修復を7箇所に適用し、全10 blueprint × 28埋め込みを `sheet.cssRules[0]` 照合で全数検証、全てOK。
9. `tools/build.mjs:251-253` には同一の罠が既にコード内コメントとして文書化され、`replace(/<!--[\s\S]*?-->/g,'')` で内部的に回避されていた。この知識は v7-spec 共有契約書には載っていなかった。

## 5 Whys → Root Cause
発生系:
1. Why グリッド崩壊 → 先頭CSSルール（`--<prefix>-*` 変数定義）がシートから脱落していた
2. Why 脱落 → style要素内にヘッダーコメント由来のproseが混入し、CSSパーサがproseと先頭ルールを一体の無効ブロックとして消費した
3. Why prose混入 → 抽出が「`<style data-module=` の最初の文字列一致」から開始され、その最初の出現はヘッダーコメント内のprose引用だった
4. Why コメントを踏んだ → モジュールヘッダー契約は MODULE CSS 行で同一文字列をproseとして引用しており、コメント除去を先行しない抽出は必ず罠を踏む構造
5. Why 除去が先行されなかった → 抽出手順が契約化・機械化されておらず各エージェントが自前実装した。回避知識は build.mjs のコード内コメントに埋没し、共有契約書（v7-spec）に露出していなかった

検出系:
1. Why 目視まで発覚しなかった → validate.mjs は自己完結性・トークン色・SVG a11y・コントラストを検査するが、埋め込みstyleのパース健全性を検査しない
2. Why 検査がなかった → 「styleが黙って先頭ルールだけ落とす」故障クラスがこのインシデントまで未知だった（ゲート空隙）

**Root cause(s) (the class-blocking point(s)):**
occurrence: モジュール抽出手順が未契約・未機械化（ヘッダーコメント除去の先行が必須という知識がコード内コメントに埋没） · detection: validate.mjs に埋め込みstyle健全性の検査が存在しなかった

## Class
embedded-style-corruption
recurrence_of: none
再発クラス（1バッチで7/28箇所発生。ギャラリー・blueprint追加のたびに手貼りモジュール埋め込みが発生し露出し続ける）。影響範囲: 生成成果物の品質（ローカルHTML）。失敗アクションの可逆性: 可逆的書き込み・外部非公開。

## Decision
- Tier: **③ 検出ゲート**（validate.mjs に検査追加）+ ⑤併設（reference/10 §1 の埋め込み落とし穴注記 — 実装済み）。1次修復regexミスのサブ問題は ⑥（一回性、記録のみ）
- **Why this tier:** 成果物は納品前に必ず validate を通る運用のため、ゲート時点の検出で全生産者（エージェント自前スクリプト・手編集・将来のツール）を包括できる。マーカー（`<style` ネスト・`-->`・ヘッダー語彙・`====`）は正当なモジュールCSSに構造的に出現し得ないため誤ブロックリスクほぼゼロ。既存ゲートへの約12行で新規ツール周知コストなし
- Rejected tiers + reason:
  - ①（正規抽出CLI化で不正状態を排除）→ C1境界注意により棄却: ツールは「使われた時のみ」防止であり、v7-spec自体が手動充填を指示する以上、生産者/消費者境界を越える。parse-at-the-boundary（=消費者側validate）+ ③ 回帰ゲートが正しい配置
  - ②（PreToolUse hook）→ C3: ブロックすべき「ツール呼び出しの瞬間」が存在しない（成果物は汎用Write/ビルドで書かれる）。誤ブロックリスク大・決定可能性低
  - ⑥（何もしない）→ C2棄却: 1バッチ7箇所の再発クラスであり一回性でない
- 内部ループ: 1ラウンドでAPPROVE（C1–C6全PASS、C6は台帳grep 0 matches）

## Cure (existing instances)
- [x] exec-briefing sec1/5/7, project-report sec1/5, meeting-pack sec1/2 の7箇所 — 2段階regex修復（prose除去→重複タグ除去）を適用し、全10 blueprint × 28埋め込みをブラウザの `sheet.cssRules[0]` 照合で全数検証（git管理外ディレクトリのためPRなし。修復後スクリーンショットで exec-briefing / proposal の完全レンダリングを確認）

## Prevent (prevention mechanism)
- `tools/validate.mjs` チェック 2b「embedded module <style> integrity」を追加（当時は git 管理外だったため PR を作れず、変更前のバックアップで revert 保護を代替）
- negative test (a) prose混入型: `node tools/validate.mjs <tmp>/neg-prose.html` →
  `FAIL  neg-prose.html` / `✗ corrupted module style "roadmap": stray "INTERACTION:" inside <style> — …first CSS rule is silently dropped` / exit=1
- negative test (b) 二重タグ型（1次修復の中間状態）: `node tools/validate.mjs <tmp>/neg-dup.html` →
  `FAIL  neg-dup.html` / `✗ corrupted module style "roadmap": stray "<style" inside <style> — …` / exit=1
- positive test: 全10 blueprint 再ビルド + examples/ 全17成果物（v3–v6ギャラリー含む）→ 27/27 PASS、false-blocks = 0

## Verify cmd
```bash
# run from the html-artifacts skill directory
neg=$(mktemp -d)/neg-esc.html
printf '<!DOCTYPE html><html lang="ja" data-target="document"><head><meta charset="utf-8"><meta name="viewport" content="w"><title>t</title></head><body><style data-module="x">USAGE: prose --> .x{}</style></body></html>' > "$neg"
node tools/validate.mjs "$neg"; test $? -eq 1 && echo "GATE OK (violating input fails)"
node tools/validate.mjs examples/example-v6-gallery.html | head -1   # 正当成果物はPASSのまま
```

## Next
- [x] html-artifacts を git 管理下に置くか判断する — 2026-07-09 リポジトリ化を実施（`git init` と初期コミットを実施。以後 tools/reference のガバナンス変更はブランチ分離+revert保護が可能）
