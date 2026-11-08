"use strict";

const STORAGE_KEY = "habits-v1";
const PALETTE = ["#e8503a", "#cc7a00", "#0f9d78", "#2f6fe4", "#7c4ddb", "#d63384"];
const DAYS = 14; // how many days each chain shows
const MAX_HABITS = 12;

let habits = []; // { id, name, color, done: ["2026-11-08", ...] }
let shownDay = "";

const $ = (id) => document.getElementById(id);
const list = $("list");

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- Dates (plain "YYYY-MM-DD" text, so time zones can't move a day) ----------
const pad = (n) => String(n).padStart(2, "0");
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const today = () => dateStr(new Date());

function dayNumber(text) {
  const [y, m, d] = text.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// ---------- Streaks ----------
// The streak counts the days in a row up to today. If you haven't done it yet today, it counts up to yesterday.
function streakOf(done) {
  const set = new Set(done);
  let i = set.has(dateStr(daysAgo(0))) ? 0 : 1;
  let count = 0;
  while (set.has(dateStr(daysAgo(i)))) {
    count++;
    i++;
  }
  return count;
}

function bestStreakOf(done) {
  const days = [...new Set(done)].map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous = null;
  for (const day of days) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

// ---------- Saving ----------
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  } catch (error) {
    // Storage can be blocked. The tracker still works for this visit.
  }
}

// Returns true if something was saved before, even an empty list
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return false;
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return false;
    habits = data
      .filter((h) => h && typeof h.id === "string" && typeof h.name === "string" && h.name.trim() && /^#[0-9a-f]{6}$/i.test(h.color) && Array.isArray(h.done))
      .map((h) => ({
        id: h.id,
        name: h.name.slice(0, 40),
        color: h.color,
        done: h.done.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)),
      }))
      .slice(0, MAX_HABITS);
    return true;
  } catch (error) {
    return false;
  }
}

// ---------- Drawing ----------
function buildHabit(habit) {
  const set = new Set(habit.done);
  const doneToday = set.has(today());

  const row = el("li", "habit");
  row.style.setProperty("--c", habit.color);
  row.dataset.id = habit.id;

  // name and chain
  const main = el("div");
  const head = el("div", "habit-head");
  const remove = el("button", "remove", "Remove");
  remove.type = "button";
  remove.setAttribute("aria-label", `Remove ${habit.name}`);
  head.append(el("h2", "habit-name", habit.name), remove);

  const chain = el("div", "chain");
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = daysAgo(i);
    const key = dateStr(date);
    const isDone = set.has(key);
    const joinsPrevious = isDone && i !== DAYS - 1 && set.has(dateStr(daysAgo(i + 1)));

    const day = el("div", "day" + (i === 0 ? " today" : "") + (joinsPrevious ? " link" : ""));
    const dot = el("button", "dot");
    dot.type = "button";
    dot.dataset.date = key;
    dot.setAttribute("aria-pressed", String(isDone));
    dot.setAttribute("aria-label", `${habit.name}, ${date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`);
    day.append(dot, el("span", "day-name", i === 0 ? "Today" : date.toLocaleDateString("en-GB", { weekday: "short" })));
    chain.append(day);
  }
  main.append(head, chain);

  // streak
  const streak = streakOf(habit.done);
  const best = bestStreakOf(habit.done);
  const side = el("div", "streak");
  side.append(el("span", "streak-num" + (streak ? "" : " zero"), String(streak)), el("span", "streak-cap", "day streak"));
  if (streak > 0 && !doneToday) side.append(el("span", "streak-note", "Do it today to keep it"));
  if (best > streak) side.append(el("span", "streak-best", `Best streak ${best} ${best === 1 ? "day" : "days"}`));

  row.append(main, side);
  return row;
}

function renderHero() {
  $("date").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const total = habits.length;
  const finished = habits.filter((h) => h.done.includes(today())).length;
  if (total === 0) $("summary").textContent = "Add your first habit below.";
  else if (finished === total) $("summary").textContent = `All ${total} done today.`;
  else $("summary").textContent = `${finished} of ${total} done today.`;
}

function renderAll() {
  shownDay = today();
  list.replaceChildren(...habits.map(buildHabit));
  $("empty").hidden = habits.length > 0;
  renderHero();
}

// ---------- Actions ----------
function toggleDay(habit, date) {
  const index = habit.done.indexOf(date);
  if (index >= 0) habit.done.splice(index, 1);
  else habit.done.push(date);
  save();

  // rebuild just this habit, then pop the circle you pressed
  const fresh = buildHabit(habit);
  const old = [...list.children].find((row) => row.dataset.id === habit.id);
  if (old) old.replaceWith(fresh);
  const dot = [...fresh.querySelectorAll(".dot")].find((d) => d.dataset.date === date);
  if (dot) {
    dot.classList.add("pop");
    dot.focus();
  }
  renderHero();
}

function removeHabit(habit) {
  if (!window.confirm(`Remove "${habit.name}" and all its history? This can't be undone.`)) return;
  habits = habits.filter((h) => h.id !== habit.id);
  save();
  renderAll();
}

list.addEventListener("click", (event) => {
  const row = event.target.closest(".habit");
  if (!row) return;
  const habit = habits.find((h) => h.id === row.dataset.id);
  if (!habit) return;

  const dot = event.target.closest(".dot");
  if (dot) return toggleDay(habit, dot.dataset.date);
  if (event.target.closest(".remove")) removeHabit(habit);
});

function pickColor() {
  const used = habits.map((h) => h.color);
  return PALETTE.find((c) => !used.includes(c)) || PALETTE[habits.length % PALETTE.length];
}

$("add-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("new-name");
  const name = input.value.trim().slice(0, 40);
  if (!name) {
    $("form-note").textContent = "Type a name for your habit first.";
    input.focus();
    return;
  }
  if (habits.length >= MAX_HABITS) {
    $("form-note").textContent = `You can track up to ${MAX_HABITS} habits. Remove one to add another.`;
    return;
  }
  $("form-note").textContent = "";
  habits.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    color: pickColor(),
    done: [],
  });
  save();
  renderAll();
  input.value = "";
  input.focus();
});

$("new-name").addEventListener("input", () => {
  $("form-note").textContent = "";
});

// If the page stays open past midnight, move on to the new day
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && today() !== shownDay) renderAll();
});

// ---------- Start ----------
if (!load()) {
  habits = [
    { id: "start-read", name: "Read 10 pages", color: PALETTE[0], done: [] },
    { id: "start-study", name: "Study for one hour", color: PALETTE[2], done: [] },
    { id: "start-water", name: "Drink 2 litres of water", color: PALETTE[3], done: [] },
  ];
  save();
}
renderAll();