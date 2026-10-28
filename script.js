"use strict";

const CATEGORIES = [
  { label: "おもちゃ・ホビー（プラモデル等）", rate: 15, closingFee: 0 },
  { label: "TVゲーム・ゲームアクセサリ", rate: 15, closingFee: 0 },
  { label: "家電・カメラ", rate: 8, closingFee: 0 },
  { label: "パソコン・周辺機器", rate: 8, closingFee: 0 },
  { label: "ドラッグストア", rate: 10, closingFee: 0 },
  { label: "ビューティー", rate: 8, closingFee: 0 },
  { label: "ホーム&キッチン", rate: 15, closingFee: 0 },
  { label: "スポーツ&アウトドア", rate: 15, closingFee: 0 },
  { label: "食品&飲料", rate: 8, closingFee: 0 },
  { label: "ベビー&マタニティ", rate: 15, closingFee: 0 },
  { label: "衣料・ファッション・シューズ&バッグ", rate: 15, closingFee: 0 },
  { label: "腕時計", rate: 20, closingFee: 0 },
  { label: "ジュエリー", rate: 20, closingFee: 0 },
  { label: "楽器", rate: 15, closingFee: 0 },
  { label: "DIY・工具・ガーデン", rate: 15, closingFee: 0 },
  { label: "本・ミュージック・DVD・ビデオ（メディア商品）", rate: 15, closingFee: 140 },
  { label: "ペット用品", rate: 15, closingFee: 0 },
  { label: "文房具・オフィス用品", rate: 15, closingFee: 0 },
  { label: "その他（一般カテゴリー）", rate: 10, closingFee: 0 },
  { label: "自分で入力する（料率を手入力）", rate: null, closingFee: null },
];

const FBA_TIERS = [
  { label: "小型（25×18×2cm以下・250g以下）", fee: 290 },
  { label: "標準1（目安 〜1kg）", fee: 430 },
  { label: "標準2（目安 〜2kg）", fee: 490 },
  { label: "標準3（目安 〜5kg）", fee: 560 },
  { label: "標準4（目安 〜9kg）", fee: 700 },
  { label: "大型（9kg超・大型サイズ）", fee: 1500 },
  { label: "自分で入力する（金額を手入力）", fee: null },
];

const LAST_STATE_KEY = "ppcalc_lastState_v1";
const HISTORY_KEY = "ppcalc_history_v1";

const yen = (v) => "¥" + Math.round(v).toLocaleString("ja-JP");
const pct = (v) => (v === null || v === undefined || !isFinite(v)) ? "—" : v.toFixed(1) + "%";

function $(id) { return document.getElementById(id); }

function fillSelect(selectEl, items, labelKey, valueIndexAsValue) {
  selectEl.innerHTML = items
    .map((item, i) => `<option value="${i}">${item[labelKey]}</option>`)
    .join("");
}

function num(id, fallback = 0) {
  const el = $(id);
  const v = parseFloat(el.value);
  return isNaN(v) ? fallback : v;
}

function numOrNull(id) {
  const el = $(id);
  if (el.value.trim() === "") return null;
  const v = parseFloat(el.value);
  return isNaN(v) ? null : v;
}

function readState() {
  return {
    mode: document.querySelector('input[name="mode"]:checked').value,
    productName: $("productName").value,
    asin: $("asin").value,
    category: $("category").value,
    sellPrice: numOrNull("sellPrice"),
    taxRate: num("taxRate", 0.1),
    referralRate: num("referralRate"),
    closingFee: num("closingFee"),
    fbaSizeTier: $("fbaSizeTier").value,
    fbaFee: num("fbaFee"),
    storageFee: num("storageFee"),
    acos: num("acos"),
    returnRate: num("returnRate"),
    purchasePrice: numOrNull("purchasePrice"),
    purchaseTaxExcluded: $("purchaseTaxExcluded").checked,
    shippingIn: num("shippingIn"),
    customs: num("customs"),
    inspection: num("inspection"),
    fbaShip: num("fbaShip"),
    otherCost: num("otherCost"),
    targetType: document.querySelector('input[name="targetType"]:checked').value,
    targetMarginPct: num("targetMarginPct", 20),
    targetRoiPct: num("targetRoiPct", 30),
  };
}

function writeState(s) {
  $("productName").value = s.productName || "";
  $("asin").value = s.asin || "";
  if (s.category !== undefined) $("category").value = s.category;
  if (s.sellPrice !== null && s.sellPrice !== undefined) $("sellPrice").value = s.sellPrice;
  $("taxRate").value = s.taxRate === 0.08 ? "0.08" : "0.10";
  $("referralRate").value = s.referralRate;
  $("closingFee").value = s.closingFee;
  if (s.fbaSizeTier !== undefined) $("fbaSizeTier").value = s.fbaSizeTier;
  $("fbaFee").value = s.fbaFee;
  $("storageFee").value = s.storageFee;
  $("acos").value = s.acos;
  $("returnRate").value = s.returnRate;
  if (s.purchasePrice !== null && s.purchasePrice !== undefined) $("purchasePrice").value = s.purchasePrice;
  $("purchaseTaxExcluded").checked = !!s.purchaseTaxExcluded;
  $("shippingIn").value = s.shippingIn;
  $("customs").value = s.customs;
  $("inspection").value = s.inspection;
  $("fbaShip").value = s.fbaShip;
  $("otherCost").value = s.otherCost;
  $("targetMarginPct").value = s.targetMarginPct;
  $("targetRoiPct").value = s.targetRoiPct;
  document.querySelector(`input[name="mode"][value="${s.mode}"]`).checked = true;
  document.querySelector(`input[name="targetType"][value="${s.targetType}"]`).checked = true;
}

/**
 * すべての金額は「税込・1個あたり」で統一して計算する。
 * 返品時は、その個体にかけた原価（仕入れ+付随費用+FBA手数料）を
 * 丸ごと失う前提（保守的なワーストケース）で返品損失を見積もる。
 */
function compute(s) {
  const errors = [];
  const warnings = [];

  if (s.sellPrice === null || s.sellPrice <= 0) {
    return { status: "need-sell-price" };
  }

  const P = s.sellPrice;
  const r = s.referralRate / 100;
  const acos = s.acos / 100;
  const retRate = s.returnRate / 100;
  const closingFee = s.closingFee;
  const storageFee = s.storageFee;
  const FBA = s.fbaFee;
  const G = s.shippingIn + s.customs + s.inspection + s.fbaShip; // 仕入れ側の付随固定費
  const F = G + s.otherCost; // 付随固定費の全体（販売側のその他経費も含む）

  const denom = 1 - r - acos;
  const Rprime = P * (1 - r) - closingFee - storageFee - P * acos;

  if (denom <= 0) {
    errors.push("Amazon販売手数料率と広告費率(ACoS)の合計が100%以上になっています。手数料率を見直してください。");
    return { status: "error", errors };
  }

  let C; // 仕入れ単価（税込）

  if (s.mode === "reverse") {
    if (s.targetType === "margin") {
      const costBaseFull = (Rprime - (s.targetMarginPct / 100) * P) / (1 + retRate);
      C = costBaseFull - F - FBA;
    } else {
      const numerator = Rprime - (1 + retRate) * (s.otherCost + FBA);
      const denomRoi = s.targetRoiPct / 100 + (1 + retRate);
      const CG = numerator / denomRoi;
      C = CG - G;
    }
    if (!isFinite(C)) {
      errors.push("入力値の組み合わせでは計算できません。");
      return { status: "error", errors };
    }
    if (C <= 0) {
      warnings.push("目標を満たす仕入れ単価がマイナスになりました。目標利益率／ROIが高すぎるか、手数料・諸経費が販売価格に対して大きすぎます。目標値か販売価格を見直してください。");
    }
  } else {
    if (s.purchasePrice === null) {
      return { status: "need-purchase-price" };
    }
    C = s.purchaseTaxExcluded ? s.purchasePrice * (1 + s.taxRate) : s.purchasePrice;
  }

  const costBaseFull = C + F + FBA;
  const returnLoss = retRate * costBaseFull;
  const purchaseCostTotal = C + G; // 「総仕入れコスト」＝仕入単価＋送料＋関税＋検品梱包＋FBA納品送料
  const sellingCostTotal = r * P + closingFee + FBA + storageFee + acos * P + returnLoss + s.otherCost;
  const grossProfit = P - purchaseCostTotal;
  const netProfit = P - purchaseCostTotal - sellingCostTotal;
  const grossMarginPct = (grossProfit / P) * 100;
  const netMarginPct = (netProfit / P) * 100;
  const roiPct = purchaseCostTotal > 0 ? (netProfit / purchaseCostTotal) * 100 : null;
  const breakevenPrice = (closingFee + storageFee + (1 + retRate) * costBaseFull) / denom;
  const targetPriceDenom = denom - s.targetMarginPct / 100;
  const targetMarginPrice = targetPriceDenom > 0
    ? (closingFee + storageFee + (1 + retRate) * costBaseFull) / targetPriceDenom
    : null;

  if (netMarginPct < 10) warnings.push(`純利益率が ${netMarginPct.toFixed(1)}% と低めです（目安10%未満）。価格・仕入れ値の見直しを検討してください。`);
  if (roiPct !== null && roiPct < 30) warnings.push(`ROIが ${roiPct.toFixed(1)}% とやや低めです（目安30%未満）。`);
  if (P < breakevenPrice) warnings.push(`現在の販売価格（${yen(P)}）が損益分岐点（${yen(breakevenPrice)}）を下回っており、赤字になる計算です。`);

  const result = {
    status: "ok",
    mode: s.mode,
    P, C,
    purchaseCostTaxExcluded: C / (1 + s.taxRate),
    grossProfit, netProfit, grossMarginPct, netMarginPct, roiPct,
    breakevenPrice, targetMarginPrice,
    purchaseCostTotal, sellingCostTotal, returnLoss,
    referralFeeAmount: r * P, adAmount: acos * P,
    closingFee, storageFee, FBA,
    shippingIn: s.shippingIn, customs: s.customs, inspection: s.inspection, fbaShip: s.fbaShip, otherCost: s.otherCost,
    warnings, errors,
  };

  return result;
}

function render(s, result) {
  renderHeadline(s, result);
  renderMetrics(result);
  renderBreakdown(result);
  renderAssumptions(s);
}

function renderHeadline(s, result) {
  const el = $("headlineContent");
  const metricsCard = $("metricsCard");
  const breakdownCard = $("breakdownCard");

  if (result.status === "need-sell-price") {
    el.innerHTML = `<p class="result-headline__label">販売価格を入力してください</p>`;
    metricsCard.hidden = true;
    breakdownCard.hidden = true;
    return;
  }
  if (result.status === "need-purchase-price") {
    el.innerHTML = `<p class="result-headline__label">仕入れ単価を入力してください</p>`;
    metricsCard.hidden = true;
    breakdownCard.hidden = true;
    return;
  }
  if (result.status === "error") {
    el.innerHTML = `<p class="result-headline__label" style="color:var(--red)">${result.errors.join("<br>")}</p>`;
    metricsCard.hidden = true;
    breakdownCard.hidden = true;
    return;
  }

  metricsCard.hidden = false;
  breakdownCard.hidden = false;

  if (result.mode === "reverse") {
    $("purchasePrice").value = Math.round(result.C);
    const cls = result.C > 0 ? "is-positive" : "is-negative";
    el.innerHTML = `
      <p class="result-headline__label">推奨 仕入れ単価（上限の目安）</p>
      <p class="result-headline__value ${cls}">${yen(result.C)}</p>
      <p class="result-headline__sub">税抜換算：${yen(result.purchaseCostTaxExcluded)}／この価格以下での仕入れを目標にしてください</p>
    `;
  } else {
    const cls = result.netProfit >= 0 ? "is-positive" : "is-negative";
    el.innerHTML = `
      <p class="result-headline__label">純利益（1個あたり）</p>
      <p class="result-headline__value ${cls}">${yen(result.netProfit)}</p>
      <p class="result-headline__sub">純利益率 ${pct(result.netMarginPct)}／ROI ${pct(result.roiPct)}</p>
    `;
  }
}

function renderMetrics(result) {
  if (result.status !== "ok") return;
  const items = [
    ["粗利益（1個）", yen(result.grossProfit)],
    ["粗利益率", pct(result.grossMarginPct)],
    ["純利益（1個）", yen(result.netProfit)],
    ["純利益率", pct(result.netMarginPct)],
    ["ROI（純利益÷総仕入れコスト）", pct(result.roiPct)],
    ["損益分岐点 販売価格", yen(result.breakevenPrice)],
    ["目標利益率達成価格", result.targetMarginPrice !== null ? yen(result.targetMarginPrice) : "算出不可"],
  ];
  $("metricsGrid").innerHTML = items.map(([label, value]) => `
    <div class="metric">
      <span class="metric__label">${label}</span>
      <span class="metric__value">${value}</span>
    </div>
  `).join("");

  const warnEl = $("warningList");
  warnEl.innerHTML = result.warnings.map(w => `<div class="warning-item">⚠️ ${w}</div>`).join("");
}

function renderBreakdown(result) {
  if (result.status !== "ok") return;
  const purchaseRows = [
    ["仕入れ単価（税込）", yen(result.C)],
    ["国内・海外送料", yen(result.shippingIn)],
    ["関税・輸入消費税", yen(result.customs)],
    ["検品・梱包費", yen(result.inspection)],
    ["FBA納品送料", yen(result.fbaShip)],
  ];
  $("purchaseBreakdownTable").innerHTML = purchaseRows.map(([l, v]) => `<tr><td>${l}</td><td>${v}</td></tr>`).join("")
    + `<tr class="is-total"><td>総仕入れコスト</td><td>${yen(result.purchaseCostTotal)}</td></tr>`;

  const sellingRows = [
    ["Amazon販売手数料", yen(result.referralFeeAmount)],
    ["カテゴリー成約料", yen(result.closingFee)],
    ["FBA配送代行手数料", yen(result.FBA)],
    ["月間保管手数料(按分)", yen(result.storageFee)],
    ["広告費(ACoS分)", yen(result.adAmount)],
    ["返品損失(見積り)", yen(result.returnLoss)],
    ["その他経費", yen(result.otherCost)],
  ];
  $("sellingBreakdownTable").innerHTML = sellingRows.map(([l, v]) => `<tr><td>${l}</td><td>${v}</td></tr>`).join("")
    + `<tr class="is-total"><td>販売時コスト合計</td><td>${yen(result.sellingCostTotal)}</td></tr>`;
}

function renderAssumptions(s) {
  const list = [
    "金額はすべて「1個あたり・税込」で統一して計算しています。",
    `消費税率は ${(s.taxRate * 100).toFixed(0)}% を使用しています。`,
    `返品率 ${s.returnRate}% は、返品された個体の仕入れ原価・付随費用・FBA手数料をすべて失う想定（保守的な見積もり）です。`,
    "ROIは「純利益 ÷ 総仕入れコスト（仕入単価+送料+関税+検品梱包費+FBA納品送料）」で算出しています。",
    "Amazon販売手数料率・FBA手数料はカテゴリー/サイズから自動入力される目安値です。2026年4月の手数料改定など最新情報は必ずAmazonセラーセントラルでご確認のうえ、手動で上書きしてください。",
    "市場動向・競合状況・Keepa価格推移・知的財産リスクなど、実際のマーケットデータが必要な判断はこのツールの対象外です。仕入れ可否の最終判断は別途行ってください。",
  ];
  $("assumptionsList").innerHTML = list.map(t => `<li>${t}</li>`).join("");
}

function recalcAndRender() {
  const s = readState();
  const result = compute(s);
  render(s, result);
  localStorage.setItem(LAST_STATE_KEY, JSON.stringify(s));
  updateModeUI(s);
  return { s, result };
}

function updateModeUI(s) {
  const priceField = $("purchasePrice");
  const label = $("purchasePriceLabel");
  const checkbox = $("purchaseTaxExcluded");
  if (s.mode === "reverse") {
    priceField.readOnly = true;
    checkbox.disabled = true;
    label.textContent = "自動計算された仕入れ単価（上限・税込）";
  } else {
    priceField.readOnly = false;
    checkbox.disabled = false;
    label.textContent = s.purchaseTaxExcluded ? "仕入れ単価（税抜）" : "仕入れ単価（税込）";
  }
}

/* ---------------- 履歴 ---------------- */

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function renderHistory() {
  const list = loadHistory();
  $("historyEmpty").hidden = list.length > 0;
  $("historyTable").hidden = list.length === 0;
  $("historyTableBody").innerHTML = list.slice().reverse().map(entry => `
    <tr>
      <td>${escapeHtml(entry.savedAt)}</td>
      <td>${escapeHtml(entry.productName || "（名称未設定）")}</td>
      <td>${entry.mode === "reverse" ? "仕入れ単価を計算" : "利益を計算"}</td>
      <td>${escapeHtml(entry.summary)}</td>
      <td>
        <button type="button" class="btn" data-action="load" data-id="${escapeHtml(entry.id)}">呼び出す</button>
        <button type="button" class="btn btn--danger" data-action="delete" data-id="${escapeHtml(entry.id)}">削除</button>
      </td>
    </tr>
  `).join("");
}

