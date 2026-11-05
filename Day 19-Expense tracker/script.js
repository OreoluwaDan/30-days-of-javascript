"use strict";

const STORAGE_KEY = "expense-tracker-v1";

const CATEGORIES = [
  { id: "food", label: "Food", color: "#c2703a" },
  { id: "transport", label: "Transport", color: "#3d6f8e" },
  { id: "data", label: "Data & airtime", color: "#7d6a9a" },
  { id: "bills", label: "Rent & bills", color: "#a8483a" },
  { id: "shopping", label: "Shopping", color: "#c79a2e" },
  { id: "health", label: "Health", color: "#4a8a6a" },
  { id: "fun", label: "Fun", color: "#b8607a" },
  { id: "other", label: "Other", color: "#8a8579" },
];

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const fmt = (n) => money.format(n);

let expenses = []; // { id, amount, category, note, date: "YYYY-MM-DD" }
let budget = 0;
let month = thisMonth();
let filter = null; // a category id, or null for all
let lastDeleted = null;
let toastTimer = null;

const $ = (id) => document.getElementById(id);

// Builds an element. Text goes in with textContent, so nothing typed can run as HTML.
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// ---------- Dates (kept as plain "YYYY-MM-DD" text so time zones can't shift them) ----------
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function thisMonth() {
  return todayStr().slice(0, 7);
}

const monthOf = (date) => date.slice(0, 7);

function shiftMonth(m, by) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(m) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en", { month: "long", year: "numeric" });
}

function shortDate(date) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en", { day: "numeric", month: "short" });
}

function daysCounted(m) {
  const [y, mo] = m.split("-").map(Number);
  if (m === thisMonth()) return Number(todayStr().slice(8, 10));
  return new Date(y, mo, 0).getDate();
}

// ---------- Saving ----------
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ expenses, budget }));
  } catch (error) {
    // Storage can be blocked. The tracker still works for this visit.
  }
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!data) return;
    if (Array.isArray(data.expenses)) {
      expenses = data.expenses.filter(
        (e) =>
          e &&
          typeof e.id === "string" &&
          Number.isFinite(e.amount) &&
          e.amount > 0 &&
          typeof e.note === "string" &&
          CATEGORIES.some((c) => c.id === e.category) &&
          /^\d{4}-\d{2}-\d{2}$/.test(e.date)
      );
    }
    if (Number.isFinite(data.budget) && data.budget >= 0) budget = data.budget;
  } catch (error) {
    // Nothing saved yet, or it was unreadable: start fresh
  }
}

// ---------- The form ----------
function parseAmount(text) {
  const n = Number(String(text).replace(/[,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 1e9) return null;
  return Math.round(n * 100) / 100;
}

function buildCategoryChoices() {
  $("cat-list").replaceChildren(
    ...CATEGORIES.map((cat, i) => {
      const label = el("label", "cat");
      const input = el("input");
      input.type = "radio";
      input.name = "category";
      input.value = cat.id;
      input.checked = i === 0;
      const chip = el("span");
      const dot = el("i", "dot");
      dot.style.background = cat.color;
      chip.append(dot, cat.label);
      label.append(input, chip);
      return label;
    })
  );
}

$("form").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = parseAmount($("amount").value);
  if (amount === null) {
    $("error").textContent = "Enter an amount above 0.";
    $("amount").focus();
    return;
  }
  $("error").textContent = "";

  const date = /^\d{4}-\d{2}-\d{2}$/.test($("date").value) ? $("date").value : todayStr();
  expenses.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    amount,
    category: $("form").elements.category.value,
    note: $("note").value.trim().slice(0, 60),
    date,
  });

  $("amount").value = "";
  $("note").value = "";
  month = monthOf(date); // jump to the month the expense belongs to
  filter = null;
  save();
  render(true);
  $("amount").focus();
});

$("amount").addEventListener("input", () => {
  $("error").textContent = "";
});

// ---------- Budget ----------
$("budget").addEventListener("change", () => {
  const text = $("budget").value.trim();
  budget = text === "" ? 0 : parseAmount(text) || 0;
  $("budget").value = budget ? String(budget) : "";
  save();
  render(false);
});

$("budget").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("budget").blur();
});

// ---------- Months ----------
$("prev").addEventListener("click", () => {
  month = shiftMonth(month, -1);
  filter = null;
  render(true);
});

$("next").addEventListener("click", () => {
  if (month >= thisMonth()) return;
  month = shiftMonth(month, 1);
  filter = null;
  render(true);
});

// ---------- Delete and undo ----------
function removeExpense(id) {
  const index = expenses.findIndex((e) => e.id === id);
  if (index === -1) return;
  const [item] = expenses.splice(index, 1);
  lastDeleted = { item, index };
  save();
  render(false);
  toast(`Deleted ${fmt(item.amount)}`, true);
}

function undoDelete() {
  if (!lastDeleted) return;
  expenses.splice(Math.min(lastDeleted.index, expenses.length), 0, lastDeleted.item);
  month = monthOf(lastDeleted.item.date);
  lastDeleted = null;
  hideToast();
  save();
  render(false);
}

function toast(message, withUndo) {
  const box = $("toast");
  clearTimeout(toastTimer);
  box.replaceChildren(el("span", "", message));
  if (withUndo) {
    const undo = el("button", "", "Undo");
    undo.type = "button";
    undo.addEventListener("click", undoDelete);
    box.append(undo);
  }
  box.classList.add("is-visible");
  toastTimer = setTimeout(hideToast, 5000);
}

