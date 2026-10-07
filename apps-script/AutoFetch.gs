/**
 * 仕入れ単価 自動計算ツール - Gmail自動取得スクリプト（Google Apps Script）
 *
 * Webツール(index.html/script.js)はブラウザを開いている間しか動かないため、
 * ブラウザを開かなくても毎日自動でGmailを検索し、仕入れ単価をスプレッドシート
 * （Webツールと同じ「仕入れ単価計算ツール_仕入れ記録」）へ記録する。
 *
 * セットアップ手順（1アカウントにつき1回。7アカウント分、それぞれで設定が必要）
 *  1. そのGoogleアカウントで https://script.google.com/ を開き、「新しいプロジェクト」を作成
 *  2. 出てきたエディタの中身を全部消して、このファイルの内容を貼り付ける
 *  3. 上部の関数選択プルダウンで setupDailyTrigger を選び、実行ボタン(▷)を押す
 *     → 初回はGoogleの権限許可画面が出るので、Gmail読み取り・スプレッドシート
 *       編集・Driveへのアクセスを許可する
 *  4. 「成功」と出れば、毎日自動実行するトリガーが設定完了（以後は何もしなくてよい）
 *  5. 動作確認したい場合は、関数選択プルダウンで autoFetchPurchaseRecords を選んで
 *     実行すると、その場で1回分を試せる
 *
 * 実行結果は、スプレッドシート内の「実行履歴」タブで確認できる。
 * 検索条件を変えたい場合は、下の GMAIL_QUERY を書き換えてから再度保存する。
 */

const SHEET_TITLE = "仕入れ単価計算ツール_仕入れ記録";
const SHEET_TAB = "仕入れ記録";
const SHEET_HEADER = ["日付", "商品名", "ASIN", "数量", "単価", "金額", "取得元", "注文番号"];
const HISTORY_TAB = "実行履歴";
const HISTORY_HEADER = ["実行日時", "検索該当", "保存", "スキップ", "エラー"];

const GMAIL_QUERY = "from:amazon.co.jp 発送"; // Webツールの初期値と同じ。必要に応じて書き換えてよい
const MAX_MESSAGES_PER_RUN = 200; // 1回の実行での上限(実行時間・Gmail APIクォータの暴走防止)

/* ============================================================
 * メイン処理
 * ============================================================ */

function autoFetchPurchaseRecords() {
  const sheet = getOrCreateSheet_();
  const existingRecords = readExistingRecords_(sheet);
  const savedOrderKeys = new Set(
    existingRecords.filter((r) => r.orderNumber).map((r) => r.orderNumber + "|" + (r.asin || r.name))
  );

  let scanned = 0;
  let savedItems = 0;
  let skipped = 0;
  let errorCount = 0;
  const rowsToAppend = [];

  try {
    const threads = GmailApp.search(GMAIL_QUERY, 0, MAX_MESSAGES_PER_RUN);
    const messages = [].concat.apply([], threads.map((t) => t.getMessages()));

    messages.forEach((message) => {
      scanned++;
      try {
        const result = processMessage_(message, savedOrderKeys);
        if (result.skipped) skipped++;
        savedItems += result.rows.length;
        result.rows.forEach((row) => rowsToAppend.push(row));
        result.newKeys.forEach((k) => savedOrderKeys.add(k));
      } catch (e) {
        errorCount++;
        Logger.log("メッセージ処理エラー (" + message.getId() + "): " + e.message);
      }
    });

    appendRows_(sheet, rowsToAppend);
  } catch (e) {
    errorCount++;
    Logger.log("自動取得エラー: " + e.message);
  }

  logRun_(scanned, savedItems, skipped, errorCount);
}

/**
 * 1通のメールを分類・解析し、商品ごとに保存用の行を組み立てて返す。
 * 件名が「キャンセル/支払い問題の可能性」や、出品者への評価依頼メール
 * (marketplace-messages@)は、実際の購入が成立していない/金額情報を
 * 含まないため保存しない。savedOrderKeysに既にある注文番号+商品は、
 * 別のメール(発送済み/配達中等)からの重複保存として読み飛ばす。
 */
