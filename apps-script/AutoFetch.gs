/**
 * 仕入れ単価 自動計算ツール - Gmail自動取得スクリプト（Google Apps Script）
 *
 * Webツール(index.html/script.js)はブラウザを開いている間しか動かないため、
 * ブラウザを開かなくても毎日自動でGmailを検索し、仕入れ単価をスプレッドシート
 * （Webツールと同じ「仕入れ単価計算ツール_仕入れ記録」）へ記録する。
 *
 * セットアップ手順（1アカウントにつき1回。7アカウント分、それぞれで設定が必要）
 *  1. まずWebツール側でそのGoogleアカウントと連携し(「Googleと連携する」または
 *     「+ 別のアカウントを追加」)、「スプレッドシートを開く」ボタンを押して、
 *     開いたページのURLから スプレッドシートID
 *     （ https://docs.google.com/spreadsheets/d/【ここの文字列】/edit ）をコピーする。
 *     これを下のSPREADSHEET_IDに貼り付けておく(省略するとWebツールと別の
 *     スプレッドシートが作られてしまい、記録が2つに分かれてしまうため必須)。
 *  2. そのGoogleアカウントで https://script.google.com/ を開き、「新しいプロジェクト」を作成
 *  3. 出てきたエディタの中身を全部消して、このファイルの内容を貼り付ける
 *  4. 上部の関数選択プルダウンで setupDailyTrigger を選び、実行ボタン(▷)を押す
 *     → 初回はGoogleの権限許可画面が出るので、Gmail読み取り・スプレッドシート
 *       編集・Driveへのアクセスを許可する
 *  5. 「成功」と出れば、毎日自動実行するトリガーが設定完了（以後は何もしなくてよい）
 *  6. 動作確認したい場合は、関数選択プルダウンで autoFetchPurchaseRecords を選んで
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

// Webツール側はセキュリティ上「このツールが作成したファイルのみアクセス可」という
// 限定的な権限(drive.file)で動いているため、Apps Script側が先に同名の
// スプレッドシートを作成してしまうと、Webツールからはそのファイルが見えず、
// 別の空のスプレッドシートを新規作成してしまう(記録が2つに分かれて見える不具合の原因)。
// これを避けるには、Webツールの「スプレッドシートを開く」ボタンで開いたページの
// URLから スプレッドシートID（ https://docs.google.com/spreadsheets/d/【ここ】/edit ）
// をコピーし、下のSPREADSHEET_IDに貼り付けておく(空文字のままなら、従来通り
// 名前で検索・無ければ新規作成する)。
const SPREADSHEET_ID = "";

const GMAIL_QUERY = "from:amazon.co.jp 発送"; // Webツールの初期値と同じ。必要に応じて書き換えてよい
const MAX_MESSAGES_PER_RUN = 200; // 1回の実行での上限(実行時間・Gmail APIクォータの暴走防止)

/* ============================================================
 * メイン処理
 * ============================================================ */

/**
 * 認可直後の実行は、許可画面を挟んで同じ関数が意図せず複数回動くことが
 * あるため、スクリプトロックで同時実行を防ぐ。ロックを取れなかった
 * (=既に別の実行が進行中)場合は、何もせず静かに終了する。
 */
function autoFetchPurchaseRecords() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    Logger.log("他の実行が進行中のため、今回はスキップしました。");
    return;
  }
  try {
    autoFetchPurchaseRecords_();
  } finally {
    lock.releaseLock();
  }
}