function summarize(result) {
  if (result.status !== "ok") return "—";
  return result.mode === "reverse"
    ? `仕入上限 ${yen(result.C)}`
    : `純利益 ${yen(result.netProfit)}（${pct(result.netMarginPct)}）`;
}

function attachHistoryEvents() {
  $("saveHistoryBtn").addEventListener("click", () => {
    const s = readState();
    const result = compute(s);
    if (result.status !== "ok") {
      alert("計算結果が確定していないため保存できません。入力内容をご確認ください。");
      return;
    }
    const list = loadHistory();
    list.push({
      id: Date.now().toString(36),
      savedAt: new Date().toLocaleString("ja-JP"),
      productName: s.productName,
      asin: s.asin,
      mode: s.mode,
      summary: summarize(result),
      snapshot: s,
    });
    saveHistory(list);
    renderHistory();
  });

  $("historyTableBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    let list = loadHistory();
    if (btn.dataset.action === "delete") {
      list = list.filter(item => item.id !== id);
      saveHistory(list);
      renderHistory();
    } else if (btn.dataset.action === "load") {
      const entry = list.find(item => item.id === id);
      if (entry) {
        writeState(entry.snapshot);
        recalcAndRender();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  });

  $("exportCsvBtn").addEventListener("click", () => {
    const list = loadHistory();
    if (list.length === 0) {
      alert("書き出せる履歴がありません。");
      return;
    }
    const header = ["保存日時", "商品名", "ASIN", "モード", "販売価格", "結果"];
    const rows = list.map(e => [
      e.savedAt, e.productName, e.asin,
      e.mode === "reverse" ? "仕入れ単価を計算" : "利益を計算",
      e.snapshot.sellPrice, e.summary,
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "仕入れ単価計算_履歴.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

/* ---------------- Amazon購入通知の取り込み ---------------- */

const CLIENT_ID_KEY = "ppcalc_googleClientId";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.file";
let googleAccessToken = null; // 現在選択中のアカウントのトークン(Gmail検索・解析・保存の対象)
let currentAccountEmail = null;
const connectedAccounts = {}; // { email: accessToken } このページを開いている間、連携済みの全アカウントを保持
let googleTokenClient = null;
let currentParsedItems = [];
let currentParsedOrderNumber = "";

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function stripHtml(html) {
  // <style>/<script>はタグ自体を消しても中身(CSSのセレクタ名やJSコード)が
  // 平文として残ってしまい、商品名候補として誤って拾われることがあるため、
  // タグと中身をまとめて除去する。
  const noStyleScript = html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
  // 注文情報のテーブル(<td>)はセルごとに商品名/数量/金額が分かれているが、
  // </td>を改行に変換しないと同じ行につながってしまい、価格の近くの行を
  // 探す商品名検出がずれてしまう(セル同士は視覚的に別の項目として区切る)。
  const withBreaks = noStyleScript.replace(/<(br|\/p|\/tr|\/td|\/th|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n");
  const noTags = withBreaks.replace(/<[^>]+>/g, " ");
  const ta = document.createElement("textarea");
  ta.innerHTML = noTags;
  return ta.value;
}

/**
 * メール内のAmazon商品リンク（/dp/XXXXXXXXXX 等）からASINを出現順に拾う。
 * 検出数が商品数とぴったり一致した時だけ、安全に1対1で割り当てる。
 */
function extractAsinsInOrder(rawInput) {
  // クリック計測用のリダイレクトURL(.../r.html?...&U=https%3A%2F%2F...%2Fdp%2FASIN)では
  // 「/」が%2Fにエンコードされているため、そのままでは/dp/に一致しない。
  const normalized = rawInput.replace(/%2F/gi, "/");
  const re = /(?:\/dp\/|\/gp\/product\/|[?&]asin=)([A-Z0-9]{10})/g;
  const found = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(normalized)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); found.push(m[1]); }
  }
  return found;
}

/**
 * 商品名は「価格に近い行」を探す推定だと、テーブルレイアウト崩れ等で
 * 誤検出しやすい。Amazonのメールでは商品名が必ず商品ページへのリンク
 * (<a>タグ)になっているため、そのリンクのテキストを直接使う方が確実。
 * クリック計測用のリダイレクトURLで飛んでいるとhref内のASINがURL
 * エンコードされていることがあるため、デコードしてから探す。
 * 戻り値: { byAsin: Map<ASIN,名前>, all: [{asin, name}] (出現順) }
 * asinが取れなくても all には残すので、呼び出し側で件数ベースの
 * フォールバック(商品が1件だけの注文など)に使える。
 */
function extractProductLinkNames(rawInput) {
  const linkRe = /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const asinRe = /(?:\/dp\/|\/gp\/product\/|[?&]asin=)([A-Z0-9]{10})/i;
  const nonProductTextRe = /^(こちら|詳細|詳細を見る|商品を見る|注文履歴|注文の詳細|配送状況|配送状況を確認|レビュー|レビューを書く|返品|再購入|画像|アカウントサービス|Amazon\.co\.jp)$/i;
  const byAsin = new Map();
  const altByAsin = new Map(); // 商品画像のalt属性(リンク文字列は省略表示でも、altには完全な商品名が入っている)
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
        const alt = stripHtml(im[1]).replace(/\s+/g, " ").trim();
        if (alt.length < 3 || nonProductTextRe.test(alt)) continue;
        if (!altByAsin.has(asin)) altByAsin.set(asin, []);
        altByAsin.get(asin).push(alt);
      }
    }

    const text = stripHtml(m[2]).replace(/\s+/g, " ").trim();
    if (text.length < 3 || nonProductTextRe.test(text)) continue;

    all.push({ asin, name: text });
    if (asin) {
      const existing = byAsin.get(asin);
      if (!existing || text.length > existing.length) byAsin.set(asin, text);
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
function extendTruncatedName(name, asin, altByAsin) {
  if (!/(\.{2,}|…)\s*$/.test(name)) return name;
  const stem = name.replace(/(\.{2,}|…)\s*$/, "").trim();
  if (!stem) return name;
  const startsWithStem = (alt) => alt.length > stem.length && alt.startsWith(stem);
  if (asin && altByAsin.has(asin)) {
    const hits = altByAsin.get(asin).filter(startsWithStem).sort((a, b) => b.length - a.length);
    if (hits.length > 0) return hits[0];
  }
  const pool = [];
  altByAsin.forEach((alts) => alts.forEach((a) => pool.push(a)));
  const unique = Array.from(new Set(pool.filter(startsWithStem)));
  return unique.length === 1 ? unique[0] : name;
}

/**
 * Amazonのメール書式は改定されうるため厳密な単一パターンには依存せず、
 * 「価格らしき行」と「数量らしき行」を近接ペアリングする緩い方式にしている。
 * 誤読の可能性を前提に、結果は必ず編集可能な形でユーザーに確認してもらう。
 */
function parseAmazonOrderEmail(rawInput) {
  // 「もう一度買う」等のおすすめ商品欄は注文内容と無関係な商品・価格・リンクを
  // 大量に含むため、そこから先(フッター含む)は元のHTMLの時点で切り詰め、
  // 本文の行ベース解析だけでなくASIN・商品リンクの抽出にも一貫して効かせる。
  // moduleId-marketingSlotは実際の注文確認メールで確認された広告枠
  // (「${hash-get display-group}のおすすめセール」等、見出し文言は一定しない)
  // で、見出し文言ではなくHTML側のモジュール名で切り詰める方が確実。
  const recommendationCutoffRe = /もう一度買う|おすすめ商品|よく一緒に購入されている商品|この商品を買った人はこんな商品も買っています|moduleId-marketingSlot/;
  const cutoffMatch = rawInput.match(recommendationCutoffRe);
  const scopedInput = cutoffMatch ? rawInput.slice(0, cutoffMatch.index) : rawInput;

  const looksHtml = /<[a-z][\s\S]*>/i.test(scopedInput);
  let text = looksHtml ? stripHtml(scopedInput) : scopedInput;
  // 注文番号等の直前にAmazonが挿入する双方向テキスト制御用の不可視文字
  // (RLM/LRMや埋め込み記号等)が、数字の直前にあると正規表現の連続一致を
  // 妨げるため、見た目に影響しないこれらの文字を除去しておく。
  text = text.replace(/[​-‏‪-‮⁦-⁩﻿]/g, "");

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  const priceRe = /[¥￥]\s?([\d,]{2,})/;
  const qtyRe = /(?:数量|個数)[:：]?\s*(\d+)|×\s?(\d+)\s*$/;
  const dividerRe = /^[-=_~･・…\s]{3,}$/;
  const nonNameRe = /^(注文|合計|小計|配送|消費税|お届け|数量|ご注文|お支払い|送信先|お届け先|発送|配達)/;
  // ¥記号の無い裸の数字(小計・ポイント等の値がそのまま1行になっているケース)が
  // 商品名として誤って拾われるのを防ぐ。商品名が数字だけになることは実質無い。
  const numericOnlyRe = /^[\d,.\s]+$/;

  const toNum = (s) => parseInt(String(s).replace(/,/g, ""), 10);

  // ラベル(例:「合計」)と金額がHTMLの表組みで別セル=別行に分かれるメールが多いため、
  // 同一行での一致をまず試し、無ければ「ラベルのみの行」の直後2行以内から値を拾う。
  // 消費された行(ラベル行・値行)のインデックスは items の価格候補から除外する。
  const consumed = new Set();

  function findLabeledAmount(inlineRe, labelOnlyRe) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(inlineRe);
      if (m) { consumed.add(i); return toNum(m[m.length - 1]); }
    }
    for (let i = 0; i < lines.length; i++) {
      if (labelOnlyRe.test(lines[i])) {
        for (let d = 1; d <= 2; d++) {
          const next = lines[i + d];
          if (next && priceRe.test(next)) {
            consumed.add(i);
            consumed.add(i + d);
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
      if (m) { consumed.add(i); return m[1]; }
    }
    for (let i = 0; i < lines.length; i++) {
      if (labelOnlyRe.test(lines[i])) {
        const next = lines[i + 1];
        if (next && valueRe.test(next)) {
          consumed.add(i);
          consumed.add(i + 1);
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
  const subtotal = findLabeledAmount(
    /商品(?:代金)?の?小計[:：]?\s*[¥￥]\s?([\d,]{2,})/,
    /^商品(?:代金)?の?小計[:：]?$/
  );
  const shipping = findLabeledAmount(
    /(配送料|お届け方法\s*\/?\s*料金|送料)[:：]?\s*[¥￥]\s?([\d,]{2,})/,
    /^(配送料|お届け方法\s*\/?\s*料金|送料)[:：]?$/
  );
  const tax = findLabeledAmount(
    /消費税(?:等)?[:：]?\s*[¥￥]\s?([\d,]{2,})/,
    /^消費税(?:等)?[:：]?$/
  );

  const priceLineIdx = [];
  const qtyLineIdx = [];

  lines.forEach((line, i) => {
    const mQty = line.match(qtyRe);
    if (mQty) qtyLineIdx.push({ i, qty: parseInt(mQty[1] || mQty[2], 10) });

    if (priceRe.test(line) && !consumed.has(i)) {
      priceLineIdx.push({ i, price: toNum(line.match(priceRe)[1]) });
    }
  });

  // 商品名は価格より前の行にあるのが基本形（名前→数量→価格の順）なので、
  // 後続行より先に手前側を探す。後続行を同格に探すと次の商品名を誤って拾う。
  const isPlausibleName = (l) => l && l.length >= 3 && !priceRe.test(l) && !qtyRe.test(l) && !nonNameRe.test(l) && !dividerRe.test(l) && !numericOnlyRe.test(l);
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
    price,
    quantity: findNearbyQty(i),
    isUnitPrice: false,
    asin: "",
  }));

  const asins = extractAsinsInOrder(scopedInput);
  if (asins.length === items.length) {
    items.forEach((item, idx) => { item.asin = asins[idx]; });
  }

  // 商品ページへのリンクの文字列が取れていれば、行の近さで推定した商品名より
  // 確実なのでそちらを優先する(テーブルレイアウトの崩れ等で誤った文字列を
  // 拾ってしまうケースへの対策)。ASINで紐付けられない場合でも、商品が
  // 1件だけの注文でリンクの候補も1件だけに絞れるなら、それを使う。
  const { byAsin: linkNamesByAsin, all: linkNameCandidates, altByAsin } = extractProductLinkNames(scopedInput);
  const uniqueLinkNames = Array.from(new Set(linkNameCandidates.map((c) => c.name)));

  // 商品数とASIN数が一致せず1対1で割り当てられなかった場合でも、商品名と同じ文字列の
  // 商品リンクがあれば、そのリンクのASINを採用できる。
  items.forEach((item) => {
    if (item.asin) return;
    const itemName = item.name.replace(/\s+/g, " ").trim();
    const hit = linkNameCandidates.find((c) => c.asin && c.name === itemName);
    if (hit) item.asin = hit.asin;
  });

  items.forEach((item) => {
    if (item.asin && linkNamesByAsin.has(item.asin)) {
      item.name = linkNamesByAsin.get(item.asin);
    } else if (items.length === 1 && uniqueLinkNames.length === 1) {
      item.name = uniqueLinkNames[0];
    }
    item.name = extendTruncatedName(item.name, item.asin, altByAsin);
  });

  // 単一商品の注文で、商品欄に表示される価格(カタログ価格)と実際の請求合計が
  // 大きく異なる場合がある(Amazonポイントを支払いに充当した注文等で、商品価格
  // 欄はポイント控除前のまま、合計だけが控除後の実際の請求額になっているため)。
  // 商品が1件だけなら曖昧さがないので、実際に支払った金額である合計を優先する。
  if (items.length === 1 && orderTotal !== null) {
    const item = items[0];
    if (Math.abs(item.price * item.quantity - orderTotal) > 1) {
      item.price = orderTotal;
      item.isUnitPrice = false;
    }
  }

  const warnings = [];
  if (items.length === 0) warnings.push("金額を検出できませんでした。メール本文の形式をご確認ください。");
  if (orderTotal === null) warnings.push("注文合計を検出できませんでした。");

  return { orderNumber, orderTotal, subtotal, shipping, tax, items, warnings };
}

function renderImportReview(parsed) {
  currentParsedItems = parsed.items;
  currentParsedOrderNumber = parsed.orderNumber || "";
  $("importReview").hidden = false;
  if (!$("importDate").value) $("importDate").value = new Date().toISOString().slice(0, 10);

  const rows = parsed.items.map((item, idx) => `
    <tr>
      <td><input type="text" data-field="name" data-idx="${idx}" value="${escapeHtml(item.name)}"></td>
      <td><input type="text" data-field="asin" data-idx="${idx}" value="${escapeHtml(item.asin || "")}" placeholder="任意"></td>
      <td><input type="number" data-field="quantity" data-idx="${idx}" value="${item.quantity}" min="1"></td>
      <td><input type="number" data-field="price" data-idx="${idx}" value="${item.price}" min="0"></td>
      <td>
        <select data-field="isUnitPrice" data-idx="${idx}">
          <option value="false">金額は合計</option>
          <option value="true">金額は単価</option>
        </select>
      </td>
      <td class="import-actions">
        <button type="button" class="btn btn--primary" data-action="import-row" data-idx="${idx}">計算へ反映</button>
        <button type="button" class="btn" data-action="save-row" data-idx="${idx}">記録に保存</button>
      </td>
    </tr>
  `).join("");

  if (parsed.items.length === 0) {
    $("importTable").innerHTML = "";
    $("importMeta").innerHTML = `
      <div class="warning-item is-error">
        このメールからは商品の金額・数量を読み取れませんでした。キャンセル通知や配送状況の更新など、
        商品情報を含まない種類のメールの可能性があります。件名に「発送」「配達」などが付いた別のメールを
        お試しいただくか、「メール本文を貼り付け」タブで直接お試しください。
      </div>`;
    return;
  }

  $("importTable").innerHTML = `
    <thead><tr><th>商品名</th><th>ASIN</th><th>数量</th><th>金額</th><th>金額の種類</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  `;

  const metaParts = [];
  if (parsed.orderNumber) metaParts.push(`注文番号: ${parsed.orderNumber}`);
  if (parsed.orderTotal !== null) metaParts.push(`注文合計: ${yen(parsed.orderTotal)}`);
  metaParts.push(...parsed.warnings.map((w) => "⚠️ " + w));
  $("importMeta").textContent = metaParts.join(" ／ ");
}

function importParsedRow(idx) {
  const item = currentParsedItems[idx];
  if (!item) return;
  const unitPrice = item.isUnitPrice ? item.price : item.price / (item.quantity || 1);

  document.querySelector('input[name="mode"][value="forward"]').checked = true;
  $("purchaseTaxExcluded").checked = false;
  $("purchasePrice").value = Math.round(unitPrice);
  if ($("productName").value.trim() === "") $("productName").value = item.name;

  recalcAndRender();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function attachImportEvents() {
  if (location.protocol === "file:") {
    $("fileProtocolWarning").hidden = false;
  }

  document.querySelectorAll(".import-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".import-tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      document.querySelectorAll(".import-panel").forEach((p) => {
        p.hidden = p.dataset.panel !== tab.dataset.tab;
      });
    });
  });

  const savedClientId = localStorage.getItem(CLIENT_ID_KEY);
  if (savedClientId) $("googleClientId").value = savedClientId;

  $("gmailConnectBtn").addEventListener("click", () => googleConnect(false));
  $("gmailReconnectBtn").addEventListener("click", () => {
    $("gmailReconnectBtn").hidden = true;
    $("gmailReconnectHint").hidden = true;
    attemptSilentReconnectAll();
  });
  $("gmailFetchBtn").addEventListener("click", gmailFetchOrders);
  $("bulkFetchBtn").addEventListener("click", runBulkFetch);
  $("openSheetBtn").addEventListener("click", async () => {
    if (!googleAccessToken) { alert("先に「Googleと連携する」を行ってください。"); return; }
    // ポップアップブロック対策として、非同期処理の前に空のタブを同期的に開いておき、
    // シートIDが分かった時点でその遷移先を差し替える。
    const win = window.open("", "_blank");
    try {
      const sheetId = await ensurePurchaseSheet(googleAccessToken, currentAccountEmail);
      if (win) win.location.href = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    } catch (e) {
      if (win) win.close();
      alert("スプレッドシートを開けませんでした: " + e.message);
    }
  });
  $("gmailDisconnectBtn").addEventListener("click", () => {
    delete connectedAccounts[currentAccountEmail];
    forgetAccount(currentAccountEmail);
    const remaining = Object.keys(connectedAccounts);
    if (remaining.length > 0) {
      currentAccountEmail = remaining[0];
      googleAccessToken = connectedAccounts[currentAccountEmail];
      renderAccountSwitcher();
      gmailFetchOrders();
    } else {
      googleAccessToken = null;
      currentAccountEmail = null;
      $("gmailConnected").hidden = true;
      $("gmailNotConnected").hidden = false;
      $("gmailMessageList").innerHTML = "";
      $("bulkHistory").innerHTML = "";
      $("gmailStatus").textContent = "連携を解除しました。";
    }
  });
  $("accountSwitcher").addEventListener("click", (e) => {
    const addBtn = e.target.closest('button[data-action="add-account"]');
    if (addBtn) { googleConnect(true); return; }
    const chip = e.target.closest('button[data-action="switch-account"]');
    if (chip) {
      currentAccountEmail = chip.dataset.email;
      googleAccessToken = connectedAccounts[currentAccountEmail];
      renderAccountSwitcher();
      gmailFetchOrders();
    }
  });

  $("parsePasteBtn").addEventListener("click", () => {
    const text = $("pasteEmailText").value;
    if (!text.trim()) { alert("メール本文を貼り付けてください。"); return; }
    renderImportReview(parseAmazonOrderEmail(text));
  });

  $("importTable").addEventListener("click", async (e) => {
    const importBtn = e.target.closest('button[data-action="import-row"]');
    if (importBtn) { importParsedRow(parseInt(importBtn.dataset.idx, 10)); return; }

    const saveBtn = e.target.closest('button[data-action="save-row"]');
    if (saveBtn) {
      if (!googleAccessToken) { alert("先に「Googleと連携する」を行ってください。"); return; }
      const idx = parseInt(saveBtn.dataset.idx, 10);
      saveBtn.disabled = true;
      try {
        await saveRowToRecord(idx);
      } catch (err) {
        alert("保存に失敗しました: " + err.message);
      } finally {
        saveBtn.disabled = false;
      }
    }
  });

  $("importTable").addEventListener("change", (e) => {
    const el = e.target.closest("[data-field]");
    if (!el) return;
    const idx = parseInt(el.dataset.idx, 10);
    const item = currentParsedItems[idx];
    if (!item) return;
    if (el.dataset.field === "isUnitPrice") item.isUnitPrice = el.value === "true";
    else if (el.dataset.field === "quantity") item.quantity = parseFloat(el.value) || 1;
    else if (el.dataset.field === "price") item.price = parseFloat(el.value) || 0;
    else if (el.dataset.field === "name") item.name = el.value;
    else if (el.dataset.field === "asin") item.asin = el.value.trim();
  });

  $("saveAllRowsBtn").addEventListener("click", saveAllRowsToRecord);

  $("gmailMessageList").addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="fetch-msg"]');
    if (!btn) return;
    gmailParseMessage(btn.dataset.id);
  });

  attachPeriodEvents();
}

function ensureGisLoaded(cb, onTimeout) {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) { cb(); return; }
  let waited = 0;
  const check = setInterval(() => {
    waited += 200;
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      clearInterval(check);
      cb();
    } else if (waited > 8000) {
      clearInterval(check);
      onTimeout && onTimeout();
    }
  }, 200);
}

