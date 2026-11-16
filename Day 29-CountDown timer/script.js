"use strict";

/* ==========================================================
   Countdown: count down to any date, or up from it once it passes.
   30 Days of JS.
   ========================================================== */

const KEY = "countdown:v1";
const MAX_EVENTS = 6;
const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;
const LABELS = { d: ["day", "days"], h: ["hour", "hours"], m: ["minute", "minutes"], s: ["second", "seconds"] };

const $ = (id) => document.getElementById(id);
const els = {
  name: $("ev-name"), when: $("when"), track: $("track"), fill: $("fill"), note: $("note"),
  form: $("form"), fName: $("f-name"), fDate: $("f-date"), fTime: $("f-time"),
  error: $("error"), list: $("list"),
};

const units = {};
document.querySelectorAll(".unit").forEach((el) => {
  units[el.dataset.unit] = { num: el.querySelector(".num"), lab: el.querySelector(".lab") };
});

const longDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
});
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/* ---------- Saved data ---------- */

function makeEvent(name, target) {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, target, created: Date.now() };
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    const events = (saved?.events || []).filter(
      (e) => e && e.id && typeof e.name === "string" && Number.isFinite(e.target) && Number.isFinite(e.created)
    );
    if (events.length) {
      const active = events.some((e) => e.id === saved.active) ? saved.active : events[0].id;
      return { events, active };
    }
  } catch {
    /* fall through to the default */
  }
  // First visit: count down to the next New Year.
  const first = makeEvent("New Year", new Date(new Date().getFullYear() + 1, 0, 1).getTime());
  return { events: [first], active: first.id };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage blocked: the clock still works for this visit */
  }
}

let data = loadData();
const current = () => data.events.find((e) => e.id === data.active);

/* ---------- The clock ---------- */

function tick() {
  const ev = current();
  const now = Date.now();
  const diff = ev.target - now;
  const past = diff <= 0;
  const abs = Math.abs(diff); // after the date, we count up instead

  const v = {
    d: Math.floor(abs / DAY),
    h: Math.floor((abs % DAY) / HOUR),
    m: Math.floor((abs % HOUR) / MIN),
    s: Math.floor((abs % MIN) / SEC),
  };
  for (const key of Object.keys(units)) {
    units[key].num.textContent = String(v[key]).padStart(key === "d" ? 1 : 2, "0");
    units[key].lab.textContent = LABELS[key][v[key] === 1 ? 0 : 1];
  }

  els.track.hidden = past;
  if (past) {
    els.note.textContent = "This moment has passed. The clock now counts up from it.";
  } else {
    const pct = Math.min(100, Math.max(0, ((now - ev.created) / (ev.target - ev.created)) * 100));
    els.fill.style.width = `${pct}%`;
    els.track.setAttribute("aria-valuenow", Math.round(pct));
    els.note.textContent = `${Math.floor(pct)}% of the wait is done.`;
  }

  document.title = past
    ? `${ev.name}: ${v.d}d ago`
    : `${v.d}d ${v.h}h ${v.m}m to ${ev.name}`;
}

// Fire just after each whole second so the display doesn't drift.
function loop() {
  tick();
  setTimeout(loop, SEC - (Date.now() % SEC) + 5);
}

/* ---------- Rendering the rest ---------- */

function renderStatic() {
  const ev = current();
  els.name.textContent = ev.name;
  els.when.textContent = longDate.format(ev.target);

  const items = data.events.map((e) => {
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "pick";
    pick.dataset.pick = e.id;
    pick.setAttribute("aria-current", String(e.id === data.active));
    const name = Object.assign(document.createElement("span"), { className: "pick-name", textContent: e.name });
    const date = Object.assign(document.createElement("span"), { className: "pick-date", textContent: shortDate.format(e.target) });
    pick.append(name, date);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "del";
    del.dataset.del = e.id;
    del.textContent = "×";
    del.setAttribute("aria-label", `Remove ${e.name}`);
    del.disabled = data.events.length === 1;

    const li = document.createElement("li");
    li.append(pick, del);
    return li;
  });
  els.list.replaceChildren(...items);
}

function show(id) {
  data.active = id;
  save();
  renderStatic();
  tick();
}

/* ---------- Events ---------- */

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  els.error.textContent = "";

  if (!els.fDate.value) {
    els.error.textContent = "Pick a date for the countdown.";
    els.fDate.focus();
    return;
  }
  // "2027-01-01T09:00" is read as local time, which is what we want.
  const target = new Date(`${els.fDate.value}T${els.fTime.value || "00:00"}`).getTime();
  if (!Number.isFinite(target)) {
    els.error.textContent = "That date doesn't look right. Try again.";
    return;
  }

  const ev = makeEvent(els.fName.value.trim().slice(0, 40) || "My event", target);
  data.events.unshift(ev);
  data.events = data.events.slice(0, MAX_EVENTS);
  els.form.reset();
  show(ev.id);

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
});

els.list.addEventListener("click", (event) => {
  const pick = event.target.closest("[data-pick]");
  if (pick) return show(pick.dataset.pick);

  const del = event.target.closest("[data-del]");
  if (del && data.events.length > 1) {
    data.events = data.events.filter((e) => e.id !== del.dataset.del);
    if (!current()) data.active = data.events[0].id;
    save();
    renderStatic();
    tick();
  }
});

/* ---------- Start ---------- */

renderStatic();
loop();