function autoFetchPurchaseRecords_() {
  const sheet = getOrCreateSheet_();
  const existingRecords = readExistingRecords_(sheet);
  const savedOrderKeys = new Set(
    existingRecords.filter((r) => r.orderNumber).map((r) => r.orderNumber + "|" + (r.asin || r.name))
  );

  let scanned = 0;
  let savedItems = 0;
  let skipped = 0;
  let errorCount = 0;

  try {
    const threads = GmailApp.search(GMAIL_QUERY, 0, MAX_MESSAGES_PER_RUN);
    const messages = [].concat.apply([], threads.map((t) => t.getMessages()));
    const parseResults = [];

    messages.forEach((message) => {
      scanned++;
      try {
        const result = parseMessageForAuto_(message);
        if (result.skipped) skipped++;
        parseResults.push(result);
      } catch (e) {
        errorCount++;
        Logger.log("メッセージ処理エラー (" + message.getId() + "): " + e.message);
      }
    });

    // 同じ注文番号+商品について複数のメールが候補にある場合、注文確認メールを
    // 優先して1件だけ保存する(pickBestAutoCandidates_のコメントを参照)。
    const picked = pickBestAutoCandidates_(parseResults);
    const rowsToAppend = [];
    const claimedRows = {};
    let backfilledCount = 0;
    Object.keys(picked.byKey).forEach((key) => {
      if (savedOrderKeys.has(key)) return;
      const cand = picked.byKey[key];
      // 以前の保存分はASINが空で名前が途中で切れていることがあり、キーが一致しない。
      // 同じ注文の同じ商品が保存済みなら、二重に保存せず足りない情報だけを補う。
      const match = findMatchingRecord_(existingRecords, cand.parsed.orderNumber, cand.item, claimedRows, calcRecordAmount_(cand.item, cand.parsed));
      if (match.ambiguous) return;
      if (match.record) {
        claimedRows[match.record.rowNumber] = true;
        const fields = buildRecordBackfill_(match.record, cand.item);
        if (fields) {
          sheet.getRange(match.record.rowNumber, 2, 1, 2).setValues([[fields.name, fields.asin]]);
          backfilledCount++;
        }
        return;
      }
      rowsToAppend.push(buildRow_(cand.item, cand.parsed, cand.dateStr));
      savedItems++;
    });
    if (backfilledCount > 0) Logger.log("既存の記録" + backfilledCount + "件のASIN・商品名を補完しました。");
    picked.noKeyRows.forEach((cand) => {
      rowsToAppend.push(buildRow_(cand.item, cand.parsed, cand.dateStr));
      savedItems++;
    });

    appendRows_(sheet, rowsToAppend);

    // キャンセルメールが見つかった注文番号について、過去の実行で既に
    // 保存されてしまっている記録があれば、まとめて削除する。
    removeCancelledRows_(sheet, existingRecords, picked.cancelledOrderNumbers);
  } catch (e) {
    errorCount++;
    Logger.log("自動取得エラー: " + e.message);
  }

  logRun_(scanned, savedItems, skipped, errorCount);
}

/**
 * 1通のメールを分類・解析するだけで、行の組み立てはしない(複数メールを
 * まとめて見てから、どのメールを採用するか決めるため。pickBestAutoCandidates_
 * のコメントを参照)。件名が「キャンセル/支払い問題の可能性」や、出品者への
 * 評価依頼メール(marketplace-messages@)は、実際の購入が成立していない/
 * 金額情報を含まないため対象から除く。
 */
function parseMessageForAuto_(message) {
  const from = message.getFrom();
  const subject = message.getSubject();

  if (/marketplace-messages@/i.test(from)) return { skipped: true };
  const classification = classifySubject_(subject);
  if (classification.tag === "warn") {
    // キャンセル/返金等のメール自体から商品は保存しないが、同じ注文番号の
    // 他のメール(注文確認・発送済み等)が保存されてしまわないよう、注文番号
    // だけは抽出して呼び出し元に伝える(pickBestAutoCandidates_のコメント参照)。
    const cancelledOrderNumber = parseAmazonOrderEmail_(message.getBody()).orderNumber;
    return { skipped: true, cancelledOrderNumber: cancelledOrderNumber };
  }

  const html = message.getBody();
  const parsed = parseAmazonOrderEmail_(html);
  if (parsed.items.length === 0) return { skipped: true };

  const dateStr = Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  return { skipped: false, dateStr: dateStr, classification: classification.tag, parsed: parsed };
}