async function fetchAccountEmail(token) {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || "アカウント情報の取得に失敗しました");
  return json.emailAddress;
}

function renderAccountSwitcher() {
  const emails = Object.keys(connectedAccounts);
  $("accountSwitcher").innerHTML = emails.map((email) => `
    <button type="button" class="btn account-chip${email === currentAccountEmail ? " is-active" : ""}" data-action="switch-account" data-email="${escapeHtml(email)}">${email === currentAccountEmail ? "✓ " : ""}${escapeHtml(email)}</button>
  `).join("") + `<button type="button" class="btn account-chip" data-action="add-account">+ 別のアカウントを追加</button>`;
  renderBulkHistory(currentAccountEmail);
}

/**
 * 連携済みアカウントのメールアドレス一覧(トークンそのものではない)だけを
 * ローカルに覚えておき、次回このページを開いたときに自動的な再連携(サイレント
 * トークン取得)を試みるために使う。メールアドレス自体は本人のGmail上に
 * 常に表示されている情報であり、機密情報ではない。
 */
const REMEMBERED_ACCOUNTS_KEY = "ppcalc_rememberedAccounts";
function getRememberedAccounts() {
  try { return JSON.parse(localStorage.getItem(REMEMBERED_ACCOUNTS_KEY)) || []; } catch (e) { return []; }
}
function rememberAccount(email) {
  const list = getRememberedAccounts();
  if (!list.includes(email)) {
    list.push(email);
    localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(list));
  }
}
function forgetAccount(email) {
  const list = getRememberedAccounts().filter((e) => e !== email);
  localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(list));
}

let pendingTokenResolve = null;
let pendingTokenReject = null;

/**
 * トークンクライアントは1つを使い回し、requestAccessTokenの呼び出しごとに
 * Promiseで結果を受け取れるようにする(通常のクリック連携・自動サイレント
 * 再連携のどちらからも同じ仕組みで呼べるようにするため)。1回のリクエストが
 * 完了してから次を呼ぶ限り、コールバックの取り違えは起きない。
 */
function ensureTokenClient(clientId) {
  if (googleTokenClient) return;
  googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_SCOPES,
    callback: (resp) => {
      const resolve = pendingTokenResolve, reject = pendingTokenReject;
      pendingTokenResolve = null;
      pendingTokenReject = null;
      if (!resolve) return;
      if (resp.error) reject(new Error(resp.error));
      else resolve(resp.access_token);
    },
    error_callback: (err) => {
      const reject = pendingTokenReject;
      pendingTokenResolve = null;
      pendingTokenReject = null;
      if (reject) reject(new Error((err && err.type) || "認証エラー"));
    },
  });
}

function requestToken(overrideConfig) {
  return new Promise((resolve, reject) => {
    pendingTokenResolve = resolve;
    pendingTokenReject = reject;
    googleTokenClient.requestAccessToken(overrideConfig || {});
  });
}

async function registerConnectedAccount(token, opts = {}) {
  const email = await fetchAccountEmail(token);
  connectedAccounts[email] = token;
  rememberAccount(email);
  if (!opts.keepCurrent || !currentAccountEmail) {
    googleAccessToken = token;
    currentAccountEmail = email;
  }
  return email;
}

/**
 * forceAccountPicker=true で呼ぶと、既に連携済みでもGoogleのアカウント選択
 * 画面を強制的に出す(複数アカウントを1つずつ追加していくため)。トークン
 * クライアント自体は使い回し、初回のみ生成する。
 */
function googleConnect(forceAccountPicker) {
  const clientId = $("googleClientId").value.trim();
  if (!clientId) { alert("Google OAuth クライアントIDを入力してください。上の「初回設定の手順」を参照してください。"); return; }
  localStorage.setItem(CLIENT_ID_KEY, clientId);

  $("gmailStatus").textContent = "Googleの認証画面を準備しています…";
  ensureGisLoaded(async () => {
    try {
      ensureTokenClient(clientId);
      const token = await requestToken(forceAccountPicker ? { prompt: "select_account" } : {});
      await registerConnectedAccount(token);
      $("gmailStatus").textContent = "";
      $("gmailNotConnected").hidden = true;
      $("gmailConnected").hidden = false;
      renderAccountSwitcher();
      gmailFetchOrders();
    } catch (e) {
      $("gmailStatus").textContent = "連携に失敗しました: " + e.message;
    }
  }, () => {
    $("gmailStatus").textContent = "Googleの認証ライブラリを読み込めませんでした。http/https経由でこのページを開いているかご確認ください。";
  });
}

/**
 * ページを開いた直後に、前回までに連携したことのある全アカウントへ、
 * ポップアップなしのサイレント再認証を順番に試みる。ブラウザがそのGoogle
 * アカウントにログイン済みで、かつ以前このアプリに権限を許可済みであれば
 * 無言で成功する。ログアウトされていたり権限が失効している等の場合は
 * 静かに失敗し、そのアカウントだけ手動再連携が必要な状態のままになる
 * (「+ 別のアカウントを追加」からいつでもやり直せる)。
 */
async function attemptSilentReconnectAll() {
  const clientId = $("googleClientId").value.trim();
  // 既に連携済みのアカウントへ再度ポップアップを試みるのは無駄なだけでなく、
  // 1クリックにつきブラウザが許可するポップアップは基本的に1つだけなため、
  // 未接続のアカウント(pending)だけを対象にする。
  const remembered = getRememberedAccounts();
  const pending = remembered.filter((email) => !connectedAccounts[email]);
  if (!clientId || pending.length === 0) return;

  ensureGisLoaded(async () => {
    ensureTokenClient(clientId);
    let successCount = 0;
    for (let i = 0; i < pending.length; i++) {
      $("gmailStatus").textContent = `前回連携したアカウントに自動で再接続しています…（${i + 1}/${pending.length}）`;
      try {
        const token = await requestToken({ prompt: "", hint: pending[i] });
        await registerConnectedAccount(token, { keepCurrent: successCount > 0 || Object.keys(connectedAccounts).length > 1 });
        successCount++;
      } catch (e) {
        // このアカウントはブラウザ側でログアウトされている、あるいは1クリックにつき
        // 1つまでというブラウザのポップアップ制限に阻まれて失敗することがある。
        // 複数アカウントを一度に全て自動復元することはできないため、ここでは諦めて
        // 次へ進み、残りは「+ 別のアカウントを追加」での手動選択に委ねる。
      }
    }
    if (successCount > 0) {
      $("gmailNotConnected").hidden = true;
      $("gmailConnected").hidden = false;
      renderAccountSwitcher();
      const remaining = pending.length - successCount;
      $("gmailStatus").textContent = remaining > 0
        ? `${successCount}/${pending.length} アカウントに自動再接続しました。ブラウザの制限で1クリックでは全アカウントを復元できないため、残り${remaining}件は上の「+ 別のアカウントを追加」から選び直してください（パスワード再入力は不要です）。`
        : `${successCount}/${pending.length} アカウントに自動再接続しました。`;
      gmailFetchOrders();
    } else {
      $("gmailStatus").textContent = "";
      // クリックを伴わない自動実行はブラウザのポップアップブロックに阻まれやすいため、
      // ユーザー操作(クリック)付きで同じ処理を再試行できるボタンを表示する。
      $("gmailReconnectBtn").hidden = false;
      $("gmailReconnectHint").hidden = false;
    }
  }, () => { /* GISが読み込めない場合は自動再接続を諦め、手動連携ボタンに委ねる */ });
}

/**
 * Gmail/Sheets/Drive共通のfetchラッパー。アクセストークンは1時間程度で
 * 失効するため、401時は状態をクリアして再連携を促す（cryptic なエラーで
 * 止まらせない）。tokenOverrideを渡すと、現在選択中のアカウント以外
 * (期間集計での複数アカウント横断読み込みなど)のトークンで呼び出せる。
 * 省略時は現在選択中のアカウントのトークンを使う。
 */
async function googleFetch(url, options = {}, tokenOverride) {
  const token = tokenOverride || googleAccessToken;
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    if (!tokenOverride) {
      googleAccessToken = null;
      $("gmailConnected").hidden = true;
      $("gmailNotConnected").hidden = false;
      $("gmailStatus").textContent = "連携の有効期限が切れました。もう一度「Googleと連携する」を押してください。";
    }
    throw new Error("認証の有効期限が切れました。再連携してください。");
  }
  return res;
}

/**
 * 件名から「発送済み/配達済み(=確定した購入である可能性が高い)」
 * 「キャンセル/返品(=購入が成立していない可能性が高い)」「その他(注文確認等、
 * この後キャンセルされる可能性がある)」を推定し、安全なものを上に並べる。
 * あくまで参考表示であり、最終判断はユーザーに委ねる。
 */
function classifySubject(subject) {
  // 「発送できるように情報を更新してください」等、支払い失敗・保留系の件名は
  // "発送"という文字を含むため、先に判定しないと後段の安全判定に誤って一致してしまう。
  if (/キャンセル|取消|返品|返金|否認|支払いに失敗|決済に失敗|支払い方法の更新/.test(subject)) {
    return { tag: "warn", label: "⚠ キャンセル/支払い問題の可能性" };
  }
  if (/発送(済み|しました|されました|完了)|出荷(済み|しました|完了)|配送中|配達中|配達(済み|完了)|お届け(済み|完了)|届きました|shipped|delivered/i.test(subject)) {
    return { tag: "safe", label: "✓ 発送/配達済み" };
  }
  return { tag: "neutral", label: "注文確認など" };
}

/**
 * messages.list はID/threadIdしか返さないため、件名・日付を別途
 * metadata取得で補う（本文は取らないので軽量）。これが無いと、
 * ユーザーは「どのメールが注文確認か」を区別できずボタンを選べない。
 */
async function gmailFetchOrders() {
  const query = $("gmailQuery").value.trim();
  $("gmailMessageList").textContent = "検索中…";
  try {
    const listRes = await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(query)}`);
    const listJson = await listRes.json();
    if (!listRes.ok) throw new Error((listJson.error && listJson.error.message) || "検索に失敗しました");
    const messages = listJson.messages || [];
    if (messages.length === 0) {
      $("gmailMessageList").textContent = "該当するメールが見つかりませんでした。検索クエリを見直してください。";
      return;
    }

    $("gmailMessageList").textContent = `${messages.length}件見つかりました。件名を読み込み中…`;

    const details = await Promise.all(messages.map(async (m) => {
      try {
        const res = await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`);
        const json = await res.json();
        const headers = (json.payload && json.payload.headers) || [];
        const subject = (headers.find((h) => h.name === "Subject") || {}).value || "(件名なし)";
        const dateStr = (headers.find((h) => h.name === "Date") || {}).value || "";
        const date = dateStr ? new Date(dateStr) : null;
        return {
          id: m.id, subject,
          date: date && !isNaN(date) ? date.toLocaleString("ja-JP") : dateStr,
          dateMs: date && !isNaN(date) ? date.getTime() : 0,
          ...classifySubject(subject),
        };
      } catch (e) {
        return { id: m.id, subject: "(件名の取得に失敗しました)", date: "", dateMs: 0, tag: "neutral", label: "" };
      }
    }));

    const tagOrder = { safe: 0, neutral: 1, warn: 2 };
    details.sort((a, b) => (tagOrder[a.tag] - tagOrder[b.tag]) || (b.dateMs - a.dateMs));

    $("gmailMessageList").innerHTML = details.map((d) => `
      <div class="gmail-msg-row">
        <button type="button" class="btn" data-action="fetch-msg" data-id="${escapeHtml(d.id)}">このメールを解析</button>
        <span class="gmail-msg-subject">
          ${d.label ? `<span class="gmail-msg-badge gmail-msg-badge--${d.tag}">${escapeHtml(d.label)}</span> ` : ""}${escapeHtml(d.subject)}<br><small>${escapeHtml(d.date)}</small>
        </span>
      </div>
    `).join("");
  } catch (e) {
    $("gmailMessageList").textContent = "エラー: " + e.message;
  }
}

