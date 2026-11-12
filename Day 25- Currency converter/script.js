"use strict";

/* ==========================================================
   Kobo: a currency converter
   Day 24 of 30 Days of JS. First project with fetch().
   ========================================================== */

/* ---------- Config ---------- */

// Main source: free, no API key, CORS-friendly. Needs attribution (see footer).
const PRIMARY_URL = "https://open.er-api.com/v6/latest/USD";
// Backup source if the main one is down.
const BACKUP_URL =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";

const RATES_KEY = "kobo:rates";
const PREFS_KEY = "kobo:prefs";
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000; // rates only change once a day
const TIMEOUT_MS = 8000;

const CURRENCIES = {
  NGN: "Nigerian naira",
  USD: "US dollar",
  GBP: "British pound",
  EUR: "Euro",
  CAD: "Canadian dollar",
  GHS: "Ghanaian cedi",
  ZAR: "South African rand",
  KES: "Kenyan shilling",
  AED: "UAE dirham",
  CNY: "Chinese yuan",
  INR: "Indian rupee",
  JPY: "Japanese yen",
  CHF: "Swiss franc",
  AUD: "Australian dollar",
  XOF: "West African CFA franc",
  XAF: "Central African CFA franc",
  EGP: "Egyptian pound",
  BRL: "Brazilian real",
  SAR: "Saudi riyal",
  TRY: "Turkish lira",
  MXN: "Mexican peso",
  SGD: "Singapore dollar",
  NZD: "New Zealand dollar",
  SEK: "Swedish krona",
};

// Which currencies appear in the side list (the current "from" is skipped)
const LIST_ORDER = ["NGN", "USD", "GBP", "EUR", "CAD", "GHS", "ZAR", "KES", "AED", "CNY", "INR", "JPY"];
const ZERO_DECIMALS = new Set(["JPY", "XOF", "XAF"]);

/* ---------- State and elements ---------- */

const state = {
  rates: null,      // { USD: 1, NGN: 1500, ... } all measured against 1 USD
  updatedAt: null,  // timestamp (ms) of when the rates were published
  dateOnly: false,  // the backup source only gives a date, not a time
  from: "USD",
  to: "NGN",
};

const $ = (id) => document.getElementById(id);
const els = {
  slip: $("slip"),
  alert: $("alert"),
  retry: $("retry"),
  status: $("status"),
  amountFrom: $("amount-from"),
  amountTo: $("amount-to"),
  curFrom: $("cur-from"),
  curTo: $("cur-to"),
  nameFrom: $("name-from"),
  nameTo: $("name-to"),
  swap: $("swap"),
  rate: $("rate"),
  copy: $("copy"),
  othersTitle: $("others-title"),
  others: $("others"),
};

/* ---------- Getting the rates (the fetch part) ---------- */

// fetch() never times out by itself, so we cancel it with an AbortController.
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    // fetch only rejects on network failure; a 404 or 500 still "succeeds",
    // so we have to check response.ok ourselves.
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPrimary() {
  const data = await fetchJson(PRIMARY_URL);
  if (data.result !== "success") throw new Error("Primary API returned an error");
  return {
    rates: data.rates,
    updatedAt: data.time_last_update_unix * 1000,
    dateOnly: false,
  };
}

async function fetchBackup() {
  const data = await fetchJson(BACKUP_URL);
  // This API uses lowercase codes ("ngn"), so we convert them to uppercase.
  const rates = {};
  for (const [code, value] of Object.entries(data.usd)) {
    rates[code.toUpperCase()] = value;
  }
  return {
    rates,
    updatedAt: new Date(data.date).getTime(),
    dateOnly: true,
    backup: true,
  };
}

async function getFreshRates() {
  try {
    return await fetchPrimary();
  } catch (error) {
    console.warn("Main rates source failed, trying backup:", error.message);
    return await fetchBackup();
  }
}

