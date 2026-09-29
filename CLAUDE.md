# amazon-shiire-tanka-tool リポジトリ

Amazon FBA向け「仕入れ単価 自動計算ツール」。ビルド不要の静的サイト(HTML/CSS/JS)で、GitHub Pagesで公開されている。

## 構成
- `index.html` / `style.css` / `script.js` — ツール本体。`script.js`に計算ロジック・購入通知の取り込み(Gmail連携)・仕入れ記録の期間集計(Sheets連携)が全て入っている。
- `README.md` — 使い方・Google連携の設定手順・計算の前提条件。
- `.claude/agents/` — 役割分担された専用サブエージェント(下記参照)。
- `.claude/skills/steward/` — GitHub PR自動監視・自動対応の本リポジトリ固有ルール(**`main`マージ=即本番公開**という重要な注意点を含む)。

## 運用ルール(このリポジトリでの標準)
- `main`ブランチへの直接pushはしない。作業は別ブランチ→PR経由でマージする(`main`=GitHub Pages公開元のため)。
- 確認のやり取りは「基本自動・危険操作のみ確認」方針(`.claude/settings.json`参照)。ファイル編集・通常のgit操作は自動承認。`rm -rf`・force push・`reset --hard`・sudo・シークレット類を扱うコマンドは `.claude/hooks/dangerous-command-guard.sh` が検知して必ず確認を挟む。
- 計算ロジック(`compute()`)を変更する場合は、既存のコメントに書かれた前提条件(1個あたり・税込統一、返品はワーストケース想定など)を壊さないこと。
- 役割分担が必要なタスクは、まず下記の専用サブエージェントに振れないか検討する。

## サブエージェント(役割分担)
| エージェント | 担当 |
|---|---|
| `calc-tool-dev` | このツール自体(index.html/script.js/style.css)の機能追加・バグ修正・UI調整 |
| `sourcing-analyst` | Amazon物販の仕入れ判断・商品リサーチ・収益性分析(ツールの計算結果を踏まえた深掘り分析) |
| `pr-manager` | GitHub PRの手動トリアージ・対応(単発依頼用) |

PRの自動監視・自動修正は `.claude/skills/steward/SKILL.md` のルールに従って自動的に行われる(サブスクライブ済みPRに対して)。

## この設定パターンについて
この役割分担+権限設計は `hanahanaburichika5529-debug/Amazon-` リポジトリで最初に組んだものを、このリポジトリの実際の構成(静的Webツール)に合わせて移植したもの。今後さらに別プロジェクトへ展開する場合は、`Amazon-`リポジトリの `docs/agent-role-playbook.md` を参照。