/**
 * 同じ注文について「ご注文の確認」等の注文確認メールと、「発送済み」
 * 「配達中」等の配送状況メールの両方が候補にあることがある。配送状況メールは
 * Amazonポイントやクーポンによる値引きが反映される前の金額(カタログ価格)を
 * そのまま表示していることがある一方、注文確認メールは実際に請求された
 * 金額を表示しているため、配送状況メール(safe)より注文確認メール(neutral)を
 * 優先して1件だけ採用する(どちらも配送状況メールの場合は、どちらでも表示
 * される金額に通常差はないため、先に見つかった方でよい)。
 *
 * また、同じ注文番号について「キャンセルされました」等のメール(warn判定、
 * cancelledOrderNumberとして渡される)が1通でもあれば、その注文番号は
 * 他のメールがどれだけあっても一切採用しない(実際には成立しなかった注文を
 * 仕入れとして記録してしまうのを防ぐ)。
 */
function pickBestAutoCandidates_(results) {
  const cancelledOrderNumbers = {};
  results.forEach((r) => {
    if (r.cancelledOrderNumber) cancelledOrderNumbers[r.cancelledOrderNumber] = true;
  });

  const bestByKey = {};
  const noKeyRows = []; // 注文番号が無く重複判定できないものはそのまま採用する

  results.forEach((r) => {
    if (r.skipped || !r.parsed) return;
    if (r.parsed.orderNumber && cancelledOrderNumbers[r.parsed.orderNumber]) return;
    const priority = r.classification === "safe" ? 1 : 2; // neutral(注文確認)を優先
    r.parsed.items.forEach((item) => {
      if (!r.parsed.orderNumber) { noKeyRows.push({ item: item, parsed: r.parsed, dateStr: r.dateStr }); return; }
      const key = r.parsed.orderNumber + "|" + (item.asin || item.name);
      const existing = bestByKey[key];
      if (!existing || priority > existing.priority) {
        bestByKey[key] = { item: item, parsed: r.parsed, dateStr: r.dateStr, priority: priority };
      }
    });
  });

  return { byKey: bestByKey, noKeyRows: noKeyRows, cancelledOrderNumbers: cancelledOrderNumbers };
}

function calcRecordAmount_(item, parsed) {
  const isUnitPrice = inferIsUnitPrice_(item, parsed.orderTotal);
  return isUnitPrice ? item.price * item.quantity : item.price;
}

/**
 * 商品名の照合用の正規化(全角半角の統一・空白の圧縮・末尾の省略記号の除去・小文字化)。
 * メール由来の名前は途中で「...」「…」と省略されていることがあるため、省略記号を
 * 除いた先頭部分どうしの前方一致で同じ商品かを判定する。
 */
/** HTMLタグの断片(「<table align=...」等)が商品名として保存されてしまったかどうか。 */
function isHtmlFragment_(s) {
  return /<\/?[a-zA-Z!]/.test(String(s || ""));
}

function normalizeNameForMatch_(name) {
  return String(name || "").normalize("NFKC").replace(/\s+/g, " ").trim().replace(/\.{2,}$/, "").trim().toLowerCase();
}

/**
 * 既存の記録行(rec)が、同じ注文の同じ商品(item)かどうか。ASINが両方あればASINの一致で、
 * どちらかが無ければ名前(省略表示を考慮した前方一致)で判定する。
 */
function isSameOrderItem_(rec, orderNumber, item) {
  if (!rec.orderNumber || rec.orderNumber !== orderNumber) return false;
  if (rec.asin && item.asin) return rec.asin === item.asin;
  const a = normalizeNameForMatch_(rec.name);
  const b = normalizeNameForMatch_(item.name);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 6 && longer.indexOf(shorter) === 0;
}

/**
 * 保存済みの記録から、今回の商品に対応する行を探す。複数の行が該当する場合は数量と金額で
 * 絞り込み、それでも1行に決まらなければ「曖昧」として、誤った行の更新も二重保存も避ける。
 * 同じ行を2つの商品が取り合わないよう、claimedRows(使用済みの行番号)を除外する。
 */