async function loadRates() {
  setLoading(true);
  els.alert.hidden = true;

  const saved = readSavedRates();

  // Saved rates are still fresh: no need to hit the network at all.
  if (saved && Date.now() - saved.fetchedAt < REFRESH_AFTER_MS) {
    applyRates(saved, saved.backup ? "backup" : "live");
    return;
  }

  try {
    const fresh = await getFreshRates();
    saveRates(fresh);
    applyRates(fresh, fresh.backup ? "backup" : "live");
  } catch (error) {
    console.error("Could not load rates:", error);
    if (saved) {
      applyRates(saved, "offline"); // old rates beat no rates
    } else {
      showError();
    }
  }
}

function applyRates(data, mode) {
  state.rates = data.rates;
  state.updatedAt = data.updatedAt;
  state.dateOnly = Boolean(data.dateOnly);
  setLoading(false);
  setStatus(mode);
  update("from");
}

/* ---------- Saved data (localStorage) ---------- */

function readSavedRates() {
  try {
    const saved = JSON.parse(localStorage.getItem(RATES_KEY));
    return saved && saved.rates ? saved : null;
  } catch {
    return null;
  }
}

function saveRates(data) {
  try {
    localStorage.setItem(RATES_KEY, JSON.stringify({ ...data, fetchedAt: Date.now() }));
  } catch {
    /* storage full or blocked: the app still works without it */
  }
}

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch {
    return {};
  }
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ from: state.from, to: state.to }));
  } catch {
    /* ignore */
  }
}

/* ---------- Maths and formatting ---------- */

// All rates are "per 1 USD", so from -> to is to / from.
function getRate(from, to) {
  const a = state.rates?.[from];
  const b = state.rates?.[to];
  return a && b ? b / a : NaN;
}