function b64urlDecodeUtf8(data) {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Amazonの通知メールは「装飾されたHTML版」に商品情報が入っている一方、
 * 同梱される「シンプルなテキスト版」は署名・規約リンクなどの定型文だけで
 * 商品情報を含まないことが多い。plainを優先すると読み取れなくなるため、
 * HTML版があれば常にそちらを優先する。
 */
function extractBodyText(payload) {
  let plain = null;
  let html = null;
  const walk = (part) => {
    if (!part) return;
    if (part.mimeType === "text/plain" && part.body && part.body.data) plain = plain || b64urlDecodeUtf8(part.body.data);
    if (part.mimeType === "text/html" && part.body && part.body.data) html = html || b64urlDecodeUtf8(part.body.data);
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return html || plain || "";
}

async function gmailParseMessage(id) {
  try {
    const res = await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`);
    const json = await res.json();
    if (!res.ok) throw new Error((json.error && json.error.message) || "取得エラー");
    const text = extractBodyText(json.payload);
    if (json.internalDate) {
      $("importDate").value = new Date(parseInt(json.internalDate, 10)).toISOString().slice(0, 10);
    }
    renderImportReview(parseAmazonOrderEmail(text));
    document.querySelector(".import-card").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    alert("メールの取得に失敗しました: " + e.message);
  }
}

/* ---------------- 仕入れ記録（Googleスプレッドシートに保存・端末間共有） ---------------- */

const SHEET_ID_KEY = "ppcalc_sheetId";
const SHEET_TITLE = "仕入れ単価計算ツール_仕入れ記録";
const SHEET_TAB = "仕入れ記録";
const SHEET_HEADER = ["日付", "商品名", "ASIN", "数量", "単価", "金額", "取得元", "注文番号"];

const cachedRecordsByEmail = {}; // { email: records[] } アカウントごとに別のスプレッドシートを持つため
let currentPeriodGroups = [];

/**
 * 専用スプレッドシートのIDをアカウント(email)ごとにローカルキャッシュし、
 * 次回以降は検索を省略する。各Googleアカウントは自分のDrive内のファイルしか
 * 見えない(drive.fileスコープ)ため、スプレッドシートもアカウントごとに別々になる。
 * キャッシュが無効（削除された等）な場合は名前検索→無ければ新規作成、の順に
 * フォールバックする。
 */
async function ensurePurchaseSheet(token, email) {
  const cacheKey = SHEET_ID_KEY + "_" + email;
  let sheetId = localStorage.getItem(cacheKey);
  if (sheetId) {
    const check = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=spreadsheetId`, {}, token);
    if (check.ok) return sheetId;
    localStorage.removeItem(cacheKey);
  }

  const q = encodeURIComponent(`name='${SHEET_TITLE}' and trashed=false`);
  const searchRes = await googleFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {}, token);
  const searchJson = await searchRes.json();
  if (searchRes.ok && searchJson.files && searchJson.files.length > 0) {
    sheetId = searchJson.files[0].id;
    localStorage.setItem(cacheKey, sheetId);
    return sheetId;
  }

  const createRes = await googleFetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: SHEET_TITLE },
      sheets: [{ properties: { title: SHEET_TAB } }],
    }),
  }, token);
  const createJson = await createRes.json();
  if (!createRes.ok) throw new Error((createJson.error && createJson.error.message) || "スプレッドシートの作成に失敗しました");
  sheetId = createJson.spreadsheetId;

  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET_TAB + "!A1")}?valueInputOption=RAW`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values: [SHEET_HEADER] }),
  }, token);

  localStorage.setItem(cacheKey, sheetId);
  return sheetId;
}

async function appendPurchaseRecord(record, token, email) {
  const sheetId = await ensurePurchaseSheet(token, email);
  const row = [record.date, record.name, record.asin || "", record.quantity, record.unitPrice, record.amount, record.source, record.orderNumber || ""];
  const res = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET_TAB + "!A:H")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] }),
  }, token);
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || "保存に失敗しました");
  delete cachedRecordsByEmail[email];
}

/* ---------------- 一括取得・保存 ---------------- */

const BULK_MAX_MESSAGES = 200; // 1回の実行での上限(API負荷・実行時間の暴走防止)
const BULK_BATCH_SIZE = 8; // 同時に処理するメール件数
const BULK_PROCESSED_IDS_KEY = "ppcalc_bulkProcessedIds";
const BULK_RUN_HISTORY_KEY = "ppcalc_bulkRunHistory";
const BULK_HISTORY_LIMIT = 10;

function getBulkProcessedIds(email) {
  try { return JSON.parse(localStorage.getItem(BULK_PROCESSED_IDS_KEY + "_" + email)) || []; } catch (e) { return []; }
}
function addBulkProcessedIds(email, ids) {
  const set = new Set(getBulkProcessedIds(email));
  ids.forEach((id) => set.add(id));
  localStorage.setItem(BULK_PROCESSED_IDS_KEY + "_" + email, JSON.stringify(Array.from(set)));
}

function getBulkRunHistory(email) {
  try { return JSON.parse(localStorage.getItem(BULK_RUN_HISTORY_KEY + "_" + email)) || []; } catch (e) { return []; }
}
function addBulkRunHistory(email, entry) {
  const list = getBulkRunHistory(email);
  list.unshift(entry);
  localStorage.setItem(BULK_RUN_HISTORY_KEY + "_" + email, JSON.stringify(list.slice(0, BULK_HISTORY_LIMIT)));
}

function renderBulkHistory(email) {
  const el = $("bulkHistory");
  if (!el) return;
  const list = email ? getBulkRunHistory(email) : [];
  if (list.length === 0) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="table-scroll">
      <table class="record-breakdown-table bulk-history-table" style="margin-top:10px;">
        <thead><tr><th>実行日時</th><th>対象期間</th><th>新規確認</th><th>保存</th><th>スキップ</th></tr></thead>
        <tbody>${list.map((h) => `
          <tr>
            <td>${new Date(h.ranAt).toLocaleString("ja-JP")}</td>
            <td>${h.fromDate && h.toDate ? `${h.fromDate} 〜 ${h.toDate}` : "（該当なし）"}</td>
            <td>${h.newMessages}件</td>
            <td>${h.savedItems}件</td>
            <td>${h.skipped}件</td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

/**
 * Gmailのmessages.listはmaxResults=100/回が上限のため、nextPageTokenで
 * ページングしてBULK_MAX_MESSAGES件まで集める。
 */
async function listAllMessageIds(query, token, maxTotal) {
  const ids = [];
  let pageToken = "";
  do {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${encodeURIComponent(query)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await googleFetch(url, {}, token);
    const json = await res.json();
    if (!res.ok) throw new Error((json.error && json.error.message) || "検索に失敗しました");
    ids.push(...(json.messages || []).map((m) => m.id));
    pageToken = json.nextPageToken || "";
  } while (pageToken && ids.length < maxTotal);
  return ids.slice(0, maxTotal);
}

/**
 * Amazonのメールは「価格=その行の合計」と「価格=単価(数量は別記載)」の
 * どちらの書式もあり、一括取得では人が目で確認して選べないため、
 * 注文合計(parseAmazonOrderEmailが検出したorderTotal)との整合性から
 * 推定する。価格×数量の方が注文合計に近ければ、価格は単価とみなす。
 * 判断材料がない場合は、従来通り保守的に「価格=合計」のままとする。
 */
function inferIsUnitPrice(item, orderTotal) {
  if (item.quantity <= 1 || orderTotal === null) return false;
  const diffAsTotal = Math.abs(item.price - orderTotal);
  const diffAsUnit = Math.abs(item.price * item.quantity - orderTotal);
  return diffAsUnit < diffAsTotal;
}

/**
 * 1件のメールを取得・分類・解析するだけで、保存はしない(保存は呼び出し元が
 * 複数メールをまとめて見てから行う。理由はfetchAndParseMessagesForBulkの
 * コメントを参照)。件名が「キャンセル/支払い問題の可能性」に分類される
 * ものは、実際の購入が成立していない可能性が高いため対象から除く。
 */
async function fetchAndParseMessageForBulk(id, token) {
  const res = await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`, {}, token);
  const json = await res.json();
  if (!res.ok) return { id, skipped: true };

  const headers = (json.payload && json.payload.headers) || [];
  const subject = (headers.find((h) => h.name === "Subject") || {}).value || "";
  const from = (headers.find((h) => h.name === "From") || {}).value || "";
  const dateMs = json.internalDate ? parseInt(json.internalDate, 10) : null;
  const dateStr = dateMs ? new Date(dateMs).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

  // 「marketplace-messages@」は出品者への評価依頼メール等で、注文内容や金額を
  // 含まない(=誤って無関係な数字を商品情報として拾ってしまう原因になりうる)
  // ため、そもそも解析の対象から外す。
  if (/marketplace-messages@/i.test(from)) return { id, skipped: true, dateMs };
  const classification = classifySubject(subject);
  if (classification.tag === "warn") {
    // キャンセル/返金等のメール自体から商品は保存しないが、同じ注文番号の
    // 他のメール(注文確認・発送済み等)が先に処理されて保存されてしまわない
    // よう、注文番号だけは抽出して呼び出し元に伝える(pickBestBulkCandidates参照)。
    const cancelledOrderNumber = parseAmazonOrderEmail(extractBodyText(json.payload)).orderNumber;
    return { id, skipped: true, dateMs, cancelledOrderNumber };
  }

  const text = extractBodyText(json.payload);
  const parsed = parseAmazonOrderEmail(text);
  if (parsed.items.length === 0) return { id, skipped: true, dateMs };

  return { id, skipped: false, dateMs, dateStr, classification: classification.tag, parsed };
}

/**
 * 同じ注文について「ご注文の確認」等の注文確認メールと、「発送済み」
 * 「配達中」等の配送状況メールの両方が届くことがあるが、配送状況メールは
 * Amazonポイントやクーポンによる値引きが反映される前の金額(カタログ価格)を
 * そのまま表示していることがある一方、注文確認メールは実際に請求された
 * 金額を表示している。そのため同じ注文番号+商品について複数のメールが
 * 候補にある場合は、配送状況メール(safe)より注文確認メール(neutral)を
 * 優先して採用する(どちらも配送状況メールの場合は、どちらでも表示される
 * 金額に通常差はないため、先に見つかった方でよい)。
 *
 * また、同じ注文番号について「キャンセルされました」等のメール(warn判定、
 * cancelledOrderNumberとして渡される)が1通でもあれば、その注文番号は
 * 注文確認・発送済み等の他のメールがどれだけあっても一切採用しない
 * (実際には成立しなかった注文を仕入れとして記録してしまうのを防ぐ)。
 */
function pickBestBulkCandidates(results) {
  const cancelledOrderNumbers = new Set(
    results.filter((r) => r.cancelledOrderNumber).map((r) => r.cancelledOrderNumber)
  );

  const bestByKey = new Map(); // key -> { item, parsed, dateStr, priority }
  const noKeyRows = []; // 注文番号が無く重複判定できないものはそのまま採用する

  results.forEach((r) => {
    if (r.skipped || !r.parsed) return;
    if (r.parsed.orderNumber && cancelledOrderNumbers.has(r.parsed.orderNumber)) return;
    const priority = r.classification === "safe" ? 1 : 2; // neutral(注文確認)を優先
    r.parsed.items.forEach((item) => {
      if (!r.parsed.orderNumber) { noKeyRows.push({ item, parsed: r.parsed, dateStr: r.dateStr }); return; }
      const key = r.parsed.orderNumber + "|" + (item.asin || item.name);
      const existing = bestByKey.get(key);
      if (!existing || priority > existing.priority) {
        bestByKey.set(key, { item, parsed: r.parsed, dateStr: r.dateStr, priority });
      }
    });
  });

  return { byKey: bestByKey, noKeyRows, cancelledOrderNumbers };
}

/**
 * 検索条件に一致する全メールを取得し、未処理のものだけをまとめて解析・保存する。
 * どのメールを処理済みとしたかはアカウントごとにローカルへ記録し、次回以降は
 * 同じメールを再取得・重複保存しないようにする。
 */
function calcRecordAmount(item, parsed) {
  const isUnitPrice = inferIsUnitPrice(item, parsed.orderTotal);
  return isUnitPrice ? item.price * item.quantity : item.price;
}

/**
 * 商品名の照合用の正規化(全角半角の統一・空白の圧縮・末尾の省略記号の除去・小文字化)。
 * メール由来の名前は途中で「...」「…」と省略されていることがあるため、省略記号を
 * 除いた先頭部分どうしの前方一致で同じ商品かを判定する。
 */
function normalizeNameForMatch(name) {
  return String(name || "").normalize("NFKC").replace(/\s+/g, " ").trim().replace(/\.{2,}$/, "").trim().toLowerCase();
}

/**
 * 既存の記録行(rec)が、同じ注文の同じ商品(item)かどうか。ASINが両方あればASINの一致で、
 * どちらかが無ければ名前(省略表示を考慮した前方一致)で判定する。
 */
function isSameOrderItem(rec, orderNumber, item) {
  if (!rec.orderNumber || rec.orderNumber !== orderNumber) return false;
  if (rec.asin && item.asin) return rec.asin === item.asin;
  const a = normalizeNameForMatch(rec.name);
  const b = normalizeNameForMatch(item.name);
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
function findMatchingRecord(records, orderNumber, item, claimedRows, amount) {
  if (!orderNumber) return { record: null, ambiguous: false };
  const matches = records.filter((r) => !claimedRows.has(r.rowNumber) && isSameOrderItem(r, orderNumber, item));
  if (matches.length <= 1) return { record: matches[0] || null, ambiguous: false };
  const narrowed = matches.filter((r) => r.quantity === item.quantity && Math.abs(r.amount - amount) < 1);
  if (narrowed.length === 1) return { record: narrowed[0], ambiguous: false };
  return { record: null, ambiguous: true };
}

/**
 * 既存の行に足りない情報(ASIN、省略されていた商品名の続き)を今回の解析結果で補う。
 * 補うべき変更が無ければnullを返す。
 */
function buildRecordBackfill(rec, item) {
  const asin = rec.asin || item.asin || "";
  let name = rec.name;
  if (/(\.{2,}|…)\s*$/.test(rec.name) && item.name.length > rec.name.length) {
    const a = normalizeNameForMatch(rec.name);
    if (a && normalizeNameForMatch(item.name).indexOf(a) === 0) name = item.name;
  }
  if (asin === (rec.asin || "") && name === rec.name) return null;
  return { name, asin };
}

/** 記録のB列(商品名)とC列(ASIN)だけを、行番号を指定してまとめて更新する。 */
async function updatePurchaseRecordFields(updates, token, email) {
  if (updates.length === 0) return;
  const sheetId = await ensurePurchaseSheet(token, email);
  const res = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: updates.map((u) => ({ range: `${SHEET_TAB}!B${u.rowNumber}:C${u.rowNumber}`, values: [[u.name, u.asin]] })),
    }),
  }, token);
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || "記録の更新に失敗しました");
  delete cachedRecordsByEmail[email];
}

async function saveBulkCandidate(item, parsed, dateStr, token, email) {
  const isUnitPrice = inferIsUnitPrice(item, parsed.orderTotal);
  const unitPrice = isUnitPrice ? item.price : item.price / (item.quantity || 1);
  const amount = isUnitPrice ? item.price * item.quantity : item.price;
  await appendPurchaseRecord({
    date: dateStr,
    name: item.name,
    asin: item.asin || "",
    quantity: item.quantity,
    unitPrice,
    amount,
    source: "bulk",
    orderNumber: parsed.orderNumber || "",
  }, token, email);
}

async function runBulkFetch() {
  if (!googleAccessToken || !currentAccountEmail) { alert("先に「Googleと連携する」を行ってください。"); return; }
  const token = googleAccessToken;
  const email = currentAccountEmail;
  const query = $("gmailQuery").value.trim();

  $("bulkFetchBtn").disabled = true;
  $("bulkStatus").textContent = "検索中…";
  try {
    const allIds = await listAllMessageIds(query, token, BULK_MAX_MESSAGES);
    const processedBefore = new Set(getBulkProcessedIds(email));
    const newIds = allIds.filter((id) => !processedBefore.has(id));

    if (newIds.length === 0) {
      $("bulkStatus").textContent = `検索該当 ${allIds.length}件、うち新規は0件でした（すべて処理済みです）。`;
      addBulkRunHistory(email, { ranAt: new Date().toISOString(), newMessages: 0, savedItems: 0, skipped: 0, fromDate: null, toDate: null });
      renderBulkHistory(email);
      return;
    }

    // 同じ注文番号の商品が既に記録済みなら、別のメール(発送済み/配達中等)経由
    // でも二重保存しないよう、保存済みの「注文番号+商品」の組をあらかじめ集めておく。
    const existingRecords = await fetchPurchaseRecords(token, email, true);
    const savedOrderKeys = new Set(
      existingRecords.filter((r) => r.orderNumber).map((r) => r.orderNumber + "|" + (r.asin || r.name))
    );

    let skippedCount = 0, doneCount = 0;
    let minDateMs = null, maxDateMs = null;
    const processedIds = [];
    const fetchResults = [];

    for (let i = 0; i < newIds.length; i += BULK_BATCH_SIZE) {
      const batch = newIds.slice(i, i + BULK_BATCH_SIZE);
      $("bulkStatus").textContent = `取得中… ${doneCount}/${newIds.length}件`;
      const results = await Promise.all(batch.map((id) =>
        fetchAndParseMessageForBulk(id, token).catch(() => ({ id, skipped: true }))
      ));
      results.forEach((r) => {
        doneCount++;
        processedIds.push(r.id);
        if (r.dateMs) {
          if (minDateMs === null || r.dateMs < minDateMs) minDateMs = r.dateMs;
          if (maxDateMs === null || r.dateMs > maxDateMs) maxDateMs = r.dateMs;
        }
        if (r.skipped) skippedCount++;
        fetchResults.push(r);
      });
    }

    // 同じ注文番号+商品について複数のメールが候補にある場合、注文確認メールを
    // 優先して1件だけ保存する(pickBestBulkCandidatesのコメントを参照)。
    const { byKey, noKeyRows, cancelledOrderNumbers } = pickBestBulkCandidates(fetchResults);
    let savedItems = 0;
    let backfilledCount = 0;
    const claimedRows = new Set();
    const rowUpdates = [];
    $("bulkStatus").textContent = "保存中…";
    for (const [key, cand] of byKey) {
      if (savedOrderKeys.has(key)) continue;
      savedOrderKeys.add(key);
      // 以前の保存分はASINが空で名前が途中で切れていることがあり、キーが一致しない。
      // 同じ注文の同じ商品が保存済みなら、二重に保存せず足りない情報だけを補う。
      const match = findMatchingRecord(existingRecords, cand.parsed.orderNumber, cand.item, claimedRows, calcRecordAmount(cand.item, cand.parsed));
      if (match.ambiguous) continue;
      if (match.record) {
        claimedRows.add(match.record.rowNumber);
        const fields = buildRecordBackfill(match.record, cand.item);
        if (fields) rowUpdates.push({ rowNumber: match.record.rowNumber, ...fields });
        continue;
      }
      await saveBulkCandidate(cand.item, cand.parsed, cand.dateStr, token, email);
      savedItems++;
    }
    if (rowUpdates.length > 0) {
      await updatePurchaseRecordFields(rowUpdates, token, email);
      backfilledCount = rowUpdates.length;
    }
    for (const cand of noKeyRows) {
      await saveBulkCandidate(cand.item, cand.parsed, cand.dateStr, token, email);
      savedItems++;
    }

    // キャンセルメールが見つかった注文番号について、過去の実行で既に
    // 保存されてしまっている記録があれば、まとめて削除する(今回のメールだけ
    // でなく、以前のメールから既に保存済みのケースも遡って正しておくため)。
    let removedForCancellation = 0;
    if (cancelledOrderNumbers.size > 0) {
      const toRemove = existingRecords.filter((r) => r.orderNumber && cancelledOrderNumbers.has(r.orderNumber));
      if (toRemove.length > 0) {
        await deletePurchaseRecords(toRemove);
        removedForCancellation = toRemove.length;
      }
    }

    addBulkProcessedIds(email, processedIds);
    delete cachedRecordsByEmail[email];

    const fmt = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : null);
    addBulkRunHistory(email, {
      ranAt: new Date().toISOString(),
      newMessages: newIds.length,
      savedItems, skipped: skippedCount,
      fromDate: fmt(minDateMs), toDate: fmt(maxDateMs),
    });

    $("bulkStatus").textContent = `完了: 新規${newIds.length}件を確認し、${savedItems}件の商品を記録に保存しました（${skippedCount}件はキャンセル等のためスキップ）。`
      + (backfilledCount > 0 ? ` 既存の記録${backfilledCount}件のASIN・商品名を補完しました。` : "")
      + (removedForCancellation > 0 ? ` キャンセル確認により既存の記録${removedForCancellation}件を削除しました。` : "");
    renderBulkHistory(email);
  } catch (e) {
    $("bulkStatus").textContent = "エラー: " + e.message;
  } finally {
    $("bulkFetchBtn").disabled = false;
  }
}

/**
 * 行の物理削除(deleteDimension)には、スプレッドシートID文字列ではなく
 * シート自体の内部的な数値ID(gid)が必要なため別途取得する。
 */
async function getSheetGid(spreadsheetId, token) {
  const res = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {}, token);
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || "シート情報の取得に失敗しました");
  const sheets = json.sheets || [];
  const target = sheets.find((s) => s.properties.title === SHEET_TAB) || sheets[0];
  if (!target) throw new Error("シートが見つかりませんでした");
  return target.properties.sheetId;
}

/**
 * 指定した記録(rowNumberで特定した1行)をスプレッドシートから完全に削除する。
 * 行を消すと後続行が1つずつ上に詰まるため、呼び出し側は削除後に必ず
 * fetchPurchaseRecordsをforceRefreshで呼び直し、古いrowNumberを使い回さないこと。
 */
async function deletePurchaseRecord(record) {
  const token = connectedAccounts[record.email];
  if (!token) throw new Error(`${record.email} は連携済みではありません`);
  const spreadsheetId = await ensurePurchaseSheet(token, record.email);
  const gid = await getSheetGid(spreadsheetId, token);
  const res = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: { sheetId: gid, dimension: "ROWS", startIndex: record.rowNumber - 1, endIndex: record.rowNumber },
        },
      }],
    }),
  }, token);
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || "削除に失敗しました");
  delete cachedRecordsByEmail[record.email];
}

/**
 * 複数の記録をまとめて削除する。同じアカウント(スプレッドシート)内の
 * 複数行を1回のbatchUpdateで削除する場合、行番号が大きい方から先に
 * 削除リクエストを並べる必要がある(先に手前の行を消すと、後続行の
 * 番号がずれて後のリクエストが別の行を消してしまうため)。
 */
async function deletePurchaseRecords(records) {
  const byEmail = new Map();
  records.forEach((r) => {
    if (!byEmail.has(r.email)) byEmail.set(r.email, []);
    byEmail.get(r.email).push(r);
  });

  for (const [email, group] of byEmail) {
    const token = connectedAccounts[email];
    if (!token) throw new Error(`${email} は連携済みではありません`);
    const spreadsheetId = await ensurePurchaseSheet(token, email);
    const gid = await getSheetGid(spreadsheetId, token);
    const sorted = [...group].sort((a, b) => b.rowNumber - a.rowNumber);
    const requests = sorted.map((r) => ({
      deleteDimension: {
        range: { sheetId: gid, dimension: "ROWS", startIndex: r.rowNumber - 1, endIndex: r.rowNumber },
      },
    }));
    const res = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    }, token);
    const json = await res.json();
    if (!res.ok) throw new Error((json.error && json.error.message) || "削除に失敗しました");
    delete cachedRecordsByEmail[email];
  }
}

/**
 * 注文番号+商品(ASIN優先、無ければ商品名)が同じ記録が2件以上あるものを
 * 重複候補としてグルーピングする。同一注文について「発送済み」
 * 「配達中」等、複数のメールから別々に保存されてしまったケースを
 * 検出するためのもの。注文番号が無い記録は判定材料がないため対象外。
 */
function findDuplicateRecords(records) {
  const groups = new Map();
  records.forEach((r) => {
    if (!r.orderNumber) return;
    const key = r.orderNumber + "|" + (r.asin || r.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  return Array.from(groups.values()).filter((g) => g.length > 1);
}

async function fetchPurchaseRecords(token, email, forceRefresh) {
  if (cachedRecordsByEmail[email] && !forceRefresh) return cachedRecordsByEmail[email];
  const sheetId = await ensurePurchaseSheet(token, email);
  const res = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET_TAB + "!A2:H100000")}`, {}, token);
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || "読み込みに失敗しました");
  const rows = json.values || [];
  const records = rows
    .map((r, idx) => ({
      date: r[0] || "",
      name: r[1] || "",
      asin: r[2] || "",
      quantity: parseFloat(r[3]) || 0,
      unitPrice: parseFloat(r[4]) || 0,
      amount: parseFloat(r[5]) || 0,
      source: r[6] || "",
      orderNumber: r[7] || "",
      email, // どのアカウントのスプレッドシートの記録かを覚えておき、削除時にトークンを引けるようにする
      rowNumber: idx + 2, // シート上の実際の行番号(A2から始まるため+2)。削除(行の物理削除)に必要。
    }))
    .filter((r) => r.date);
  cachedRecordsByEmail[email] = records;
  return records;
}

