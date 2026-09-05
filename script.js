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
    monthlyUnits: num("monthlyUnits"),
    leadTimeDays: num("leadTimeDays", 14),
    paymentCycleDays: num("paymentCycleDays", 14),
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
  $("monthlyUnits").value = s.monthlyUnits;
  $("leadTimeDays").value = s.leadTimeDays;
  $("paymentCycleDays").value = s.paymentCycleDays;
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

  if (s.monthlyUnits > 0) {
    result.monthly = {
      monthlyProfit: netProfit * s.monthlyUnits,
      initialCapital: purchaseCostTotal * s.monthlyUnits,
      cashCycleDays: s.leadTimeDays + s.paymentCycleDays,
    };
  }

  return result;
}

function render(s, result) {
  renderHeadline(s, result);
  renderMetrics(result);
  renderBreakdown(result);
  renderMonthly(result);
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

function renderMonthly(result) {
  const card = $("monthlyCard");
  if (result.status !== "ok" || !result.monthly) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const m = result.monthly;
  const items = [
    ["月次純利益（見込み）", yen(m.monthlyProfit)],
    ["必要な仕入れ資金（初期投資額）", yen(m.initialCapital)],
    ["資金回収までの目安日数", `${m.cashCycleDays} 日`],
  ];
  $("monthlyGrid").innerHTML = items.map(([label, value]) => `
    <div class="metric">
      <span class="metric__label">${label}</span>
      <span class="metric__value">${value}</span>
    </div>
  `).join("");
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
      <td>${entry.savedAt}</td>
      <td>${entry.productName || "（名称未設定）"}</td>
      <td>${entry.mode === "reverse" ? "仕入れ単価を計算" : "利益を計算"}</td>
      <td>${entry.summary}</td>
      <td>
        <button type="button" class="btn" data-action="load" data-id="${entry.id}">呼び出す</button>
        <button type="button" class="btn btn--danger" data-action="delete" data-id="${entry.id}">削除</button>
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
  const withBreaks = html.replace(/<(br|\/p|\/tr|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n");
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
  const re = /(?:\/dp\/|\/gp\/product\/|[?&]asin=)([A-Z0-9]{10})/g;
  const found = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(rawInput)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); found.push(m[1]); }
  }
  return found;
}

/**
 * Amazonのメール書式は改定されうるため厳密な単一パターンには依存せず、
 * 「価格らしき行」と「数量らしき行」を近接ペアリングする緩い方式にしている。
 * 誤読の可能性を前提に、結果は必ず編集可能な形でユーザーに確認してもらう。
 */
function parseAmazonOrderEmail(rawInput) {
  const looksHtml = /<[a-z][\s\S]*>/i.test(rawInput);
  let text = looksHtml ? stripHtml(rawInput) : rawInput;

  // 「もう一度買う」等のおすすめ商品欄は注文内容と無関係な商品・価格を大量に
  // 含むため、そこから先(フッター含む)は解析対象から除外する。
  const recommendationCutoffRe = /もう一度買う|おすすめ商品|よく一緒に購入されている商品|この商品を買った人はこんな商品も買っています/;
  const cutoffMatch = text.match(recommendationCutoffRe);
  if (cutoffMatch) {
    text = text.slice(0, cutoffMatch.index);
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  const priceRe = /[¥￥]\s?([\d,]{2,})/;
  const qtyRe = /(?:数量|個数)[:：]?\s*(\d+)|×\s?(\d+)\s*$/;
  const dividerRe = /^[-=_~･・…\s]{3,}$/;
  const nonNameRe = /^(注文|合計|小計|配送|消費税|お届け|数量|ご注文|お支払い|送信先|お届け先|発送|配達)/;

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
    price,
    quantity: findNearbyQty(i),
    isUnitPrice: false,
    asin: "",
  }));

  const asins = extractAsinsInOrder(rawInput);
  if (asins.length === items.length) {
    items.forEach((item, idx) => { item.asin = asins[idx]; });
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
  $("gmailFetchBtn").addEventListener("click", gmailFetchOrders);
  $("gmailDisconnectBtn").addEventListener("click", () => {
    delete connectedAccounts[currentAccountEmail];
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
  ensureGisLoaded(() => {
    try {
      if (!googleTokenClient) {
        googleTokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_SCOPES,
          callback: async (resp) => {
            if (resp.error) {
              $("gmailStatus").textContent = "連携に失敗しました: " + resp.error;
              return;
            }
            try {
              const email = await fetchAccountEmail(resp.access_token);
              connectedAccounts[email] = resp.access_token;
              googleAccessToken = resp.access_token;
              currentAccountEmail = email;
              $("gmailStatus").textContent = "";
              $("gmailNotConnected").hidden = true;
              $("gmailConnected").hidden = false;
              renderAccountSwitcher();
              gmailFetchOrders();
            } catch (e) {
              $("gmailStatus").textContent = "アカウント情報の取得に失敗しました: " + e.message;
            }
          },
        });
      }
      googleTokenClient.requestAccessToken(forceAccountPicker ? { prompt: "select_account" } : {});
    } catch (e) {
      $("gmailStatus").textContent = "クライアントIDが正しくない可能性があります: " + e.message;
    }
  }, () => {
    $("gmailStatus").textContent = "Googleの認証ライブラリを読み込めませんでした。http/https経由でこのページを開いているかご確認ください。";
  });
}