function parse(text) {
  const n = parseFloat(String(text).replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function formatAmount(n, code) {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "0";
  const small = Math.abs(n) < 1;
  const decimals = ZERO_DECIMALS.has(code) ? 0 : 2;
  const options = small
    ? { maximumSignificantDigits: 4 }
    : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  return new Intl.NumberFormat("en-US", options).format(n);
}

// Adds commas while typing and keeps the cursor where the user expects it.
function formatWhileTyping(input) {
  const raw = input.value;
  const caret = input.selectionStart ?? raw.length;
  // How many digits/dots sit before the cursor? We restore the cursor by that count.
  const sigBefore = raw.slice(0, caret).replace(/[^\d.]/g, "").length;

  const cleaned = raw.replace(/[^\d.]/g, "");
  const hasDot = cleaned.includes(".");
  const [intPart = "", ...rest] = cleaned.split(".");
  const decimals = rest.join("").slice(0, 4);
  const whole = intPart.replace(/^0+(?=\d)/, "").slice(0, 13);
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const output = withCommas + (hasDot ? "." + decimals : "");

  input.value = output;

  let seen = 0;
  let pos = 0;
  while (pos < output.length && seen < sigBefore) {
    if (/[\d.]/.test(output[pos])) seen++;
    pos++;
  }
  input.setSelectionRange(pos, pos);
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function formatWhen() {
  const date = new Date(state.updatedAt);
  return state.dateOnly ? dayFormat.format(date) : dateFormat.format(date);
}

/* ---------- Updating the screen ---------- */

// "source" is the side the user just edited. The other side gets recalculated.
function update(source) {
  if (!state.rates) return;
  const rate = getRate(state.from, state.to);
  if (!Number.isFinite(rate) || rate === 0) return;

  if (source === "from") {
    const amount = parse(els.amountFrom.value);
    els.amountTo.value = Number.isNaN(amount) ? "" : formatAmount(amount * rate, state.to);
  } else {
    const amount = parse(els.amountTo.value);
    els.amountFrom.value = Number.isNaN(amount) ? "" : formatAmount(amount / rate, state.from);
  }

  renderNames();
  renderRate(rate);
  renderOthers();
}

function renderNames() {
  els.nameFrom.textContent = CURRENCIES[state.from];
  els.nameTo.textContent = CURRENCIES[state.to];
}

function renderRate(rate) {
  els.rate.textContent = `1 ${state.from} = ${formatAmount(rate, state.to)} ${state.to}`;
}

function renderOthers() {
  const typed = parse(els.amountFrom.value);
  const base = Number.isNaN(typed) || typed === 0 ? 1 : typed;
  els.othersTitle.textContent = `${formatAmount(base, state.from)} ${state.from} in other currencies`;

  const items = LIST_ORDER.filter((code) => code !== state.from)
    .slice(0, 8)
    .map((code) => {
      const value = base * getRate(state.from, code);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "other";
      button.dataset.code = code;

      const codeEl = document.createElement("span");
      codeEl.className = "other-code";
      codeEl.textContent = code;

      const nameEl = document.createElement("span");
      nameEl.className = "other-name";
      nameEl.textContent = CURRENCIES[code];

      const valueEl = document.createElement("span");
      valueEl.className = "other-value";
      valueEl.textContent = formatAmount(value, code);

      button.append(codeEl, nameEl, valueEl);

      const li = document.createElement("li");
      li.append(button);
      return li;
    });

  els.others.replaceChildren(...items);
}

function setLoading(isLoading) {
  els.slip.classList.toggle("is-loading", isLoading);
  els.slip.setAttribute("aria-busy", String(isLoading));
  if (isLoading) setStatus("loading");
}

function setStatus(mode) {
  const messages = {
    loading: "Fetching rates…",
    live: `Rates updated ${state.updatedAt ? formatWhen() : ""}`,
    backup: `Backup source, rates from ${state.updatedAt ? formatWhen() : ""}`,
    offline: `Offline, using rates saved from ${state.updatedAt ? formatWhen() : ""}`,
    error: "No rates available",
  };
  els.status.dataset.state = mode;
  els.status.textContent = messages[mode];
}

function showError() {
  setLoading(false);
  setStatus("error");
  els.alert.hidden = false;
}

/* ---------- Events ---------- */

function fillSelect(select) {
  const options = Object.keys(CURRENCIES).map((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    return option;
  });
  select.replaceChildren(...options);
}

function onAmountInput(event, side) {
  formatWhileTyping(event.target);
  update(side);
}

els.amountFrom.addEventListener("input", (e) => onAmountInput(e, "from"));
els.amountTo.addEventListener("input", (e) => onAmountInput(e, "to"));

els.curFrom.addEventListener("change", () => {
  state.from = els.curFrom.value;
  savePrefs();
  update("from");
});

els.curTo.addEventListener("change", () => {
  state.to = els.curTo.value;
  savePrefs();
  update("from");
});

els.swap.addEventListener("click", () => {
  const oldTo = els.amountTo.value;
  [state.from, state.to] = [state.to, state.from];
  els.curFrom.value = state.from;
  els.curTo.value = state.to;
  if (oldTo) els.amountFrom.value = oldTo;
  els.swap.classList.toggle("is-flipped");
  savePrefs();
  update("from");
});

els.others.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-code]");
  if (!button) return;
  state.to = button.dataset.code;
  els.curTo.value = state.to;
  savePrefs();
  update("from");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  els.slip.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
});

els.copy.addEventListener("click", async () => {
  if (!els.amountTo.value) return;
  try {
    await navigator.clipboard.writeText(`${els.amountTo.value} ${state.to}`);
    els.copy.textContent = "Copied";
  } catch {
    els.copy.textContent = "Couldn't copy";
  }
  setTimeout(() => (els.copy.textContent = "Copy"), 1500);
});

els.retry.addEventListener("click", loadRates);

/* ---------- Start ---------- */

function init() {
  fillSelect(els.curFrom);
  fillSelect(els.curTo);

  const prefs = loadPrefs();
  if (CURRENCIES[prefs.from]) state.from = prefs.from;
  if (CURRENCIES[prefs.to]) state.to = prefs.to;
  els.curFrom.value = state.from;
  els.curTo.value = state.to;

  renderNames();
  loadRates();
}

init();