function hideToast() {
  clearTimeout(toastTimer);
  $("toast").classList.remove("is-visible");
}

// ---------- Drawing the screen ----------
function monthExpenses() {
  return expenses.filter((e) => monthOf(e.date) === month);
}

function renderHeader() {
  $("month-label").textContent = monthLabel(month);
  $("sum-month").textContent = monthLabel(month);
  $("next").disabled = month >= thisMonth();
}

function renderSummary(items, total) {
  $("total").textContent = fmt(total);

  if (total > 0) {
    const average = total / daysCounted(month);
    $("meta").textContent = `${items.length} ${items.length === 1 ? "expense" : "expenses"}, about ${fmt(Math.round(average))} a day`;
  } else {
    $("meta").textContent = "Nothing logged this month yet.";
  }

  if (document.activeElement !== $("budget")) $("budget").value = budget ? String(budget) : "";

  const meter = $("meter");
  const note = $("budget-note");
  note.classList.remove("is-over");
  meter.classList.remove("is-close", "is-over");

  if (!budget) {
    meter.hidden = true;
    note.textContent = "";
    return;
  }

  meter.hidden = false;
  const used = total / budget;
  $("meter-fill").style.width = Math.min(100, used * 100) + "%";
  if (used > 1) {
    meter.classList.add("is-over");
    note.classList.add("is-over");
    note.textContent = `${fmt(total - budget)} over your budget`;
  } else {
    if (used >= 0.85) meter.classList.add("is-close");
    note.textContent = `${fmt(budget - total)} left of your budget`;
  }
}

function renderChart(items, total, animate) {
  const totals = {};
  for (const e of items) totals[e.category] = (totals[e.category] || 0) + e.amount;
  if (filter && !totals[filter]) filter = null;

  const rows = CATEGORIES.filter((c) => totals[c.id]).sort((a, b) => totals[b.id] - totals[a.id]);
  $("chart-empty").hidden = rows.length > 0;

  $("chart").replaceChildren(
    ...rows.map((cat) => {
      const share = totals[cat.id] / total;
      const percent = share < 0.01 ? "<1%" : Math.round(share * 100) + "%";

      const button = el("button", "bar-row");
      button.type = "button";
      button.setAttribute("aria-pressed", String(filter === cat.id));
      button.title = filter === cat.id ? "Show all categories" : `Show only ${cat.label}`;

      const dot = el("i", "dot");
      dot.style.background = cat.color;
      const name = el("span", "bar-name");
      name.append(dot, cat.label);
      const top = el("span", "bar-top");
      top.append(name, el("span", "bar-val", `${fmt(totals[cat.id])} · ${percent}`));

      const fill = el("span", "fill");
      fill.style.background = cat.color;
      fill.dataset.width = share * 100 + "%";
      const track = el("span", "track");
      track.append(fill);

      button.append(top, track);
      button.addEventListener("click", () => {
        filter = filter === cat.id ? null : cat.id;
        render(false);
      });
      return button;
    })
  );

  const fills = document.querySelectorAll("#chart .fill");
  if (animate) {
    requestAnimationFrame(() => requestAnimationFrame(() => fills.forEach((f) => (f.style.width = f.dataset.width))));
  } else {
    fills.forEach((f) => (f.style.width = f.dataset.width));
  }
}

function renderList(items) {
  const shown = items
    .map((e) => ({ e, i: expenses.indexOf(e) }))
    .filter(({ e }) => !filter || e.category === filter)
    .sort((a, b) => b.e.date.localeCompare(a.e.date) || b.i - a.i);

  const filterNote = $("filter-note");
  if (filter) {
    filterNote.hidden = false;
    const clear = el("button", "", "Show all");
    clear.type = "button";
    clear.addEventListener("click", () => {
      filter = null;
      render(false);
    });
    filterNote.replaceChildren(`Showing ${catOf(filter).label} only`, clear);
  } else {
    filterNote.hidden = true;
  }

  const empty = $("empty");
  empty.hidden = shown.length > 0;
  if (!shown.length) {
    empty.textContent = items.length ? "No expenses in this category." : `No expenses in ${monthLabel(month)}. Add one on the left.`;
  }

  $("list").replaceChildren(
    ...shown.map(({ e }) => {
      const cat = catOf(e.category);
      const name = e.note || cat.label;

      const what = el("div", "row-what");
      what.append(el("span", "row-name", name));
      if (e.note) {
        const dot = el("i", "dot");
        dot.style.background = cat.color;
        const sub = el("span", "row-cat");
        sub.append(dot, cat.label);
        what.append(sub);
      }

      const del = el("button", "del", "\u00d7");
      del.type = "button";
      del.setAttribute("aria-label", `Delete ${name}, ${fmt(e.amount)}`);
      del.addEventListener("click", () => removeExpense(e.id));

      const row = el("li", "row");
      row.append(el("span", "row-date", shortDate(e.date)), what, el("span", "row-amount", fmt(e.amount)), del);
      return row;
    })
  );
}

function render(animate = false) {
  const items = monthExpenses();
  const total = items.reduce((sum, e) => sum + e.amount, 0);
  renderHeader();
  renderSummary(items, total);
  renderChart(items, total, animate);
  renderList(items);
}

// ---------- Start ----------
load();
buildCategoryChoices();
$("date").value = todayStr();
render(true);