function findMatchingRecord_(records, orderNumber, item, claimedRows, amount) {
  if (!orderNumber) return { record: null, ambiguous: false };
  let matches = records.filter((r) => !claimedRows[r.rowNumber] && isSameOrderItem_(r, orderNumber, item));
  if (matches.length === 0) {
    // 商品名がHTMLの断片になってしまった既存の行は、名前では照合できないため、
    // 同じ注文で数量・金額が一致するものを同じ商品とみなして正しい名前に直す。
    matches = records.filter((r) => !claimedRows[r.rowNumber] && r.orderNumber === orderNumber && isHtmlFragment_(r.name)
      && r.quantity === item.quantity && Math.abs(r.amount - amount) < 1);
  }
  if (matches.length <= 1) return { record: matches[0] || null, ambiguous: false };
  const narrowed = matches.filter((r) => r.quantity === item.quantity && Math.abs(r.amount - amount) < 1);
  if (narrowed.length === 1) return { record: narrowed[0], ambiguous: false };
  return { record: null, ambiguous: true };
}

/**
 * 既存の行に足りない情報(ASIN、省略されていた商品名の続き)を今回の解析結果で補う。
 * 補うべき変更が無ければnullを返す。
 */
function buildRecordBackfill_(rec, item) {
  const asin = rec.asin || item.asin || "";
  let name = rec.name;
  if (isHtmlFragment_(rec.name) && !isHtmlFragment_(item.name)) {
    name = item.name;
  } else if (/(\.{2,}|…)\s*$/.test(rec.name) && item.name.length > rec.name.length) {
    const a = normalizeNameForMatch_(rec.name);
    if (a && normalizeNameForMatch_(item.name).indexOf(a) === 0) name = item.name;
  }
  if (asin === (rec.asin || "") && name === rec.name) return null;
  return { name: name, asin: asin };
}

function buildRow_(item, parsed, dateStr) {
  const isUnitPrice = inferIsUnitPrice_(item, parsed.orderTotal);
  const unitPrice = isUnitPrice ? item.price : item.price / (item.quantity || 1);
  const amount = isUnitPrice ? item.price * item.quantity : item.price;
  return [dateStr, item.name, item.asin || "", item.quantity, unitPrice, amount, "auto", parsed.orderNumber || ""];
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
  let ss;
  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    const files = DriveApp.getFilesByName(SHEET_TITLE);
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      ss = SpreadsheetApp.create(SHEET_TITLE);
      const defaultSheet = ss.getSheets()[0];
      defaultSheet.setName(SHEET_TAB);
      defaultSheet.appendRow(SHEET_HEADER);
    }
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
    .map((r, idx) => ({
      name: r[1] || "",
      asin: r[2] || "",
      quantity: parseFloat(r[3]) || 0,
      amount: parseFloat(r[5]) || 0,
      orderNumber: r[7] || "",
      rowNumber: idx + 2, // シート上の実際の行番号(2行目から始まるため+2)
    }))
    .filter((r) => r.name || r.orderNumber);
}

/**
 * キャンセル等が判明した注文番号について、既にシートに保存済みの行が
 * あれば削除する。行番号が大きい方から先に削除しないと、削除のたびに
 * 後続行の番号がずれて別の行を消してしまうため、降順に処理する。
 */
function removeCancelledRows_(sheet, existingRecords, cancelledOrderNumbers) {
  const toRemove = existingRecords.filter((r) => r.orderNumber && cancelledOrderNumbers[r.orderNumber]);
  toRemove.sort((a, b) => b.rowNumber - a.rowNumber);
  toRemove.forEach((r) => sheet.deleteRow(r.rowNumber));
  return toRemove.length;
}