/**
 * Gmail/Sheets/Drive共通のfetchラッパー。アクセストークンは1時間程度で
 * 失効するため、401時は状態をクリアして再連携を促す（cryptic なエラーで
 * 止まらせない）。
 */
/**
 * tokenOverrideを渡すと、現在選択中のアカウント以外(期間集計での複数
 * アカウント横断読み込みなど)のトークンで呼び出せる。省略時は現在選択中の
 * アカウントのトークンを使う。
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

async function fetchPurchaseRecords(token, email, forceRefresh) {
  if (cachedRecordsByEmail[email] && !forceRefresh) return cachedRecordsByEmail[email];
  const sheetId = await ensurePurchaseSheet(token, email);
  const res = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET_TAB + "!A2:H100000")}`, {}, token);
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || "読み込みに失敗しました");
  const rows = json.values || [];
  const records = rows
    .map((r) => ({
      date: r[0] || "",
      name: r[1] || "",
      asin: r[2] || "",
      quantity: parseFloat(r[3]) || 0,
      unitPrice: parseFloat(r[4]) || 0,
      amount: parseFloat(r[5]) || 0,
      source: r[6] || "",
      orderNumber: r[7] || "",
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
    const key = r.asin || r.name;
    if (!groups.has(key)) groups.set(key, { name: r.name, asin: r.asin, quantity: 0, amount: 0 });
    const g = groups.get(key);
    g.quantity += r.quantity;
    g.amount += r.amount;
    if (!g.asin && r.asin) g.asin = r.asin;
  });

  return Array.from(groups.values())
    .map((g) => ({ ...g, weightedAvgPrice: g.quantity > 0 ? g.amount / g.quantity : 0 }))
    .sort((a, b) => b.amount - a.amount);
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
  table.innerHTML = `
    <thead><tr><th>商品名</th><th>数量計</th><th>金額計</th><th>加重平均単価</th><th></th></tr></thead>
    <tbody>${groups.map((g, idx) => `
      <tr>
        <td>${escapeHtml(g.name)}${g.asin ? `<br><small>${escapeHtml(g.asin)}</small>` : ""}</td>
        <td>${g.quantity}</td>
        <td>${yen(g.amount)}</td>
        <td><strong>${yen(g.weightedAvgPrice)}</strong></td>
        <td><button type="button" class="btn btn--primary" data-action="use-period-avg" data-idx="${idx}">計算ツールへ反映</button></td>
      </tr>
    `).join("")}</tbody>
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

function setPeriodPreset(preset) {
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

function attachPeriodEvents() {
  document.querySelectorAll(".period-presets .btn").forEach((btn) => {
    btn.addEventListener("click", () => setPeriodPreset(btn.dataset.preset));
  });
  $("periodCalcBtn").addEventListener("click", () => runPeriodAggregation(false));
  $("periodRefreshBtn").addEventListener("click", () => runPeriodAggregation(true));
  $("periodTable").addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="use-period-avg"]');
    if (!btn) return;
    usePeriodAverage(parseInt(btn.dataset.idx, 10));
  });
}

/* ---------------- 初期化 ---------------- */

function attachInputEvents() {
  const ids = [
    "sellPrice", "taxRate", "referralRate", "closingFee", "fbaFee", "storageFee",
    "acos", "returnRate", "purchasePrice", "purchaseTaxExcluded", "shippingIn",
    "customs", "inspection", "fbaShip", "otherCost", "targetMarginPct", "targetRoiPct",
    "monthlyUnits", "leadTimeDays", "paymentCycleDays",
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
  renderHistory();
  recalcAndRender();
}

document.addEventListener("DOMContentLoaded", init);