function processMessage_(message, savedOrderKeys) {
  const from = message.getFrom();
  const subject = message.getSubject();
  const newKeys = [];
  const rows = [];

  if (/marketplace-messages@/i.test(from)) return { skipped: true, rows, newKeys };
  if (classifySubject_(subject).tag === "warn") return { skipped: true, rows, newKeys };

  const html = message.getBody();
  const parsed = parseAmazonOrderEmail_(html);
  if (parsed.items.length === 0) return { skipped: true, rows, newKeys };

  const dateStr = Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  parsed.items.forEach((item) => {
    if (parsed.orderNumber) {
      const key = parsed.orderNumber + "|" + (item.asin || item.name);
      if (savedOrderKeys.has(key)) return;
      newKeys.push(key);
    }

    const isUnitPrice = inferIsUnitPrice_(item, parsed.orderTotal);
    const unitPrice = isUnitPrice ? item.price : item.price / (item.quantity || 1);
    const amount = isUnitPrice ? item.price * item.quantity : item.price;

    rows.push([
      dateStr, item.name, item.asin || "", item.quantity, unitPrice, amount, "auto", parsed.orderNumber || "",
    ]);
  });

  return { skipped: rows.length === 0, rows, newKeys };
}

function appendRows_(sheet, rows) {
  if (rows.length === 0) return;
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, SHEET_HEADER.length).setValues(rows);
}

/* ============================================================
 * スプレッドシート入出力
 * ============================================================ */

function getOrCreateSheet_() {
  const files = DriveApp.getFilesByName(SHEET_TITLE);
  let ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(SHEET_TITLE);
    const defaultSheet = ss.getSheets()[0];
    defaultSheet.setName(SHEET_TAB);
    defaultSheet.appendRow(SHEET_HEADER);
  }
  let sheet = ss.getSheetByName(SHEET_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_TAB);
    sheet.appendRow(SHEET_HEADER);
  }
  if (!ss.getSheetByName(HISTORY_TAB)) {
    const h = ss.insertSheet(HISTORY_TAB);
    h.appendRow(HISTORY_HEADER);
  }
  return sheet;
}

function readExistingRecords_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADER.length).getValues();
  return values
    .map((r) => ({
      name: r[1] || "",
      asin: r[2] || "",
      orderNumber: r[7] || "",
    }))
    .filter((r) => r.name || r.orderNumber);
}

function logRun_(scanned, savedItems, skipped, errorCount) {
  const files = DriveApp.getFilesByName(SHEET_TITLE);
  if (!files.hasNext()) return;
  const ss = SpreadsheetApp.open(files.next());
  const h = ss.getSheetByName(HISTORY_TAB) || ss.insertSheet(HISTORY_TAB);
  if (h.getLastRow() === 0) h.appendRow(HISTORY_HEADER);
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  h.appendRow([now, scanned, savedItems, skipped, errorCount]);
}

/* ============================================================
 * トリガー設定
 * ============================================================ */

function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "autoFetchPurchaseRecords") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("autoFetchPurchaseRecords")
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
  autoFetchPurchaseRecords(); // 設定確認を兼ねて、その場で1回実行しておく
}

/* ============================================================
 * メール解析ロジック
 * (Webツール側 script.js の classifySubject/stripHtml/extractAsinsInOrder/
 *  extractProductLinkNames/parseAmazonOrderEmail/inferIsUnitPriceと
 *  同一のロジック。Apps ScriptにはDOMが無いため、HTMLエンティティの
 *  デコードだけ自前の decodeHtmlEntities_ に置き換えている)
 * ============================================================ */

function decodeHtmlEntities_(str) {
  const named = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    nbsp: " ", yen: "¥", copy: "©", reg: "®", trade: "™", ensp: " ", emsp: " ",
  };
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (Object.prototype.hasOwnProperty.call(named, name) ? named[name] : m));
}

