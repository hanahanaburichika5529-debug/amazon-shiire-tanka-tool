# 仕入れ単価 自動計算ツール — 開発ガイド

このファイルはClaude Code自身への開発ルールです。ユーザーに見せる文書ではありません。

## リポジトリ構成（絶対厳守）

- **本リポジトリ** `amazon-shiire-tanka-tool`（GitHub Pagesで公開）
  URL: https://hanahanaburichika5529-debug.github.io/amazon-shiire-tanka-tool/
  → ツールコード（`index.html`/`style.css`/`script.js`/`apps-script/AutoFetch.gs`）のみ。
- **非公開の追跡用リポジトリ** `Amazon-`（`webapp/`配下に同じツールコードをミラー）
  → そちらには`spreadsheet/`配下に実際の仕入れ・在庫データも入っているため、
  **本リポジトリとは完全に別物として扱い、本リポジトリへ実データを持ち込まない**。

**絶対ルール**
- `index.html` / `style.css` / `script.js` / `apps-script/AutoFetch.gs` は、本リポジトリと
  `Amazon-`リポジトリの`webapp/`配下で必ずbyte-identicalに保つ。片方だけ直して終わらない。
- 本リポジトリに仕入れ・購入データや金額の実データを一切入れない（コードのみ）。
- Google OAuthスコープは`gmail.readonly`と`drive.file`のみ。広げない。
- アクセストークンはlocalStorageに保存しない（連携済みメールアドレスのみ可）。
- データは開発者・第三者含め、どこにも送らない（ブラウザ→Google公式APIへ直接のみ）。
- コミット末尾に必ず以下を付ける（まだpushしていなければ忘れた時点でamendして直す。
  pushした後なら新しいコミットで直す。force-push・履歴書き換えは禁止）：
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Kop6a8TgRCugW7wE53sbWq
  ```
  （session URLはそのセッションの実際のものを使う。コミットやPRに機種名・モデル名は書かない）

## 開発・改善の役割分担（自動処理フロー）

ユーザーから不具合報告・機能追加の依頼が来たら、「次どうすればいい？」を聞き直さず、
以下の役割を自分の中で順番に切り替えて最後まで自動で完走する。

1. **調査役** — 問題を再現する最小のテスト（Playwright、または`vm`サンドボックス）を
   まず書く。実メールのfixtureが必要な場合は`scratchpad/fixtures/`の既存のものを使うか、
   無ければユーザーに実際のメール本文・スクリーンショットを求める。憶測で直さない。
2. **実装役** — 再現できたら最小限の修正を加える。Webツール（`script.js`）とApps Script
   （`apps-script/AutoFetch.gs`）の両方に関わるロジック（メール解析・分類・重複判定等）を
   直す場合は、**両方に同一のロジックを反映する**（片方だけ直すと挙動がズレて事故る）。
3. **検証役** — 修正後、既存の回帰テストを全部再実行し、全部PASSすることを確認する。
   1つでも落ちたら直してから次に進む（詳細は下記「テスト資産」）。
4. **同期役** — 対象ファイルが本リポジトリと`Amazon-`リポジトリの`webapp/`配下で
   byte-identicalか`diff`で必ず確認する。
5. **リリース役** — 両リポジトリにそれぞれコミット（署名付き）し、該当ブランチへpush。
   本リポジトリは `main`、`Amazon-`リポジトリは
   `claude/purchase-price-calculator-5s9oif`。
6. **報告役** — ユーザーには結論と、確認してほしいことだけを短く・分かりやすい日本語で
   伝える。テストログや内部手順、ファイルパスの詳細などは共有しない。

### テスト資産

- ローカルサーバー: 本リポジトリ直下で
  `python3 -m http.server 8791 --bind 127.0.0.1` を起動してからPlaywrightテストを実行する。
- Playwright起動オプション: `executablePath: '/opt/pw-browsers/chromium'`
- 実行コマンド例: `NODE_PATH=/opt/node22/lib/node_modules node <test>.js`
- `scratchpad/`配下に蓄積されるテストファイル（環境リセットで消えることがあるので、
  無ければ過去の内容を参考に再構築する）：
  - `test_regression_suite.js` … 全体の統合回帰テスト（**最重要・毎回必ず実行**）
  - `test_apps_script_logic.js` … Apps Script側のパースロジックがWebツールと
    完全に同一の挙動になっているかを`vm`サンドボックスで検証
  - その他、個別機能ごとのテスト（bulk_dedup_price、duplicate_check等）
- fixtures: `scratchpad/fixtures/` に実メールの再現用HTML
  （`real_email_decoded.html`＝正常な注文メール、`feedback_request_decoded.html`＝
  marketplace-messagesの評価依頼メール＝0件になるべき）

### この環境の既知の制約

- このサンドボックスは`google.com`・`github.io`等への外向き通信ができないため、
  本番のGoogle OAuth連携やGitHub Pagesでの実機確認はできない。検証はモックした
  Playwrightテストのみで行い、実機確認が必要な変更は、ユーザーに実際の画面で
  試してもらい結果（スクリーンショット等）を報告してもらう。
- コンテナが予告なくリセットされることがある。再開時はまず両リポジトリの
  `git log`/`git status`を確認し、片方しか残っていない場合は再`clone`、
  `diff`でbyte-identicalか確認してから作業を続ける。

## メール解析ロジックを変更する場合の注意（既知のハマりどころ）

- 商品名は `<a href=".../dp/ASIN...">` のリンクテキストを最優先する
  （`extractProductLinkNames`／Apps Script版は`extractProductLinkNames_`）。
- 「もう一度買う」等のおすすめ枠は、本文テキストの切り落としだけでなく、
  ASIN抽出・リンク抽出にも**同じ`scopedInput`（カットオフ後の文字列）**を使って
  一貫して除外する。片方だけに適用すると、おすすめ枠の商品が混ざる不具合が再発する。
- 数量が2個以上の場合、メールの金額が「単価」か「合計」かは`inferIsUnitPrice`
  （Apps Script版は`inferIsUnitPrice_`）で、注文合計との整合性から自動判定する。
- 注文番号の正規表現マッチ前に、不可視Unicode制御文字
  （`[​-‏‪-‮⁦-⁩﻿]`）を必ず除去する。
- `marketplace-messages@`からの評価依頼メールは、購入が成立したメールではないため
  解析結果は0件扱いにする（保存しない）。
- Webツール・Apps Script両方で、スプレッドシートの重複防止キーは
  `orderNumber + "|" + (asin || name)` で統一する（どちらか一方だけ変えると
  二重保存や削除ミスに直結する）。