/**
 * 期間集計はこの時点で連携済みの全アカウントを横断して行うため、各アカウントの
 * トークンで、そのアカウント自身のスプレッドシートを個別に読みに行って合算する。
 */
async function fetchAllAccountsPurchaseRecords(forceRefresh) {
  const emails = Object.keys(connectedAccounts);
  const allRecords = [];
  for (const email of emails) {
    const records = await fetchPurchaseRecords(connectedAccounts[email], email, forceRefresh);
    allRecords.push(...records);
  }
  return allRecords;
}

async function saveRowToRecord(idx, opts = {}) {
  const item = currentParsedItems[idx];
  if (!item) return;
  const unitPrice = item.isUnitPrice ? item.price : item.price / (item.quantity || 1);
  const amount = item.isUnitPrice ? item.price * item.quantity : item.price;
  await appendPurchaseRecord({
    date: $("importDate").value || new Date().toISOString().slice(0, 10),
    name: item.name,
    asin: item.asin || "",
    quantity: item.quantity,
    unitPrice,
    amount,
    source: "import",
    orderNumber: currentParsedOrderNumber,
  }, googleAccessToken, currentAccountEmail);
  if (!opts.silent) alert(`「${item.name}」を仕入れ記録に保存しました。（${currentAccountEmail}）`);
}

async function saveAllRowsToRecord() {
  if (!googleAccessToken) { alert("先に「Googleと連携する」を行ってください。"); return; }
  if (currentParsedItems.length === 0) { alert("保存できる読み取り結果がありません。"); return; }
  try {
    for (let i = 0; i < currentParsedItems.length; i++) {
      await saveRowToRecord(i, { silent: true });
    }
    alert(`${currentParsedItems.length}件を仕入れ記録に保存しました。（${currentAccountEmail}）`);
  } catch (e) {
    alert("保存中にエラーが発生しました: " + e.message);
  }
}

/**
 * ASINが取れていればASIN単位、無ければ商品名単位でグルーピングし、
 * 期間内の「合計金額 ÷ 合計数量」＝加重平均単価を商品ごとに算出する。
 * 期間を指定しなければ全件（＝通算の仕入れ単価）になる。
 */
/**
 * 商品マスタ: Amazonのメールは商品名が途中で省略されることがあり、
 * 同じ商品でも集計行が分かれてしまうことがある。「このキーワードを
 * 含む商品名は、この正式名称の商品として扱う」という対応表を登録して
 * おけると、表記ゆれを吸収して1つの集計行にまとめられる。
 * この端末のブラウザにのみ保存し、スプレッドシート側は変更しない。
 */
const PRODUCT_MASTER_KEY = "ppcalc_productMaster";
function getProductMaster() {
  try { return JSON.parse(localStorage.getItem(PRODUCT_MASTER_KEY)) || []; } catch (e) { return []; }
}
function saveProductMaster(list) {
  localStorage.setItem(PRODUCT_MASTER_KEY, JSON.stringify(list));
}
function addProductMasterEntry(canonical, keyword) {
  const list = getProductMaster();
  list.push({ canonical, keyword });
  saveProductMaster(list);
}
function removeProductMasterEntry(idx) {
  const list = getProductMaster();
  list.splice(idx, 1);
  saveProductMaster(list);
}
/**
 * 商品名(省略されている可能性がある)が、マスタに登録したキーワードを
 * 含んでいれば、そのマスタの正式名称を返す。登録が複数ヒットする場合は
 * 先に登録した方を優先する。一致しなければnull。
 */
function matchProductMaster(name) {
  const master = getProductMaster();
  for (const entry of master) {
    if (entry.keyword && name.includes(entry.keyword)) return entry.canonical;
  }
  return null;
}

function renderProductMaster() {
  const list = getProductMaster();
  const el = $("masterList");
  if (list.length === 0) { el.innerHTML = `<p class="hint">登録されている商品マスタはまだありません。</p>`; return; }
  el.innerHTML = `
    <table class="record-breakdown-table">
      <thead><tr><th>正式名称</th><th>キーワード</th><th></th></tr></thead>
      <tbody>${list.map((entry, idx) => `
        <tr>
          <td>${escapeHtml(entry.canonical)}</td>
          <td>${escapeHtml(entry.keyword || "")}${entry.asins && entry.asins.length ? `<br><small>ASIN: ${escapeHtml(entry.asins.join(", "))}</small>` : ""}</td>
          <td><button type="button" class="btn btn--danger" data-action="delete-master" data-idx="${idx}">削除</button></td>
        </tr>
      `).join("")}</tbody>
    </table>
  `;
}