function stripHtml_(html) {
  const withBreaks = html.replace(/<(br|\/p|\/tr|\/td|\/th|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n");
  const noTags = withBreaks.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities_(noTags);
}

function classifySubject_(subject) {
  if (/キャンセル|取消|返品|返金|否認|支払いに失敗|決済に失敗|支払い方法の更新/.test(subject)) {
    return { tag: "warn", label: "⚠ キャンセル/支払い問題の可能性" };
  }
  if (/発送(済み|しました|されました|完了)|出荷(済み|しました|完了)|配送中|配達中|配達(済み|完了)|お届け(済み|完了)|届きました|shipped|delivered/i.test(subject)) {
    return { tag: "safe", label: "✓ 発送/配達済み" };
  }
  return { tag: "neutral", label: "注文確認など" };
}

function extractAsinsInOrder_(rawInput) {
  const re = /(?:\/dp\/|\/gp\/product\/|[?&]asin=)([A-Z0-9]{10})/g;
  const found = [];
  const seen = {};
  let m;
  while ((m = re.exec(rawInput)) !== null) {
    if (!seen[m[1]]) { seen[m[1]] = true; found.push(m[1]); }
  }
  return found;
}

function extractProductLinkNames_(rawInput) {
  const linkRe = /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const asinRe = /(?:\/dp\/|\/gp\/product\/|[?&]asin=)([A-Z0-9]{10})/i;
  const nonProductTextRe = /^(こちら|詳細|詳細を見る|商品を見る|注文履歴|注文の詳細|配送状況|配送状況を確認|レビュー|レビューを書く|返品|再購入|画像|アカウントサービス|Amazon\.co\.jp)$/i;
  const byAsin = {};
  const all = [];
  let m;
  while ((m = linkRe.exec(rawInput)) !== null) {
    const hrefRaw = m[1];
    let hrefDecoded = hrefRaw;
    try { hrefDecoded = decodeURIComponent(hrefRaw); } catch (e) { /* 不正なエンコードはそのまま使う */ }
    const text = stripHtml_(m[2]).replace(/\s+/g, " ").trim();
    if (text.length < 3 || nonProductTextRe.test(text)) continue;

    const asinMatch = hrefDecoded.match(asinRe) || hrefRaw.match(asinRe);
    const asin = asinMatch ? asinMatch[1] : null;

    all.push({ asin, name: text });
    if (asin) {
      const existing = byAsin[asin];
      if (!existing || text.length > existing.length) byAsin[asin] = text;
    }
  }
  return { byAsin, all };
}

function parseAmazonOrderEmail_(rawInput) {
  const recommendationCutoffRe = /もう一度買う|おすすめ商品|よく一緒に購入されている商品|この商品を買った人はこんな商品も買っています/;
  const cutoffMatch = rawInput.match(recommendationCutoffRe);
  const scopedInput = cutoffMatch ? rawInput.slice(0, cutoffMatch.index) : rawInput;

  const looksHtml = /<[a-z][\s\S]*>/i.test(scopedInput);
  let text = looksHtml ? stripHtml_(scopedInput) : scopedInput;
  text = text.replace(/[​-‏‪-‮⁦-⁩﻿]/g, "");

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  const priceRe = /[¥￥]\s?([\d,]{2,})/;
  const qtyRe = /(?:数量|個数)[:：]?\s*(\d+)|×\s?(\d+)\s*$/;
  const dividerRe = /^[-=_~･・…\s]{3,}$/;
  const nonNameRe = /^(注文|合計|小計|配送|消費税|お届け|数量|ご注文|お支払い|送信先|お届け先|発送|配達)/;

  const toNum = (s) => parseInt(String(s).replace(/,/g, ""), 10);

  const consumed = {};

  function findLabeledAmount(inlineRe, labelOnlyRe) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(inlineRe);
      if (m) { consumed[i] = true; return toNum(m[m.length - 1]); }
    }
    for (let i = 0; i < lines.length; i++) {
      if (labelOnlyRe.test(lines[i])) {
        for (let d = 1; d <= 2; d++) {
          const next = lines[i + d];
          if (next && priceRe.test(next)) {
            consumed[i] = true;
            consumed[i + d] = true;
            return toNum(next.match(priceRe)[1]);
          }
        }
      }
    }
    return null;
  }

  function findLabeledText(inlineRe, labelOnlyRe, valueRe) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(inlineRe);
      if (m) { consumed[i] = true; return m[1]; }
    }
    for (let i = 0; i < lines.length; i++) {
      if (labelOnlyRe.test(lines[i])) {
        const next = lines[i + 1];
        if (next && valueRe.test(next)) {
          consumed[i] = true;
          consumed[i + 1] = true;
          return next;
        }
      }
    }
    return null;
  }

  const orderNumber = findLabeledText(
    /注文番号[:：]?\s*([0-9A-Za-z-]{8,})/,
    /^注文番号[:：]?\s*$/,
    /^[0-9A-Za-z-]{8,}$/
  );
  const orderTotal = findLabeledAmount(
    /(注文合計|ご請求金額|お支払い金額|合計)[:：]?\s*[¥￥]\s?([\d,]{2,})/,
    /^(注文合計|ご請求金額|お支払い金額|合計)[:：]?$/
  );

  const priceLineIdx = [];
  const qtyLineIdx = [];

  lines.forEach((line, i) => {
    const mQty = line.match(qtyRe);
    if (mQty) qtyLineIdx.push({ i: i, qty: parseInt(mQty[1] || mQty[2], 10) });

    if (priceRe.test(line) && !consumed[i]) {
      priceLineIdx.push({ i: i, price: toNum(line.match(priceRe)[1]) });
    }
  });

  const isPlausibleName = (l) => l && l.length >= 3 && !priceRe.test(l) && !qtyRe.test(l) && !nonNameRe.test(l) && !dividerRe.test(l);
  const findNearbyLabel = (idx) => {
    for (let d = 1; d <= 4; d++) {
      const before = lines[idx - d];
      if (isPlausibleName(before)) return before;
    }
    for (let d = 1; d <= 4; d++) {
      const after = lines[idx + d];
      if (isPlausibleName(after)) return after;
    }
    return "";
  };

  const findNearbyQty = (idx) => {
    let best = null;
    let bestDist = Infinity;
    qtyLineIdx.forEach((q) => {
      const d = Math.abs(q.i - idx);
      if (d < bestDist) { bestDist = d; best = q.qty; }
    });
    return bestDist <= 4 ? best : 1;
  };

  const items = priceLineIdx.map(({ i, price }) => ({
    name: findNearbyLabel(i) || "(商品名を確認してください)",
    price: price,
    quantity: findNearbyQty(i),
    isUnitPrice: false,
    asin: "",
  }));

  const asins = extractAsinsInOrder_(scopedInput);
  if (asins.length === items.length) {
    items.forEach((item, idx) => { item.asin = asins[idx]; });
  }

  const linkData = extractProductLinkNames_(scopedInput);
  const uniqueLinkNames = Array.from(new Set(linkData.all.map((c) => c.name)));
  items.forEach((item) => {
    if (item.asin && linkData.byAsin[item.asin]) {
      item.name = linkData.byAsin[item.asin];
    } else if (items.length === 1 && uniqueLinkNames.length === 1) {
      item.name = uniqueLinkNames[0];
    }
  });

  return { orderNumber: orderNumber, orderTotal: orderTotal, items: items };
}

function inferIsUnitPrice_(item, orderTotal) {
  if (item.quantity <= 1 || orderTotal === null) return false;
  const diffAsTotal = Math.abs(item.price - orderTotal);
  const diffAsUnit = Math.abs(item.price * item.quantity - orderTotal);
  return diffAsUnit < diffAsTotal;
}