function logRun_(scanned, savedItems, skipped, errorCount) {
  let ss;
  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    const files = DriveApp.getFilesByName(SHEET_TITLE);
    if (!files.hasNext()) return;
    ss = SpreadsheetApp.open(files.next());
  }
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
  const noStyleScript = html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
  const withBreaks = noStyleScript.replace(/<(br|\/p|\/tr|\/td|\/th|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n");
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
  // クリック計測用のリダイレクトURL(.../r.html?...&U=https%3A%2F%2F...%2Fdp%2FASIN)では
  // 「/」が%2Fにエンコードされているため、そのままでは/dp/に一致しない。
  const normalized = rawInput.replace(/%2F/gi, "/");
  const re = /(?:\/dp\/|\/gp\/product\/|[?&]asin=)([A-Z0-9]{10})/g;
  const found = [];
  const seen = {};
  let m;
  while ((m = re.exec(normalized)) !== null) {
    if (!seen[m[1]]) { seen[m[1]] = true; found.push(m[1]); }
  }
  return found;
}

function extractProductLinkNames_(rawInput) {
  const linkRe = /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const asinRe = /(?:\/dp\/|\/gp\/product\/|[?&]asin=)([A-Z0-9]{10})/i;
  const nonProductTextRe = /^(こちら|詳細|詳細を見る|商品を見る|注文履歴|注文の詳細|配送状況|配送状況を確認|レビュー|レビューを書く|返品|再購入|画像|アカウントサービス|Amazon\.co\.jp)$/i;
  const byAsin = {};
  const altByAsin = {}; // 商品画像のalt属性(リンク文字列は省略表示でも、altには完全な商品名が入っている)
  const all = [];
  let m;
  while ((m = linkRe.exec(rawInput)) !== null) {
    const hrefRaw = m[1];
    let hrefDecoded = hrefRaw;
    try { hrefDecoded = decodeURIComponent(hrefRaw); } catch (e) { /* 不正なエンコードはそのまま使う */ }
    const asinMatch = hrefDecoded.match(asinRe) || hrefRaw.match(asinRe);
    const asin = asinMatch ? asinMatch[1] : null;

    if (asin) {
      const imgRe = /<img\b[^>]*\balt="([^"]*)"/gi;
      let im;
      while ((im = imgRe.exec(m[2])) !== null) {
        const alt = stripHtml_(im[1]).replace(/\s+/g, " ").trim();
        if (alt.length < 3 || nonProductTextRe.test(alt)) continue;
        if (!altByAsin[asin]) altByAsin[asin] = [];
        altByAsin[asin].push(alt);
      }
    }

    const text = stripHtml_(m[2]).replace(/\s+/g, " ").trim();
    if (text.length < 3 || nonProductTextRe.test(text)) continue;

    all.push({ asin, name: text });
    if (asin) {
      const existing = byAsin[asin];
      if (!existing || text.length > existing.length) byAsin[asin] = text;
    }
  }
  return { byAsin, all, altByAsin };
}

/**
 * メール本文のリンク文字列は省略表示(末尾が「...」「…」)されることがあるが、同じ
 * 商品画像のalt属性には完全な商品名が入っている。省略されている名前の先頭部分
 * (stem)で始まるaltがあれば、それを完全な商品名として採用する。ASINが分かって
 * いればそのASINの画像のaltの中で最も長いものを、ASIN不明なら全ての画像のaltの
 * うち一意に決まる場合だけ採用する(曖昧なときは推測せず元の名前のまま)。
 */
function extendTruncatedName_(name, asin, altByAsin) {
  if (!/(\.{2,}|…)\s*$/.test(name)) return name;
  const stem = name.replace(/(\.{2,}|…)\s*$/, "").trim();
  if (!stem) return name;
  const startsWithStem = (alt) => alt.length > stem.length && alt.indexOf(stem) === 0;
  if (asin && altByAsin[asin]) {
    const hits = altByAsin[asin].filter(startsWithStem).sort((a, b) => b.length - a.length);
    if (hits.length > 0) return hits[0];
  }
  const pool = [];
  Object.keys(altByAsin).forEach((k) => altByAsin[k].forEach((a) => pool.push(a)));
  const unique = Array.from(new Set(pool.filter(startsWithStem)));
  return unique.length === 1 ? unique[0] : name;
}