function aggregateByPeriod(records, fromStr, toStr) {
  const from = fromStr ? new Date(fromStr + "T00:00:00") : null;
  const to = toStr ? new Date(toStr + "T23:59:59") : null;

  const filtered = records.filter((r) => {
    const d = new Date(r.date);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const groups = new Map();
  filtered.forEach((r) => {
    const masterName = matchProductMaster(r.name);
    const key = masterName || r.asin || r.name;
    if (!groups.has(key)) groups.set(key, { name: masterName || r.name, asin: r.asin, quantity: 0, amount: 0, records: [] });
    const g = groups.get(key);
    g.quantity += r.quantity;
    g.amount += r.amount;
    g.records.push(r);
    if (!g.asin && r.asin) g.asin = r.asin;
  });

  return Array.from(groups.values())
    .map((g) => ({
      ...g,
      weightedAvgPrice: g.quantity > 0 ? g.amount / g.quantity : 0,
      // 内訳は複数アカウントの記録を合算するため、保存された順(アカウント順)
      // のままだと日付がバラバラになる。新しい順に並べ替えておく。
      records: [...g.records].sort((a, b) => new Date(b.date) - new Date(a.date)),
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * 「確認済み」チェックは、商品ごと(ASIN優先、無ければ商品名)にこの端末の
 * ブラウザだけに覚えさせる印で、スプレッドシート側のデータは変更しない。
 * 大量の集計結果の中から、まだ確認していない商品を見分けやすくするためのもの。
 */
const REVIEWED_PRODUCTS_KEY = "ppcalc_reviewedProducts";
function getReviewedProducts() {
  try { return new Set(JSON.parse(localStorage.getItem(REVIEWED_PRODUCTS_KEY)) || []); } catch (e) { return new Set(); }
}
function setReviewedProduct(key, reviewed) {
  const set = getReviewedProducts();
  if (reviewed) set.add(key); else set.delete(key);
  localStorage.setItem(REVIEWED_PRODUCTS_KEY, JSON.stringify(Array.from(set)));
}

/**
 * 商品名がAmazon側のメール表示で途中省略(「…」)されていて何の商品か
 * 分からない場合に備え、内訳の各行から実際の注文ページへ直接飛べる
 * リンクを出す(商品名はメールごとに異なる省略のされ方をするため、
 * 集計行ではなく注文番号を持つ内訳行の単位でのみ付けられる)。
 */
function amazonOrderDetailsUrl(orderNumber) {
  return `https://www.amazon.co.jp/gp/your-account/order-details?orderID=${encodeURIComponent(orderNumber)}`;
}

function renderPeriodResults(groups) {
  currentPeriodGroups = groups;
  const table = $("periodTable");
  if (groups.length === 0) {
    table.hidden = true;
    $("periodStatus").textContent = "この期間の仕入れ記録が見つかりませんでした。";
    return;
  }
  table.hidden = false;
  $("periodStatus").textContent = `${groups.length}件の商品を集計しました。`;
  const reviewed = getReviewedProducts();
  table.innerHTML = `
    <thead><tr><th>確認済み</th><th>商品名</th><th>数量計</th><th>金額計</th><th>加重平均単価</th><th></th></tr></thead>
    <tbody>${groups.map((g, idx) => {
      const key = g.asin || g.name;
      const isReviewed = reviewed.has(key);
      return `
      <tr class="${isReviewed ? "is-reviewed" : ""}">
        <td style="text-align:center;"><input type="checkbox" data-action="toggle-reviewed" data-idx="${idx}" ${isReviewed ? "checked" : ""} title="確認済みにする"></td>
        <td>${escapeHtml(g.name)}${g.asin ? `<br><small>${escapeHtml(g.asin)}</small>` : ""}</td>
        <td>${g.quantity}</td>
        <td>${yen(g.amount)}</td>
        <td><strong>${yen(g.weightedAvgPrice)}</strong></td>
        <td>
          <button type="button" class="btn" data-action="toggle-breakdown" data-idx="${idx}">内訳（${g.records.length}件）</button>
          <button type="button" class="btn btn--primary" data-action="use-period-avg" data-idx="${idx}">計算ツールへ反映</button>
          <button type="button" class="btn btn--danger" data-action="delete-group" data-idx="${idx}">この商品を削除</button>
        </td>
      </tr>
      <tr class="period-breakdown-row" data-group-idx="${idx}" hidden>
        <td colspan="6">
          <table class="record-breakdown-table">
            <thead><tr><th>日付</th><th>数量</th><th>金額</th><th>アカウント／注文番号</th><th></th></tr></thead>
            <tbody>${g.records.map((r, rIdx) => `
              <tr>
                <td>${escapeHtml(r.date)}</td>
                <td>${r.quantity}</td>
                <td>${yen(r.amount)}</td>
                <td>${escapeHtml(r.email)}${r.orderNumber ? `<br><small>${escapeHtml(r.orderNumber)}</small> <a href="${amazonOrderDetailsUrl(r.orderNumber)}" target="_blank" rel="noopener">Amazonで確認</a>` : ""}</td>
                <td><button type="button" class="btn btn--danger" data-action="delete-record" data-group-idx="${idx}" data-record-idx="${rIdx}">削除</button></td>
              </tr>
            `).join("")}</tbody>
          </table>
        </td>
      </tr>
    `;
    }).join("")}</tbody>
  `;
}

function usePeriodAverage(idx) {
  const g = currentPeriodGroups[idx];
  if (!g) return;
  document.querySelector('input[name="mode"][value="forward"]').checked = true;
  $("purchaseTaxExcluded").checked = false;
  $("purchasePrice").value = Math.round(g.weightedAvgPrice);
  if ($("productName").value.trim() === "") $("productName").value = g.name;
  if ($("asin").value.trim() === "" && g.asin) $("asin").value = g.asin;
  recalcAndRender();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setPeriodPreset(preset, btn) {
  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  if (preset === "all") {
    $("periodFrom").value = "";
    $("periodTo").value = "";
  } else if (preset === "thisMonth") {
    $("periodFrom").value = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
    $("periodTo").value = fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  } else if (preset === "lastMonth") {
    $("periodFrom").value = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    $("periodTo").value = fmt(new Date(now.getFullYear(), now.getMonth(), 0));
  }
  document.querySelectorAll(".period-presets .btn").forEach((b) => b.classList.toggle("is-active", b === btn));
}

async function runPeriodAggregation(forceRefresh) {
  const emails = Object.keys(connectedAccounts);
  if (emails.length === 0) { alert("先に「Googleと連携する」を行ってください。"); return; }
  $("periodStatus").textContent = `集計中…（連携済み ${emails.length} アカウント分）`;
  try {
    const records = await fetchAllAccountsPurchaseRecords(forceRefresh);
    const groups = aggregateByPeriod(records, $("periodFrom").value, $("periodTo").value);
    renderPeriodResults(groups);
  } catch (e) {
    $("periodStatus").textContent = "エラー: " + e.message;
  }
}

let currentDuplicateGroups = [];

async function runDuplicateCheck() {
  const emails = Object.keys(connectedAccounts);
  if (emails.length === 0) { alert("先に「Googleと連携する」を行ってください。"); return; }
  $("checkDuplicatesBtn").disabled = true;
  $("duplicateStatus").textContent = "確認中…";
  try {
    const records = await fetchAllAccountsPurchaseRecords(true);
    const groups = findDuplicateRecords(records);
    renderDuplicateList(groups);
    $("duplicateStatus").textContent = groups.length === 0
      ? "重複の可能性がある記録は見つかりませんでした。"
      : `${groups.length}件の注文で重複の可能性がある記録が見つかりました。残す行を選んでください。`;
  } catch (e) {
    $("duplicateStatus").textContent = "エラー: " + e.message;
  } finally {
    $("checkDuplicatesBtn").disabled = false;
  }
}

function renderDuplicateList(groups) {
  currentDuplicateGroups = groups;
  const el = $("duplicateList");
  $("autoResolveDuplicatesBtn").hidden = groups.length === 0;
  if (groups.length === 0) { el.innerHTML = ""; return; }
  el.innerHTML = groups.map((g, gIdx) => `
    <div style="margin-top:14px;padding:10px;background:var(--bg);border-radius:8px;">
      <p class="hint" style="margin:0 0 6px;"><strong>${escapeHtml(g[0].name)}</strong>${g[0].asin ? `（${escapeHtml(g[0].asin)}）` : ""} ／ 注文番号: ${escapeHtml(g[0].orderNumber)}</p>
      <div class="table-scroll">
        <table class="record-breakdown-table">
          <thead><tr><th>日付</th><th>数量</th><th>単価</th><th>金額</th><th>取得元</th><th>アカウント</th><th></th></tr></thead>
          <tbody>${g.map((r, rIdx) => `
            <tr>
              <td>${escapeHtml(r.date)}</td>
              <td>${r.quantity}</td>
              <td>${yen(r.unitPrice)}</td>
              <td>${yen(r.amount)}</td>
              <td>${escapeHtml(r.source)}</td>
              <td>${escapeHtml(r.email)}</td>
              <td><button type="button" class="btn btn--primary" data-action="keep-only" data-group-idx="${gIdx}" data-record-idx="${rIdx}">これだけ残す</button></td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    </div>
  `).join("");
}

/**
 * 重複グループが大量にある場合(自動取得の二重実行等)、1件ずつ「これだけ残す」を
 * 押すのは非現実的なため、全グループについて行番号が最も若い(＝最初に保存された)
 * 1件だけを自動的に残し、残りをまとめて削除する。重複は注文番号+商品で判定済み
 * （findDuplicateRecords）のため、グループ内のどれを残しても内容は同じ。
 */
async function autoResolveAllDuplicates() {
  if (currentDuplicateGroups.length === 0) return;
  const toDelete = [];
  currentDuplicateGroups.forEach((group) => {
    const sorted = [...group].sort((a, b) => a.rowNumber - b.rowNumber);
    sorted.slice(1).forEach((r) => toDelete.push(r));
  });
  if (!confirm(`${currentDuplicateGroups.length}件の重複グループについて、それぞれ最初の1件だけ残し、残り${toDelete.length}件をまとめて削除します。\nよろしいですか？（元に戻せません）`)) return;
  const btn = $("autoResolveDuplicatesBtn");
  btn.disabled = true;
  try {
    await deletePurchaseRecords(toDelete);
    await runDuplicateCheck();
    await runPeriodAggregation(true);
  } catch (err) {
    alert("削除に失敗しました: " + err.message);
  } finally {
    btn.disabled = false;
  }
}

/**
 * 連携済みの全アカウントの仕入れ記録を、期間を問わず全件削除する。
 * 記録をやり直したい場合のための非常手段で、元に戻せないため、件数を
 * 明示した上で必ず確認を取る。
 */
async function deleteAllRecords() {
  const emails = Object.keys(connectedAccounts);
  if (emails.length === 0) { alert("先に「Googleと連携する」を行ってください。"); return; }
  const btn = $("deleteAllRecordsBtn");
  btn.disabled = true;
  $("deleteAllStatus").textContent = "件数を確認中…";
  try {
    const records = await fetchAllAccountsPurchaseRecords(true);
    if (records.length === 0) {
      $("deleteAllStatus").textContent = "削除する記録はありませんでした。";
      return;
    }
    if (!confirm(`連携済み${emails.length}アカウント、合計${records.length}件の仕入れ記録を全て削除します。\nこの操作は元に戻せません。本当によろしいですか？`)) {
      $("deleteAllStatus").textContent = "";
      return;
    }
    $("deleteAllStatus").textContent = `削除中…（${records.length}件）`;
    await deletePurchaseRecords(records);
    $("deleteAllStatus").textContent = `${records.length}件の記録を削除しました。`;
    await runPeriodAggregation(true);
    await runDuplicateCheck();
  } catch (e) {
    $("deleteAllStatus").textContent = "エラー: " + e.message;
  } finally {
    btn.disabled = false;
  }
}

function attachPeriodEvents() {
  renderProductMaster();
  $("masterAddBtn").addEventListener("click", () => {
    const canonical = $("masterCanonicalInput").value.trim();
    const keyword = $("masterKeywordInput").value.trim();
    if (!canonical || !keyword) { alert("正式名称とキーワードの両方を入力してください。"); return; }
    addProductMasterEntry(canonical, keyword);
    $("masterCanonicalInput").value = "";
    $("masterKeywordInput").value = "";
    renderProductMaster();
  });
  $("masterList").addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="delete-master"]');
    if (!btn) return;
    removeProductMasterEntry(parseInt(btn.dataset.idx, 10));
    renderProductMaster();
  });

  document.querySelectorAll(".period-presets .btn").forEach((btn) => {
    btn.addEventListener("click", () => setPeriodPreset(btn.dataset.preset, btn));
  });
  // プリセットボタン経由でなく開始日・終了日を直接書き換えた場合は、
  // どのプリセットとも一致しなくなるため選択表示を外す。
  [$("periodFrom"), $("periodTo")].forEach((el) => {
    el.addEventListener("input", () => {
      document.querySelectorAll(".period-presets .btn").forEach((b) => b.classList.remove("is-active"));
    });
  });
  $("periodCalcBtn").addEventListener("click", () => runPeriodAggregation(false));
  $("periodRefreshBtn").addEventListener("click", () => runPeriodAggregation(true));
  $("periodTable").addEventListener("click", async (e) => {
    const useBtn = e.target.closest('button[data-action="use-period-avg"]');
    if (useBtn) { usePeriodAverage(parseInt(useBtn.dataset.idx, 10)); return; }

    const toggleBtn = e.target.closest('button[data-action="toggle-breakdown"]');
    if (toggleBtn) {
      const row = $("periodTable").querySelector(`tr.period-breakdown-row[data-group-idx="${toggleBtn.dataset.idx}"]`);
      if (row) row.hidden = !row.hidden;
      return;
    }

    const deleteBtn = e.target.closest('button[data-action="delete-record"]');
    if (deleteBtn) {
      const group = currentPeriodGroups[parseInt(deleteBtn.dataset.groupIdx, 10)];
      const record = group && group.records[parseInt(deleteBtn.dataset.recordIdx, 10)];
      if (!record) return;
      if (!confirm(`この記録を削除しますか？\n${record.date} / ${record.name} / ${yen(record.amount)}\n（元に戻せません）`)) return;
      deleteBtn.disabled = true;
      try {
        await deletePurchaseRecord(record);
        // 行削除で後続行の番号がずれるため、キャッシュを使わず必ず再取得してから再描画する。
        await runPeriodAggregation(true);
      } catch (err) {
        alert("削除に失敗しました: " + err.message);
        deleteBtn.disabled = false;
      }
      return;
    }

    const deleteGroupBtn = e.target.closest('button[data-action="delete-group"]');
    if (deleteGroupBtn) {
      const group = currentPeriodGroups[parseInt(deleteGroupBtn.dataset.idx, 10)];
      if (!group) return;
      if (!confirm(`「${group.name}」の記録を${group.records.length}件まとめて削除しますか？\n（元に戻せません）`)) return;
      deleteGroupBtn.disabled = true;
      try {
        await deletePurchaseRecords(group.records);
        await runPeriodAggregation(true);
      } catch (err) {
        alert("削除に失敗しました: " + err.message);
        deleteGroupBtn.disabled = false;
      }
    }
  });
  $("periodTable").addEventListener("change", (e) => {
    const cb = e.target.closest('input[data-action="toggle-reviewed"]');
    if (!cb) return;
    const g = currentPeriodGroups[parseInt(cb.dataset.idx, 10)];
    if (!g) return;
    setReviewedProduct(g.asin || g.name, cb.checked);
    const row = cb.closest("tr");
    if (row) row.classList.toggle("is-reviewed", cb.checked);
  });

  $("checkDuplicatesBtn").addEventListener("click", runDuplicateCheck);
  $("autoResolveDuplicatesBtn").addEventListener("click", autoResolveAllDuplicates);
  $("deleteAllRecordsBtn").addEventListener("click", deleteAllRecords);
  $("duplicateList").addEventListener("click", async (e) => {
    const btn = e.target.closest('button[data-action="keep-only"]');
    if (!btn) return;
    const group = currentDuplicateGroups[parseInt(btn.dataset.groupIdx, 10)];
    if (!group) return;
    const keepIdx = parseInt(btn.dataset.recordIdx, 10);
    const toDelete = group.filter((_, idx) => idx !== keepIdx);
    if (!confirm(`${toDelete.length}件を削除し、1件だけ残します。よろしいですか？\n（元に戻せません）`)) return;
    btn.disabled = true;
    try {
      await deletePurchaseRecords(toDelete);
      await runDuplicateCheck();
      await runPeriodAggregation(true);
    } catch (err) {
      alert("削除に失敗しました: " + err.message);
      btn.disabled = false;
    }
  });
}

/* ---------------- 初期化 ---------------- */

function attachInputEvents() {
  const ids = [
    "sellPrice", "taxRate", "referralRate", "closingFee", "fbaFee", "storageFee",
    "acos", "returnRate", "purchasePrice", "purchaseTaxExcluded", "shippingIn",
    "customs", "inspection", "fbaShip", "otherCost", "targetMarginPct", "targetRoiPct",
  ];
  ids.forEach(id => {
    $(id).addEventListener("input", recalcAndRender);
    $(id).addEventListener("change", recalcAndRender);
  });
  document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener("change", recalcAndRender));
  document.querySelectorAll('input[name="targetType"]').forEach(r => r.addEventListener("change", recalcAndRender));

  $("category").addEventListener("change", () => {
    const item = CATEGORIES[$("category").value];
    if (item.rate !== null) $("referralRate").value = item.rate;
    if (item.closingFee !== null) $("closingFee").value = item.closingFee;
    recalcAndRender();
  });

  $("fbaSizeTier").addEventListener("change", () => {
    const item = FBA_TIERS[$("fbaSizeTier").value];
    if (item.fee !== null) $("fbaFee").value = item.fee;
    recalcAndRender();
  });
}

/* ================================================================
 * 在庫リセット判定（プライスターの在庫CSV・販売CSV）
 * 仕様: docs/specs/stock-zero-reset-spec.md
 * CSVはブラウザ内でのみ処理し、外部へは送信しない。
 * ================================================================ */

const STOCK_RESET_DATES_KEY = "ppcalc_resetDates";
const STOCK_SNAPSHOTS_KEY = "ppcalc_stockSnapshots";
const STOCK_AUTODELETE_KEY = "ppcalc_stockAutoDelete";
const STOCK_AUTODELETE_CONFIRMED_KEY = "ppcalc_stockAutoDeleteConfirmed";
const STOCK_RETENTION_DAYS = 90;
const STOCK_STOCK_FILE_RE = /^editUploadProduct_FBA.*\.csv$/i;
const STOCK_ORDERS_FILE_RE = /^orders_.*\.csv$/i;
const STOCK_SOURCE_LABELS = {
  lastSale: "最終販売日",
  rangeStart: "販売CSVの期間開始日（3か月以上販売なし・近似）",
  manual: "手動指定",
};

function readJsonStorage(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v === null || v === undefined ? fallback : v;
  } catch (e) { return fallback; }
}

function localDateStr(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function shiftDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d + days));
}

/* ---------------- CSVの読み取り ---------------- */

/** UTF-8として読めなければShift-JIS(Windows-31J)として読む。プライスターのCSVは通常Shift-JIS。 */
function decodeCsvBytes(buf) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch (e) {
    return new TextDecoder("shift_jis").decode(buf);
  }
}

/**
 * 最小限のCSVパーサ（ダブルクォート囲み・クォート内の改行/カンマ・""のエスケープに対応）。
 * プライスターのCSVは SKU/ASIN/title 等が Excel の文字列式 ="..." で書かれているため、
 * 「=」の直後のクォートも通常のクォートとして扱い、「="」「"」を取り除いた中身だけを返す。
 */
function parseCsvText(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const src = text.replace(/^﻿/, "");
  const pushRow = () => {
    row.push(field);
    field = "";
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"' && (field === "" || field === "=")) {
      inQuotes = true;
      field = "";
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

/** ヘッダー行から、在庫CSV("stock")か販売CSV("orders")かを判定する。どちらでもなければnull。 */
function detectCsvKind(headerRow) {
  const h = headerRow.map((c) => String(c).trim());
  if (h.includes("number") && h.includes("cost") && h.includes("ASIN") && h.includes("SKU")) return "stock";
  if (h.includes("AmazonOrderId") && h.includes("注文日") && h.includes("ASIN")) return "orders";
  return null;
}

function csvColumnIndexes(headerRow, names, label) {
  const h = headerRow.map((c) => String(c).trim());
  const idx = {};
  const missing = [];
  names.forEach((n) => { idx[n] = h.indexOf(n); if (idx[n] < 0) missing.push(n); });
  if (missing.length > 0) throw new Error(`${label}に必要な列が見つかりません: ${missing.join(", ")}`);
  return idx;
}

/** 在庫CSV → [{ sku, asin, title, stock, cost }] */
function parseStockCsv(rows) {
  const idx = csvColumnIndexes(rows[0], ["SKU", "ASIN", "title", "number", "cost"], "在庫CSV");
  return rows.slice(1)
    .filter((r) => r.length > idx.number && r[idx.ASIN])
    .map((r) => ({
      sku: r[idx.SKU],
      asin: r[idx.ASIN],
      title: r[idx.title] || "",
      stock: parseInt(r[idx.number], 10) || 0,
      cost: r[idx.cost] === "" || r[idx.cost] === undefined ? null : (parseInt(r[idx.cost], 10) || 0),
    }));
}

/**
 * 販売CSV → { orders:[{ date, name, asin, sku, status }], minDate, maxDate }
 * 顧客の注文番号(AmazonOrderId)は読み飛ばし、保持しない。
 */
function parseOrdersCsv(rows) {
  const idx = csvColumnIndexes(rows[0], ["注文日", "商品名", "ASIN", "SKU", "出荷状態"], "販売CSV");
  const orders = rows.slice(1)
    .filter((r) => r.length > idx["出荷状態"] && r[idx.ASIN] && r[idx["注文日"]])
    .map((r) => ({
      date: r[idx["注文日"]].slice(0, 10),
      name: r[idx["商品名"]] || "",
      asin: r[idx.ASIN],
      sku: r[idx.SKU] || "",
      status: r[idx["出荷状態"]] || "",
    }));
  const dates = orders.map((o) => o.date).sort();
  return { orders, minDate: dates[0] || null, maxDate: dates[dates.length - 1] || null };
}

/* ---------------- 仕入れ記録 → プライスター商品(ASIN)の紐付け ---------------- */

/**
 * ASIN完全一致 → 商品マスタ(キーワード+ASIN登録) → 名前(省略表示を考慮した前方一致)の順に探す。
 * 名前で複数候補になる場合は推測せず "ambiguous" を返す。
 */
function linkRecordToProduct(rec, productList, master) {
  if (rec.asin) {
    const p = productList.find((x) => x.asin === rec.asin);
    if (p) return { asin: p.asin, method: "ASIN", candidates: [] };
  }
  for (const e of master) {
    if (!e.keyword || !e.asins || e.asins.length === 0 || !rec.name.includes(e.keyword)) continue;
    const hit = e.asins.find((a) => productList.some((p) => p.asin === a));
    if (hit) return { asin: hit, method: "マスタ", candidates: [] };
  }
  const nr = normalizeNameForMatch(rec.name);
  if (nr.length >= 6) {
    const cands = productList.filter((p) => {
      const t = normalizeNameForMatch(p.title);
      if (!t) return false;
      return t === nr || t.indexOf(nr) === 0 || (t.length >= 6 && nr.indexOf(t) === 0);
    });
    if (cands.length === 1) return { asin: cands[0].asin, method: "名前", candidates: [] };
    if (cands.length > 1) return { asin: null, method: "ambiguous", candidates: cands.map((c) => c.asin) };
  }
  return { asin: null, method: "none", candidates: [] };
}

/* ---------------- リセット判定 ---------------- */

/**
 * 在庫CSV・販売CSV・仕入れ記録から、商品(ASIN)ごとの状態と「現行ロット」の加重平均単価を求める。
 * 副作用は無く、保存すべきリセット日は resetUpdates として返す。
 *   stockRows: parseStockCsv の結果 / ordersInfo: parseOrdersCsv の結果(未読込ならnull)
 *   opts: { includePending, missingAsZero, threshold }
 */
function buildStockResetView({ stockRows, ordersInfo, records, master, resetDates, opts }) {
  const products = new Map();
  const ensure = (asin, title) => {
    if (!products.has(asin)) products.set(asin, { asin, title: title || "", skus: [], stockTotal: 0, inStockCsv: false, lastSaleDate: null });
    return products.get(asin);
  };
  stockRows.forEach((r) => {
    const p = ensure(r.asin, r.title);
    if (!p.title) p.title = r.title;
    p.skus.push({ sku: r.sku, stock: r.stock, cost: r.cost });
    p.stockTotal += r.stock;
    p.inStockCsv = true;
  });
  const ordersLoaded = !!ordersInfo;
  if (ordersLoaded) {
    ordersInfo.orders.forEach((o) => {
      const p = ensure(o.asin, o.name);
      if (!p.title) p.title = o.name;
      const status = String(o.status || "");
      if (/cancel/i.test(status)) return;
      if (!opts.includePending && /pending/i.test(status)) return;
      if (!p.lastSaleDate || o.date > p.lastSaleDate) p.lastSaleDate = o.date;
    });
  }
  const productList = Array.from(products.values());

  const linkedByAsin = new Map();
  const unresolved = new Map();
  const methodCounts = {};
  records.forEach((rec) => {
    const link = linkRecordToProduct(rec, productList, master);
    methodCounts[link.method] = (methodCounts[link.method] || 0) + 1;
    if (link.asin) {
      if (!linkedByAsin.has(link.asin)) linkedByAsin.set(link.asin, []);
      linkedByAsin.get(link.asin).push(rec);
    } else {
      if (!unresolved.has(rec.name)) unresolved.set(rec.name, { name: rec.name, count: 0, candidates: link.candidates, method: link.method, sampleOrder: rec.orderNumber || "" });
      unresolved.get(rec.name).count++;
    }
  });

  const resetUpdates = {};
  const rows = productList.map((p) => {
    const persisted = resetDates[p.asin] || null;
    const missing = !p.inStockCsv;
    const zeroLike = missing ? !!opts.missingAsZero : p.stockTotal === 0;
    let status, resetDate = null, source = null;

    if (persisted && persisted.source === "manual") {
      resetDate = persisted.resetDate; source = "manual";
      status = zeroLike ? (missing ? "missing_zero" : "zero_reset") : (missing ? "missing_keep" : "continue");
    } else if (!zeroLike) {
      status = missing ? "missing_keep" : "continue";
      if (persisted) { resetDate = persisted.resetDate; source = persisted.source; }
    } else if (ordersLoaded) {
      if (p.lastSaleDate) {
        resetDate = p.lastSaleDate; source = "lastSale";
        status = missing ? "missing_zero" : "zero_reset";
      } else {
        if (persisted) { resetDate = persisted.resetDate; source = persisted.source; }
        else { resetDate = ordersInfo.minDate; source = "rangeStart"; }
        status = missing ? "missing_zero" : "zero_outofrange";
      }
      if (resetDate && (!persisted || persisted.resetDate !== resetDate || persisted.source !== source)) {
        resetUpdates[p.asin] = { resetDate, source };
      }
    } else if (persisted) {
      resetDate = persisted.resetDate; source = persisted.source;
      status = missing ? "missing_zero" : "zero_reset";
    } else {
      status = missing ? "missing_zero" : "zero_unknown";
    }

    const linked = linkedByAsin.get(p.asin) || [];
    const previewRecords = linked
      .map((rec) => ({ ...rec, included: !resetDate || String(rec.date).slice(0, 10) >= resetDate }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const lot = previewRecords.filter((r) => r.included);
    const lotQty = lot.reduce((s, r) => s + r.quantity, 0);
    const lotAmount = lot.reduce((s, r) => s + r.amount, 0);
    const allQty = linked.reduce((s, r) => s + r.quantity, 0);
    const allAmount = linked.reduce((s, r) => s + r.amount, 0);
    const avg = lotQty > 0 ? lotAmount / lotQty : null;
    const referenceAvg = allQty > 0 ? allAmount / allQty : null;
    const costs = Array.from(new Set(p.skus.map((s) => s.cost).filter((c) => c !== null && c !== undefined)));
    const needsUpdate = avg !== null && costs.some((c) => Math.abs(Math.round(avg) - c) >= opts.threshold);

    return {
      asin: p.asin, title: p.title, skus: p.skus, stockTotal: p.stockTotal, inStockCsv: p.inStockCsv,
      status, resetDate, source, lastSaleDate: p.lastSaleDate,
      lotQty, lotAmount, avg, referenceAvg, costs, needsUpdate, records: previewRecords,
    };
  });

  const zeroStatuses = ["zero_reset", "zero_outofrange", "zero_unknown", "missing_zero"];
  const summary = {
    productCount: rows.length,
    zeroCount: rows.filter((r) => zeroStatuses.includes(r.status)).length,
    recordCount: records.length,
    methodCounts,
    unresolvedCount: unresolved.size,
  };
  return { rows, unresolved: Array.from(unresolved.values()), summary, resetUpdates };
}

/* ---------------- 保存データ(リセット日・在庫履歴)と90日の自動削除 ---------------- */

function getResetDates() { return readJsonStorage(STOCK_RESET_DATES_KEY, {}); }
function saveResetDates(obj) { localStorage.setItem(STOCK_RESET_DATES_KEY, JSON.stringify(obj)); }

/** 90日を過ぎた在庫スナップショットを削除する。削除した件数を返す。 */
function purgeOldSnapshots(todayStr) {
  const list = readJsonStorage(STOCK_SNAPSHOTS_KEY, []);
  const cutoff = shiftDateStr(todayStr, -STOCK_RETENTION_DAYS);
  const kept = list.filter((s) => s.date >= cutoff);
  if (kept.length !== list.length) localStorage.setItem(STOCK_SNAPSHOTS_KEY, JSON.stringify(kept));
  return list.length - kept.length;
}

function recordStockSnapshot(stockRows, todayStr) {
  purgeOldSnapshots(todayStr);
  const list = readJsonStorage(STOCK_SNAPSHOTS_KEY, []).filter((s) => s.date !== todayStr);
  list.push({ date: todayStr, items: stockRows.map((r) => ({ asin: r.asin, sku: r.sku, stock: r.stock, cost: r.cost })) });
  localStorage.setItem(STOCK_SNAPSHOTS_KEY, JSON.stringify(list));
}

function isStockAutoDeleteOn() { return localStorage.getItem(STOCK_AUTODELETE_KEY) === "on"; }

/* ---------------- PC専用フォルダ(File System Access API) ---------------- */

const STOCK_IDB_NAME = "ppcalc_stock";
const STOCK_IDB_STORE = "handles";
const STOCK_IDB_KEY = "stockFolder";
let stockDirHandle = null;

function stockFolderSupported() { return typeof window.showDirectoryPicker === "function"; }

function stockIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(STOCK_IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STOCK_IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function stockIdbSet(value) {
  try {
    const db = await stockIdb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STOCK_IDB_STORE, "readwrite");
      tx.objectStore(STOCK_IDB_STORE).put(value, STOCK_IDB_KEY);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
  } catch (e) { /* 保存できない環境では、このページを開いている間だけ覚える */ }
}
async function stockIdbGet() {
  try {
    const db = await stockIdb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STOCK_IDB_STORE, "readonly").objectStore(STOCK_IDB_STORE).get(STOCK_IDB_KEY);
      req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error);
    });
  } catch (e) { return null; }
}
async function stockIdbClear() {
  try {
    const db = await stockIdb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STOCK_IDB_STORE, "readwrite");
      tx.objectStore(STOCK_IDB_STORE).delete(STOCK_IDB_KEY);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
  } catch (e) { /* 無視 */ }
}

async function ensureFolderPermission(handle, mode) {
  if (typeof handle.queryPermission !== "function") return true;
  if ((await handle.queryPermission({ mode })) === "granted") return true;
  return (await handle.requestPermission({ mode })) === "granted";
}

/** 専用フォルダ内の在庫CSV・販売CSVを、それぞれ更新日時が最新の1件ずつ選ぶ。他のファイルは読まない。 */
async function listStockFolderCsvs(dirHandle) {
  const all = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind !== "file") continue;
    const kind = STOCK_STOCK_FILE_RE.test(entry.name) ? "stock" : (STOCK_ORDERS_FILE_RE.test(entry.name) ? "orders" : null);
    if (!kind) continue;
    const file = await entry.getFile();
    all.push({ kind, name: entry.name, lastModified: file.lastModified, file });
  }
  const newest = (kind) => all.filter((f) => f.kind === kind).sort((a, b) => b.lastModified - a.lastModified)[0] || null;
  return { stock: newest("stock"), orders: newest("orders"), all };
}

/** 90日より古いCSV（各種類の最新1件は除く）を選び出す。 */
function selectOldCsvsToDelete(listing, nowMs) {
  const cutoff = nowMs - STOCK_RETENTION_DAYS * 86400000;
  const keep = new Set([listing.stock && listing.stock.name, listing.orders && listing.orders.name]);
  return listing.all.filter((f) => !keep.has(f.name) && f.lastModified < cutoff);
}

async function deleteOldCsvsInFolder(dirHandle, listing, nowMs) {
  const victims = selectOldCsvsToDelete(listing, nowMs);
  if (victims.length === 0) return 0;
  if (typeof dirHandle.removeEntry !== "function") return 0;
  if (!await ensureFolderPermission(dirHandle, "readwrite")) return 0;
  if (localStorage.getItem(STOCK_AUTODELETE_CONFIRMED_KEY) !== "yes") {
    const ok = window.confirm(`次の古いCSV（${STOCK_RETENTION_DAYS}日より前）を専用フォルダから削除します。\n\n${victims.map((v) => "・" + v.name).join("\n")}\n\n以後は確認なしで自動削除してよろしいですか？`);
    if (!ok) return 0;
    localStorage.setItem(STOCK_AUTODELETE_CONFIRMED_KEY, "yes");
  }
  let deleted = 0;
  for (const v of victims) {
    try { await dirHandle.removeEntry(v.name); deleted++; } catch (e) { /* 削除できなかったファイルはそのまま */ }
  }
  return deleted;
}

/* ---------------- 画面 ---------------- */

const STOCK_STATUS_LABELS = {
  continue: "継続",
  zero_reset: "在庫0・リセット",
  zero_outofrange: "在庫0・範囲外",
  zero_unknown: "在庫0・日付不明",
  missing_zero: "出品情報なし（ゼロ扱い）",
  missing_keep: "出品情報なし（継続）",
};

const stockState = { stockRows: null, stockFileName: "", ordersInfo: null, ordersFileName: "" };
let stockView = null;
let stockRecordsCache = [];
const stockOpenPreview = new Set();

function readStockOpts() {
  return {
    includePending: $("stockIncludePending").checked,
    missingAsZero: $("stockMissingAsZero").checked,
    threshold: Math.max(0, parseFloat($("stockThreshold").value) || 0),
  };
}

/** 記録名から商品マスタ用のキーワード(省略記号を除いた先頭部分)を作る。 */
function stockKeywordFromName(name) {
  const stem = String(name).replace(/(\.{2,}|…)\s*$/, "").trim();
  return stem || String(name);
}

function addProductMasterAsinEntry(canonical, keyword, asin) {
  const list = getProductMaster();
  const existing = list.find((e) => e.keyword === keyword);
  if (existing) {
    existing.asins = Array.from(new Set([...(existing.asins || []), asin]));
    if (!existing.canonical) existing.canonical = canonical;
  } else {
    list.push({ canonical, keyword, asins: [asin] });
  }
  saveProductMaster(list);
}

async function readOneStockCsv(file) {
  const rows = parseCsvText(decodeCsvBytes(await file.arrayBuffer()));
  if (rows.length === 0) throw new Error("空のファイルです");
  const kind = detectCsvKind(rows[0]);
  if (kind === "stock") {
    stockState.stockRows = parseStockCsv(rows);
    stockState.stockFileName = file.name;
  } else if (kind === "orders") {
    stockState.ordersInfo = parseOrdersCsv(rows);
    stockState.ordersFileName = file.name;
  } else {
    throw new Error("在庫CSV・販売CSVのどちらでもないようです（ヘッダー行を確認できませんでした）");
  }
  return kind;
}

/** 渡されたCSV(複数可)を種類・文字コードを自動判定して読み込み、判定結果を表示する。 */
async function ingestStockCsvFiles(files) {
  const errors = [];
  const sorted = files.slice().sort((a, b) => (a.lastModified || 0) - (b.lastModified || 0));
  for (const f of sorted) {
    try { await readOneStockCsv(f); } catch (e) { errors.push(`${f.name}: ${e.message}`); }
  }
  if (stockState.stockRows) recordStockSnapshot(stockState.stockRows, localDateStr(new Date()));
  const loaded = [];
  if (stockState.stockRows) loaded.push(`在庫CSV「${stockState.stockFileName}」（${stockState.stockRows.length}行）`);
  if (stockState.ordersInfo) loaded.push(`販売CSV「${stockState.ordersFileName}」（${stockState.ordersInfo.orders.length}件、${stockState.ordersInfo.minDate || "?"}〜${stockState.ordersInfo.maxDate || "?"}）`);
  $("stockStatus").textContent = (loaded.length ? "読み込みました: " + loaded.join(" / ") : "") + (errors.length ? (loaded.length ? " ／ " : "") + "読み込めなかったファイル: " + errors.join(" / ") : "");
  await refreshStockView(true);
}

async function loadStockFromFolder(forcePick) {
  $("stockStatus").textContent = "フォルダを確認中…";
  try {
    const mode = isStockAutoDeleteOn() ? "readwrite" : "read";
    let handle = forcePick ? null : (stockDirHandle || await stockIdbGet());
    if (!handle) {
      handle = await window.showDirectoryPicker({ id: "pricetar-csv", mode });
      await stockIdbSet(handle);
    } else if (!await ensureFolderPermission(handle, mode)) {
      throw new Error("フォルダへのアクセスが許可されませんでした。もう一度「フォルダを読み込む」を押して許可してください。");
    }
    stockDirHandle = handle;
    const listing = await listStockFolderCsvs(handle);
    const targets = [listing.stock, listing.orders].filter(Boolean).map((f) => f.file);
    if (targets.length === 0) {
      $("stockStatus").textContent = "専用フォルダに在庫CSV（editUploadProduct_FBA*.csv）も販売CSV（orders_*.csv）も見つかりませんでした。";
      return;
    }
    await ingestStockCsvFiles(targets);
    let note = "";
    if (isStockAutoDeleteOn()) {
      const deleted = await deleteOldCsvsInFolder(handle, listing, Date.now());
      if (deleted > 0) note = ` ${deleted}件の古いCSVを削除しました。`;
    }
    $("stockStatus").textContent += note;
  } catch (e) {
    $("stockStatus").textContent = e && e.name === "AbortError" ? "フォルダの選択をキャンセルしました。" : "エラー: " + (e && e.message ? e.message : e);
  }
}

async function refreshStockView(persistUpdates) {
  if (!stockState.stockRows) {
    $("stockSummary").textContent = stockState.ordersInfo ? "販売CSVを読み込みました。判定には在庫CSV（editUploadProduct_FBA）も必要です。" : "";
    $("stockTable").hidden = true;
    $("stockFilters").hidden = true;
    $("stockAmbiguous").innerHTML = "";
    return;
  }
  let note = "";
  stockRecordsCache = [];
  if (Object.keys(connectedAccounts).length > 0) {
    try { stockRecordsCache = await fetchAllAccountsPurchaseRecords(false); }
    catch (e) { note = "仕入れ記録を読み込めませんでした: " + e.message; }
  } else {
    note = "Googleアカウントが未連携のため、仕入れ単価は計算していません（在庫の状態のみ表示）。";
  }
  renderStockView(persistUpdates, note);
}

function renderStockView(persistUpdates, note) {
  if (!stockState.stockRows) return;
  const view = buildStockResetView({
    stockRows: stockState.stockRows,
    ordersInfo: stockState.ordersInfo,
    records: stockRecordsCache,
    master: getProductMaster(),
    resetDates: getResetDates(),
    opts: readStockOpts(),
  });
  if (persistUpdates && Object.keys(view.resetUpdates).length > 0) {
    const dates = getResetDates();
    const now = new Date().toISOString();
    Object.entries(view.resetUpdates).forEach(([asin, u]) => { dates[asin] = { ...u, decidedAt: now }; });
    saveResetDates(dates);
  }
  stockView = view;
  const s = view.summary;
  const mc = s.methodCounts;
  $("stockSummary").textContent = `商品 ${s.productCount}件（在庫0: ${s.zeroCount}件）／ 仕入れ記録 ${s.recordCount}件 `
    + `（ASIN一致 ${mc["ASIN"] || 0} ・マスタ ${mc["マスタ"] || 0} ・名前 ${mc["名前"] || 0} ・要確認 ${mc["ambiguous"] || 0} ・未紐付け ${mc["none"] || 0}）`
    + (stockState.ordersInfo ? "" : " ／ 販売CSV未読込のため、在庫0の商品は最終販売日を判定できません。")
    + (note ? " ／ " + note : "");
  $("stockFilters").hidden = false;
  renderStockAmbiguous(view);
  renderStockTable(view);
}

function renderStockAmbiguous(view) {
  const el = $("stockAmbiguous");
  if (view.unresolved.length === 0) { el.innerHTML = ""; return; }
  const groups = view.unresolved.slice().sort((a, b) => b.count - a.count).slice(0, 30);
  const titleOf = (asin) => (view.rows.find((r) => r.asin === asin) || { title: asin }).title;
  const allOptions = view.rows.map((r) => `<option value="${escapeHtml(r.asin)}">${escapeHtml(r.title.slice(0, 60))}（${escapeHtml(r.asin)}）</option>`).join("");
  el.innerHTML = `
    <h3>商品の紐付けが必要な記録（${view.unresolved.length}件）</h3>
    <p class="hint">仕入れ記録の商品名からプライスターの商品を一意に決められなかったものです。該当する商品を選んで登録すると、同じ名前の記録はすべてその商品として扱われます（商品マスタに保存されます）。</p>
    ${groups.map((g, i) => `
      <div class="stock-ambiguous-row" data-idx="${i}">
        <span>${escapeHtml(g.name)}（${g.count}件）${g.sampleOrder ? ` <a href="${amazonOrderDetailsUrl(g.sampleOrder)}" target="_blank" rel="noopener">Amazonで確認</a>` : ""}</span>
        <select data-role="link-select">
          ${g.candidates.length ? `<optgroup label="候補">${g.candidates.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(titleOf(a).slice(0, 60))}（${escapeHtml(a)}）</option>`).join("")}</optgroup>` : ""}
          <optgroup label="すべての商品">${allOptions}</optgroup>
        </select>
        <button type="button" class="btn" data-action="register-link" data-name="${escapeHtml(g.name)}">この商品として登録</button>
      </div>`).join("")}
    ${view.unresolved.length > groups.length ? `<p class="hint">ほか ${view.unresolved.length - groups.length}件は省略しています（件数の多い順に表示）。</p>` : ""}
  `;
}

function renderStockTable(view) {
  const table = $("stockTable");
  const onlyUpdate = $("stockOnlyUpdate").checked;
  const onlyZero = $("stockOnlyZero").checked;
  const zeroStatuses = ["zero_reset", "zero_outofrange", "zero_unknown", "missing_zero"];
  const rows = view.rows
    .filter((r) => (!onlyUpdate || r.needsUpdate) && (!onlyZero || zeroStatuses.includes(r.status)))
    .sort((a, b) => (Number(b.needsUpdate) - Number(a.needsUpdate)) || (Number(zeroStatuses.includes(b.status)) - Number(zeroStatuses.includes(a.status))) || a.title.localeCompare(b.title, "ja"));
  if (rows.length === 0) {
    table.hidden = true;
    return;
  }
  table.hidden = false;
  table.innerHTML = `
    <thead><tr><th>商品</th><th>在庫</th><th>状態</th><th>リセット日（根拠）</th><th>現行ロット数量</th><th>金額計</th><th>加重平均単価</th><th>プライスター現cost</th><th>差額</th><th></th></tr></thead>
    <tbody>${rows.map((r) => {
      const isZero = zeroStatuses.includes(r.status);
      const stockText = r.inStockCsv ? String(r.stockTotal) : "-";
      const resetText = r.resetDate
        ? `${escapeHtml(r.resetDate)}<br><small>${escapeHtml(STOCK_SOURCE_LABELS[r.source] || "")}</small>`
        : (r.status === "zero_unknown" ? "<small>未リセット（販売CSVを読み込むと判定します）</small>" : "-");
      let avgText;
      if (r.avg !== null) avgText = `<strong>${yen(r.avg)}</strong>`;
      else if (isZero) avgText = `<small>新ロット仕入れ未記録</small>${r.referenceAvg !== null ? `<br><small style="color:#888">参考: ${yen(r.referenceAvg)}</small>` : ""}`;
      else avgText = "-";
      const costText = r.costs.length ? r.costs.map(yen).join(" / ") : "-";
      const diffText = r.avg !== null && r.costs.length ? r.costs.map((c) => { const d = Math.round(r.avg) - c; return (d > 0 ? "+" : "") + d.toLocaleString("ja-JP") + "円"; }).join(" / ") : "-";
      const open = stockOpenPreview.has(r.asin);
      return `
      <tr class="stock-row ${isZero ? "stock-zero" : ""}" data-asin="${escapeHtml(r.asin)}">
        <td>${escapeHtml(r.title)}<br><small>${escapeHtml(r.asin)}</small></td>
        <td>${stockText}</td>
        <td>${STOCK_STATUS_LABELS[r.status]}</td>
        <td>${resetText}</td>
        <td>${r.lotQty}</td>
        <td>${yen(r.lotAmount)}</td>
        <td>${avgText}</td>
        <td>${costText}</td>
        <td class="${r.needsUpdate ? "stock-need-update" : ""}">${diffText}</td>
        <td><button type="button" class="btn" data-action="toggle-stock-preview" data-asin="${escapeHtml(r.asin)}">内訳（${r.records.length}件）</button></td>
      </tr>
      <tr class="stock-preview-row" data-asin="${escapeHtml(r.asin)}" ${open ? "" : "hidden"}>
        <td colspan="10">
          <div style="margin-bottom:6px;">
            リセット日を手動で指定:
            <input type="date" data-role="manual-date" value="${escapeHtml(r.resetDate || "")}">
            <button type="button" class="btn" data-action="apply-reset-date" data-asin="${escapeHtml(r.asin)}">この日付で適用</button>
            <button type="button" class="btn" data-action="clear-reset-date" data-asin="${escapeHtml(r.asin)}">自動に戻す</button>
            <small>（この日以降の仕入れが現行ロットになります）</small>
          </div>
          ${r.records.length === 0 ? `<p class="hint">この商品に紐付いた仕入れ記録はありません。</p>` : `
          <table class="stock-preview-table">
            <thead><tr><th>日付</th><th>数量</th><th>金額</th><th>区分</th><th>アカウント／注文番号</th></tr></thead>
            <tbody>${r.records.map((rec) => `
              <tr class="${rec.included ? "" : "is-excluded"}">
                <td>${escapeHtml(rec.date)}</td><td>${rec.quantity}</td><td>${yen(rec.amount)}</td>
                <td>${rec.included ? "現行ロット" : "旧ロット（除外）"}</td>
                <td>${escapeHtml(rec.email || "")}${rec.orderNumber ? `<br><small>${escapeHtml(rec.orderNumber)}</small>` : ""}</td>
              </tr>`).join("")}</tbody>
          </table>`}
        </td>
      </tr>`;
    }).join("")}</tbody>
  `;
}

function bulkRegisterStockProducts() {
  if (!stockState.stockRows) { $("stockStatus").textContent = "先に在庫CSVを読み込んでください。"; return; }
  const master = getProductMaster();
  const known = new Set();
  master.forEach((e) => (e.asins || []).forEach((a) => known.add(a)));
  let added = 0;
  stockState.stockRows.forEach((r) => {
    if (known.has(r.asin)) return;
    known.add(r.asin);
    master.push({ canonical: r.title, keyword: "", asins: [r.asin] });
    added++;
  });
  saveProductMaster(master);
  renderProductMaster();
  $("stockStatus").textContent = `在庫CSVの商品 ${added}件を商品マスタに登録しました（登録済みの商品は除きます）。`;
}

function attachStockEvents() {
  purgeOldSnapshots(localDateStr(new Date()));
  $("stockAutoDelete").checked = isStockAutoDeleteOn();
  if (!stockFolderSupported()) {
    $("stockFolderBtn").hidden = true;
    $("stockFolderPickBtn").hidden = true;
    $("stockAutoDelete").closest("label").hidden = true;
    $("stockDropZone").textContent = "このブラウザではフォルダ連携を使えません（PCのChrome・Edgeで使えます）。ここにCSVをドラッグ＆ドロップするか、上のボタンで選んでください。";
  }
  $("stockFolderBtn").addEventListener("click", () => loadStockFromFolder(false));
  $("stockFolderPickBtn").addEventListener("click", () => loadStockFromFolder(true));
  $("stockCsvInput").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length > 0) await ingestStockCsvFiles(files);
  });
  const drop = $("stockDropZone");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-dragover"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-dragover"); }));
  drop.addEventListener("drop", async (e) => {
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if (files.length > 0) await ingestStockCsvFiles(files);
  });

  $("stockAutoDelete").addEventListener("change", (e) => {
    localStorage.setItem(STOCK_AUTODELETE_KEY, e.target.checked ? "on" : "off");
    if (!e.target.checked) localStorage.removeItem(STOCK_AUTODELETE_CONFIRMED_KEY);
  });
  ["stockIncludePending", "stockMissingAsZero", "stockThreshold", "stockOnlyUpdate", "stockOnlyZero"].forEach((id) => {
    $(id).addEventListener("change", () => renderStockView(false));
  });
  $("stockMasterBulkBtn").addEventListener("click", bulkRegisterStockProducts);

  $("stockAmbiguous").addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="register-link"]');
    if (!btn) return;
    const row = btn.closest(".stock-ambiguous-row");
    const asin = row.querySelector('select[data-role="link-select"]').value;
    const product = stockView && stockView.rows.find((r) => r.asin === asin);
    if (!product) return;
    addProductMasterAsinEntry(product.title, stockKeywordFromName(btn.dataset.name), asin);
    renderProductMaster();
    renderStockView(false);
  });

  $("stockTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const asin = btn.dataset.asin;
    if (btn.dataset.action === "toggle-stock-preview") {
      if (stockOpenPreview.has(asin)) stockOpenPreview.delete(asin); else stockOpenPreview.add(asin);
      const row = document.querySelector(`#stockTable tr.stock-preview-row[data-asin="${CSS.escape(asin)}"]`);
      if (row) row.hidden = !stockOpenPreview.has(asin);
    } else if (btn.dataset.action === "apply-reset-date") {
      const input = document.querySelector(`#stockTable tr.stock-preview-row[data-asin="${CSS.escape(asin)}"] input[data-role="manual-date"]`);
      if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input.value)) { $("stockStatus").textContent = "リセット日は日付で指定してください。"; return; }
      const dates = getResetDates();
      dates[asin] = { resetDate: input.value, source: "manual", decidedAt: new Date().toISOString() };
      saveResetDates(dates);
      renderStockView(false);
    } else if (btn.dataset.action === "clear-reset-date") {
      const dates = getResetDates();
      delete dates[asin];
      saveResetDates(dates);
      renderStockView(false);
    }
  });

  $("stockClearDataBtn").addEventListener("click", async () => {
    if (!window.confirm("在庫リセットのデータ（リセット日・在庫の履歴・専用フォルダの設定）をすべて消去します。仕入れ記録や商品マスタは消えません。よろしいですか？")) return;
    [STOCK_RESET_DATES_KEY, STOCK_SNAPSHOTS_KEY, STOCK_AUTODELETE_CONFIRMED_KEY].forEach((k) => localStorage.removeItem(k));
    stockDirHandle = null;
    await stockIdbClear();
    stockOpenPreview.clear();
    $("stockStatus").textContent = "在庫リセットのデータを消去しました。";
    if (stockState.stockRows) renderStockView(false);
  });
}

function init() {
  fillSelect($("category"), CATEGORIES, "label");
  fillSelect($("fbaSizeTier"), FBA_TIERS, "label");

  let restored = false;
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_STATE_KEY));
    if (saved) {
      writeState(saved);
      restored = true;
    }
  } catch (e) { /* 破損データは無視してデフォルトを使う */ }

  if (!restored) {
    $("category").value = 0;
    $("referralRate").value = CATEGORIES[0].rate;
    $("fbaSizeTier").value = 0;
    $("fbaFee").value = FBA_TIERS[0].fee;
  }

  attachInputEvents();
  attachHistoryEvents();
  attachImportEvents();
  attachStockEvents();
  renderHistory();
  recalcAndRender();

  if (location.protocol !== "file:") {
    attemptSilentReconnectAll();
  }
}

document.addEventListener("DOMContentLoaded", init);
