# proposals モード — 複数案を並べて比較

方向性が複数あり、その中から人間に選んでほしいときに使う。
（原型は slide-studio のトップ画面UI改善3案。一時成果物のため現存しないが、
作法は本ファイルと `assets/` に取り込み済み。）

## 構成

```
.tmp/<slug>/
├── shared.css        # assets/shared.css をコピー（トークン調整）
├── preview.js        # viewport / embed / iframe fit 制御
├── index.html        # 比較ページ（課題 + 各案 + 推奨）
├── view-a.html       # 案A のフル画面
├── view-b.html       # 案B のフル画面
└── view-c.html       # 案C のフル画面（案は通常 2〜4 個）
```

`mobile-app` target の場合は、index の iframe は
`view-x.html?viewport=phone&embed=1` を既定にする。各 view は
`?viewport=phone|tablet|desktop` と `?embed=1` を解釈できる形にする。

## 案の立て方

- **2〜4 案**に絞る（選択過多を避ける = Hick's の法則）。
  ユーザーが明示的に 5 案以上を求めた場合は従うが、index で推奨 1 案を必ず明示する。
- 各案は「アプローチの軸」で**はっきり差別化**する。似た案を並べない。
  - 例: 入力の集約度（1入力に統合 / タブで分岐 / カードで並列）
  - 例: 持っているコンテンツ量での分類（ゼロから / テキストから / ファイルから）
- 各案に**性格づけ**を付ける（理想形 / 折衷 / 移行コスト最小 など）。
- 1案を**推奨**として `badge-rec`「おすすめ」で明示する。等価に並べない。

## index.html の必須要素

`assets/index.template.html` を骨格に:

1. **イントロ** — 対象と狙いを 1 段落。
2. **Current issues + guidance**（Korean prompt なら「현재 과제 + 업계 참고/방향」。
   実コード/実画面に基づく。推測しない。WebSearch したら出典を `.ref` に）。
3. **各案** — `.item` を案の数だけ複製。各 `.item` は:
   - 左: `.frame > iframe`（`view-x.html` をミニプレビュー。`fitFrames()` が幅にフィット、hover でフル画面リンク）
   - 右: 一言説明 / `.pros`（長所 ✓）/ `.note`（注意・トレードオフ）/ `.ref`（参考）/ 開くボタン
4. **まとめ・推奨** — どれを選ぶべきかの指針と次アクション。

`__*__` 形式のプレースホルダは、user/project language に合わせて**すべて**置換する
（一覧と ja/ko/en の対訳は `assets-contract.md` が正本）。
Korean prompt / Trip Jarvis では `lang="ko"` と Korean labels を使い、日本語テンプレート文を残さない。

## view-x.html の作り方

`assets/view.template.html` を骨格に、**実画面に近いダミー**で作る:

- 対象プロダクトのヘッダー/レイアウトを模すと「自分のプロダクトの話だ」と即伝わる。
- `mobile-app` target では、最初に見えるものを phone frame / app bar / bottom safe area /
  bottom input/nav などのアプリ surface にする。説明テキストは `.preview-copy` に置く
  （既定の app モードと `embed=1` では自動で隠れ、explainer ボタンで併記される）。
- デザイントークンは UI キャッシュ（`references/ui-cache.md` — fresh なら再調査省略）
  由来の `skin.css` を link して使う。実プロダクトの部品構造（`ui-cache.json#components` の
  ヘッダー/レイアウト部品）に寄せると再現度が上がる。
- **インタラクションが要点の案**は最小限の vanilla JS で体験を示す（タブ切替・添付トグル・例文注入など）。
- ダミーデータは現実的に。グリッドやカードは色味のバリエーションで「中身がある」状態を見せる
  （ブランクを見せない原則）。

## UX チェック（提案の質を上げる観点）

- **選択過多を避ける** — 入口/CTA を絞り、視覚階層で主従を付ける。
- **ブランクを見せない** — 一覧やプレビューに実例ダミーを置く。
- **推奨を明示** — 「迷ったらこれ」を 1 つ。
- **time-to-value** — 最短で価値に届く導線を高く評価する。

## 仕上げ

ブラウザで index を開いたら `AskUserQuestion`:
- Korean prompt / Trip Jarvis: 「어떤 안을 채택할까요?」 選択肢 = 各案 + 「아직 결정하지 않음/조정하고 싶음」
- Japanese prompt: 「どの案を採用しますか？」 選択肢 = 各案 + 「まだ決めない/調整したい」
- 選ばれた案を、次の実装・修正にそのまま渡す。

## チェックリスト

- [ ] 案は 2〜4 個で、軸がはっきり違う
- [ ] 推奨が 1 つ明示されている（`badge-rec` は推奨案だけに付ける）
- [ ] 課題は実ファイル根拠（推測でない）
- [ ] 各 view がスタンドアロンで開ける（shared.css は相対 link）
- [ ] `mobile-app` target では iframe が phone-first で、Web hero が最初に出ない
- [ ] index の iframe がフィットし、hover でフル画面に飛べる
- [ ] 残存プレースホルダ 0 件（`grep -RnoE '__[A-Z0-9_]+__' .tmp/<slug>/`）
- [ ] 生成後に `open index.html` 実行