function parseAmazonOrderEmail_(rawInput) {
  // moduleId-marketingSlotは実際の注文確認メールで確認された広告枠
  // (「${hash-get display-group}のおすすめセール」等、見出し文言は一定しない)
  // で、見出し文言ではなくHTML側のモジュール名で切り詰める方が確実。
  const recommendationCutoffRe = /もう一度買う|おすすめ商品|よく一緒に購入されている商品|この商品を買った人はこんな商品も買っています|moduleId-marketingSlot/;
  const cutoffMatch = rawInput.match(recommendationCutoffRe);
  // 目印(moduleId-marketingSlot等)は、古いメールソフト向けの条件付きコメント内のタグ
  // (<table ... class="...moduleId-marketingSlot-outlook">)の属性にも現れる。その途中で切ると
  // 閉じていないタグの断片が文字として残り、商品名に混ざってしまうため、タグの先頭まで戻す。
  let cutIndex = cutoffMatch ? cutoffMatch.index : rawInput.length;
  const lastLt = rawInput.lastIndexOf("<", cutIndex);
  if (lastLt >= 0 && rawInput.indexOf(">", lastLt) >= cutIndex) cutIndex = lastLt;
  const scopedInput = rawInput.slice(0, cutIndex);

  const looksHtml = /<[a-z][\s\S]*>/i.test(scopedInput);
  let text = looksHtml ? stripHtml_(scopedInput) : scopedInput;
  text = text.replace(/[​-‏‪-‮⁦-⁩﻿]/g, "");

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  const priceRe = /[¥￥]\s?([\d,]{2,})/;
  const qtyRe = /(?:数量|個数)[:：]?\s*(\d+)|×\s?(\d+)\s*$/;
  const dividerRe = /^[-=_~･・…\s]{3,}$/;
  const nonNameRe = /^(注文|合計|小計|配送|消費税|お届け|数量|ご注文|お支払い|送信先|お届け先|発送|配達)/;
  const numericOnlyRe = /^[\d,.\s]+$/;

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

  const isPlausibleName = (l) => l && l.length >= 3 && !priceRe.test(l) && !qtyRe.test(l) && !nonNameRe.test(l) && !dividerRe.test(l) && !numericOnlyRe.test(l) && !isHtmlFragment_(l);
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

  // 商品数とASIN数が一致せず1対1で割り当てられなかった場合でも、商品名と同じ文字列の
  // 商品リンクがあれば、そのリンクのASINを採用できる。
  items.forEach((item) => {
    if (item.asin) return;
    const itemName = item.name.replace(/\s+/g, " ").trim();
    const hit = linkData.all.find((c) => c.asin && c.name === itemName);
    if (hit) item.asin = hit.asin;
  });

  items.forEach((item) => {
    if (item.asin && linkData.byAsin[item.asin]) {
      item.name = linkData.byAsin[item.asin];
    } else if (items.length === 1 && uniqueLinkNames.length === 1) {
      item.name = uniqueLinkNames[0];
    }
    item.name = extendTruncatedName_(item.name, item.asin, linkData.altByAsin);
  });

  // 単一商品の注文で、商品欄のカタログ価格と実際の請求合計が大きく異なる場合
  // (Amazonポイントを支払いに充当した注文等)、実際に支払った金額である合計を
  // 優先する。
  if (items.length === 1 && orderTotal !== null) {
    const item = items[0];
    if (Math.abs(item.price * item.quantity - orderTotal) > 1) {
      item.price = orderTotal;
      item.isUnitPrice = false;
    }
  }

  return { orderNumber: orderNumber, orderTotal: orderTotal, items: items };
}

function inferIsUnitPrice_(item, orderTotal) {
  if (item.quantity <= 1 || orderTotal === null) return false;
  const diffAsTotal = Math.abs(item.price - orderTotal);
  const diffAsUnit = Math.abs(item.price * item.quantity - orderTotal);
  return diffAsUnit < diffAsTotal;
}
