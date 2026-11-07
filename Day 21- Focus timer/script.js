"use strict";

const MODES = {
  focus: { label: "Focus", color: "#ff5a3c", glow: "rgba(255, 90, 60, 0.45)" },
  short: { label: "Short break", color: "#2dd4b0", glow: "rgba(45, 212, 176, 0.4)" },
  long: { label: "Long break", color: "#7c8cff", glow: "rgba(124, 140, 255, 0.45)" },
};
const SETTINGS_KEY = "pomodoro-settings-v1";
const LOG_KEY = "pomodoro-log-v1";
const STATE_KEY = "pomodoro-state-v1";
const DEFAULTS = { focus: 25, short: 5, long: 15, sound: true, task: "", auto: false, goal: 8 };

const $ = (id) => document.getElementById(id);
const rootStyle = document.documentElement.style;
const sheet = $("sheet");
const arcs = [...document.querySelectorAll(".arc")];
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pad = (n) => String(n).padStart(2, "0");

let settings = { ...DEFAULTS };
let log = {}; // { "2026-11-07": { sessions, minutes, tasks: [{ name, count }] } }

let mode = "focus";
let total = 0; // length of this session in milliseconds
let remaining = 0; // time left in milliseconds
let running = false;
let endAt = 0; // the moment the timer will hit zero
let timer = null;
let note = ""; // a message that replaces the status line
let audio = null;
let calmTimer = null;
let flashTimer = null;
let wake = null;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- Dates ----------
function dateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const today = () => dateStr(new Date());

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ---------- Saving and loading ----------
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    // Storage can be blocked. The timer still works.
  }
}

function saveLog() {
  const keys = Object.keys(log).sort();
  while (keys.length > 120) delete log[keys.shift()]; // keep about four months
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch (error) {
    // Storage can be blocked. The timer still works.
  }
}

// The running timer is saved too, so a refresh or an accidental close doesn't lose it
function saveState() {
  try {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ mode, total, remaining: running ? Math.max(0, endAt - Date.now()) : remaining, running, endAt })
    );
  } catch (error) {
    // Storage can be blocked. The timer still works.
  }
}

function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!data) return;
    for (const key of ["focus", "short", "long"]) {
      if (Number.isFinite(data[key]) && data[key] >= 0.1 && data[key] <= 180) settings[key] = data[key];
    }
    if (typeof data.sound === "boolean") settings.sound = data.sound;
    if (typeof data.auto === "boolean") settings.auto = data.auto;
    if (Number.isInteger(data.goal) && data.goal >= 1 && data.goal <= 50) settings.goal = data.goal;
    if (typeof data.task === "string") settings.task = data.task.slice(0, 50);
  } catch (error) {
    // Nothing saved yet
  }
}

function loadLog() {
  try {
    const data = JSON.parse(localStorage.getItem(LOG_KEY));
    if (!data || typeof data !== "object") return;
    for (const [key, day] of Object.entries(data)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !day || !Number.isInteger(day.sessions) || !Number.isFinite(day.minutes)) continue;
      const tasks = Array.isArray(day.tasks)
        ? day.tasks
            .filter((t) => t && typeof t.name === "string" && Number.isInteger(t.count) && t.count > 0)
            .map((t) => ({ name: t.name.slice(0, 50), count: t.count }))
        : [];
      log[key] = { sessions: Math.max(0, day.sessions), minutes: Math.max(0, day.minutes), tasks };
    }
  } catch (error) {
    // Nothing saved yet
  }
}

function addSession(task, minutes) {
  const key = today();
  const day = log[key] || { sessions: 0, minutes: 0, tasks: [] };
  let name = task || "No task";
  let entry = day.tasks.find((t) => t.name === name);
  if (!entry && day.tasks.length >= 30) {
    name = "Other";
    entry = day.tasks.find((t) => t.name === name);
  }
  if (entry) entry.count++;
  else day.tasks.push({ name, count: 1 });
  day.sessions++;
  day.minutes += minutes;
  log[key] = day;
  saveLog();
}

const sessionsToday = () => (log[today()] ? log[today()].sessions : 0);

const dots = $("dots");
for (let i = 0; i < 4; i++) dots.append(document.createElement("i"));

// ---------- Drawing ----------
const nextNumber = () => (sessionsToday() % 4) + 1;

function statusText() {
  if (note) return note;
  if (!running && remaining < total) return "Paused";
  return mode === "focus" ? `Session ${nextNumber()} of 4` : `Next: session ${nextNumber()} of 4`;
}

function toggleText() {
  if (running) return "Pause";
  if (remaining < total) return "Resume";
  return mode === "focus" ? "Start focus" : "Start break";
}

function render() {
  const secs = Math.ceil(remaining / 1000);
  const mm = pad(Math.floor(secs / 60));
  const ss = pad(secs % 60);

  $("time").textContent = `${mm}:${ss}`;
  $("time").classList.toggle("wide", mm.length > 2);
  $("mode-label").textContent = MODES[mode].label;
  $("status").textContent = statusText();

  const left = total ? Math.min(1, remaining / total) : 1;
  arcs.forEach((arc) => {
    arc.style.strokeDasharray = `${(left * 1000).toFixed(2)} 1000`;
    arc.classList.toggle("off", remaining <= 0);
  });

  $("toggle-label").textContent = toggleText();
  $("sr-time").textContent = `${MODES[mode].label}, ${Math.floor(secs / 60)} minutes ${secs % 60} seconds left`;

  if (!flashTimer) {
    if (running) document.title = `${mm}:${ss} ${MODES[mode].label}`;
    else if (remaining < total) document.title = `Paused ${mm}:${ss}`;
    else document.title = "Pomodoro timer";
  }
}

function updateTally() {
  const done = sessionsToday();
  const filled = done === 0 ? 0 : done % 4 === 0 ? 4 : done % 4;
  [...dots.children].forEach((dot, i) => dot.classList.toggle("on", i < filled));
  $("count").textContent = done === 1 ? "1 session today" : `${done} sessions today`;
  $("tally").setAttribute("aria-label", `${done} focus ${done === 1 ? "session" : "sessions"} today. Open your progress`);
}

function updateSoundButton() {
  const on = settings.sound;
  $("sound").setAttribute("aria-label", on ? "Sound on" : "Sound off");
  $("sound").setAttribute("aria-pressed", String(on));
  $("waves").hidden = !on;
  $("slash").hidden = on;
}

// The ring refills slowly after a reset or a mode change, then goes back to moving smoothly with the clock
function smooth(refill) {
  clearTimeout(calmTimer);
  if (refill && !reduced()) {
    rootStyle.setProperty("--dur", "1s");
    rootStyle.setProperty("--ease", "cubic-bezier(0.2, 0.8, 0.2, 1)");
    calmTimer = setTimeout(calm, 1050);
  } else {
    calm();
  }
}

function calm() {
  rootStyle.setProperty("--dur", reduced() ? "0s" : "0.2s");
  rootStyle.setProperty("--ease", "linear");
}

// ---------- Keeping the screen on, and alerts when the tab is hidden ----------
async function holdWake() {
  try {
    if ("wakeLock" in navigator && !wake) {
      wake = await navigator.wakeLock.request("screen");
      wake.addEventListener("release", () => {
        wake = null;
      });
    }
  } catch (error) {
    // Not allowed or not supported. The timer still works.
  }
}

function releaseWake() {
  try {
    if (wake) wake.release();
  } catch (error) {
    // Nothing to release
  }
  wake = null;
}

function flashTitle(message) {
  clearInterval(flashTimer);
  let on = false;
  flashTimer = setInterval(() => {
    on = !on;
    document.title = on ? "Time is up" : message;
  }, 1000);
}

function stopFlash() {
  if (!flashTimer) return;
  clearInterval(flashTimer);
  flashTimer = null;
  render();
}

function alertUser(message) {
  if (!document.hidden) return;
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Pomodoro timer", { body: message, tag: "pomodoro" });
    }
  } catch (error) {
    // Some browsers don't allow notifications from a page. The title flash still works.
  }
  flashTitle(message);
}

// ---------- The timer ----------
function setMode(next) {
  clearInterval(timer);
  running = false;
  releaseWake();
  mode = next;
  total = remaining = Math.round(settings[next] * 60000);
  note = "";
  rootStyle.setProperty("--accent", MODES[next].color);
  rootStyle.setProperty("--glow", MODES[next].glow);
  document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === next)));
  smooth(true);
  render();
  saveState();
}

// Switching mode in the middle of a session would throw it away, so ask first
function switchMode(next) {
  if (next === mode) return;
  if ((running || remaining < total) && !window.confirm("Switch now? Your current timer will be lost.")) return;
  setMode(next);
}

function start(quiet) {
  if (running) return;
  if (!quiet) {
    ensureAudio();
    try {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    } catch (error) {
      // Asking is optional
    }
  }
  note = "";
  endAt = Date.now() + remaining;
  running = true;
  clearInterval(timer);
  timer = setInterval(tick, 100);
  smooth(false);
  holdWake();
  render();
  saveState();
}

function pause() {
  if (!running) return;
  remaining = Math.max(0, endAt - Date.now());
  running = false;
  clearInterval(timer);
  releaseWake();
  render();
  saveState();
}

function reset() {
  clearInterval(timer);
  running = false;
  releaseWake();
  remaining = total;
  note = "";
  smooth(true);
  render();
  saveState();
}

function skip() {
  const midway = running || remaining < total;
  if (mode === "focus" && midway && !window.confirm("Skip this focus session? It won't be counted.")) return;
  setMode(mode === "focus" ? "short" : "focus");
}

function tick() {
  remaining = Math.max(0, endAt - Date.now());
  render();
  if (remaining === 0) complete(false);
}

function complete(away) {
  clearInterval(timer);
  running = false;
  releaseWake();
  if (!away) chime();

  const finished = mode;
  if (finished === "focus") {
    addSession($("task").value.trim(), Math.round((total / 60000) * 100) / 100);
    updateTally();
  }
  const next = finished === "focus" ? (sessionsToday() % 4 === 0 ? "long" : "short") : "focus";
  setMode(next);

  if (away) {
    note = finished === "focus" ? "Welcome back. Your focus session finished." : "Welcome back. Your break is over.";
  } else {
    note =
      finished === "focus"
        ? `Focus done. Time for a ${MODES[next].label.toLowerCase()}.`
        : "Break over. Ready for the next focus?";
    alertUser(note);
  }
  $("announce").textContent = note;
  render();

  if (settings.auto && !away) start();
}

// Time is worked out from the clock, so it stays right even if the tab sleeps
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  stopFlash();
  if (running) {
    tick();
    holdWake();
  }
});

// Pick up a timer that was running when the page was closed or refreshed
function restoreState(s) {
  try {
    if (!s || !MODES[s.mode] || !Number.isFinite(s.total) || s.total <= 0 || !Number.isFinite(s.remaining)) return;
    setMode(s.mode);
    total = Math.round(s.total);
    remaining = Math.min(total, Math.max(0, Math.round(s.remaining)));
    if (s.running && Number.isFinite(s.endAt)) {
      remaining = Math.min(total, s.endAt - Date.now());
      if (remaining > 0) start(true);
      else {
        remaining = 0;
        complete(true);
        return;
      }
    }
    render();
    saveState();
  } catch (error) {
    // Nothing saved yet
  }
}

// ---------- Sound ----------
function ensureAudio() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch (error) {
    audio = null;
  }
}

function chime() {
  if (!audio || !settings.sound) return;
  try {
    [[660, 0], [880, 0.22], [1100, 0.44]].forEach(([freq, delay]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const at = audio.currentTime + delay;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(at);
      osc.stop(at + 0.4);
    });
  } catch (error) {
    // No sound is fine. The screen still shows that time is up.
  }
}

// ---------- The progress panel ----------
function formatTime(minutes) {
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function renderSheet() {
  // the last seven days, oldest first, today last
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    const entry = log[dateStr(d)];
    days.push({
      name: i === 0 ? "Today" : d.toLocaleDateString("en", { weekday: "short" }),
      sessions: entry ? entry.sessions : 0,
      minutes: entry ? entry.minutes : 0,
    });
  }

  const peak = Math.max(4, ...days.map((d) => d.sessions));
  $("week").replaceChildren(
    ...days.map((d, i) => {
      const col = el("div", i === 6 ? "day today" : "day");
      col.setAttribute("role", "img");
      col.setAttribute("aria-label", `${d.name}: ${d.sessions} ${d.sessions === 1 ? "session" : "sessions"}`);
      const bar = el("span", "day-bar");
      bar.style.height = Math.max(4, (d.sessions / peak) * 120) + "px";
      col.append(el("span", "day-count", d.sessions ? String(d.sessions) : ""), bar, el("span", "day-name", d.name));
      return col;
    })
  );

  // a streak counts the days in a row with at least one session, ending today (or yesterday if you haven't started today)
  let streak = 0;
  let i = log[dateStr(daysAgo(0))] && log[dateStr(daysAgo(0))].sessions > 0 ? 0 : 1;
  while (log[dateStr(daysAgo(i))] && log[dateStr(daysAgo(i))].sessions > 0) {
    streak++;
    i++;
  }

  $("st-sessions").textContent = days.reduce((sum, d) => sum + d.sessions, 0);
  $("st-time").textContent = formatTime(days.reduce((sum, d) => sum + d.minutes, 0));
  $("st-streak").textContent = streak;

  const done = sessionsToday();
  $("goal-text").textContent = `${done} of ${settings.goal} sessions${done >= settings.goal ? ". Goal reached." : ""}`;
  $("goal-fill").style.width = Math.min(100, (done / settings.goal) * 100) + "%";

  const todayEntry = log[today()];
  const tasks = todayEntry ? [...todayEntry.tasks].sort((a, b) => b.count - a.count) : [];
  $("today-empty").hidden = tasks.length > 0;
  $("today-list").replaceChildren(
    ...tasks.map((t) => {
      const row = el("li");
      row.append(el("span", "", t.name), el("span", "", t.count === 1 ? "1 session" : `${t.count} sessions`));
      return row;
    })
  );

  $("len-focus").value = settings.focus;
  $("len-short").value = settings.short;
  $("len-long").value = settings.long;
  $("goal").value = settings.goal;
  $("auto").checked = settings.auto;
}

function openSheet() {
  renderSheet();
  sheet.showModal();
}

$("tally").addEventListener("click", openSheet);
$("sheet-close").addEventListener("click", () => sheet.close());

// a click on the dark area outside the panel closes it
sheet.addEventListener("click", (event) => {
  const box = sheet.getBoundingClientRect();
  const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
  if (!inside) sheet.close();
});

for (const key of ["focus", "short", "long"]) {
  const input = $("len-" + key);
  input.addEventListener("change", () => {
    const n = Number(input.value);
    if (!Number.isFinite(n) || n < 0.1 || n > 180) {
      input.value = settings[key]; // not a usable length: put the old one back
      return;
    }
    settings[key] = n;
    saveSettings();
    if (!running && remaining === total) setMode(mode); // only change a timer that hasn't started
  });
}

$("goal").addEventListener("change", () => {
  const n = Number($("goal").value);
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    $("goal").value = settings.goal;
    return;
  }
  settings.goal = n;
  saveSettings();
  renderSheet();
});

$("auto").addEventListener("change", () => {
  settings.auto = $("auto").checked;
  saveSettings();
});

$("clear").addEventListener("click", () => {
  if (!window.confirm("Delete all your saved sessions? This can't be undone.")) return;
  log = {};
  saveLog();
  updateTally();
  renderSheet();
  render();
});

// ---------- The other controls ----------
$("toggle").addEventListener("click", () => (running ? pause() : start()));
$("reset").addEventListener("click", reset);
$("skip").addEventListener("click", skip);

$("sound").addEventListener("click", () => {
  settings.sound = !settings.sound;
  saveSettings();
  updateSoundButton();
  if (settings.sound) {
    ensureAudio();
    chime(); // a short preview so you know it's on
  }
});

$("task").addEventListener("input", () => {
  settings.task = $("task").value.slice(0, 50);
  saveSettings();
});

$("task").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("task").blur();
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.mode));
});

document.addEventListener("keydown", (event) => {
  if (sheet.open) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.matches && event.target.matches("input, textarea, select")) return;
  const onButton = event.target.closest && event.target.closest("button");
  if (event.key === " " && !onButton) {
    event.preventDefault();
    if (!event.repeat) running ? pause() : start();
  } else if (event.key === "r" || event.key === "R") {
    reset();
  } else if (event.key === "s" || event.key === "S") {
    skip();
  } else if (event.key === "1") switchMode("focus");
  else if (event.key === "2") switchMode("short");
  else if (event.key === "3") switchMode("long");
});

// ---------- Start ----------
let saved = null; // read before setMode below, which saves a fresh state over it
try {
  saved = JSON.parse(localStorage.getItem(STATE_KEY));
} catch (error) {
  // Nothing saved yet
}
loadSettings();
loadLog();
$("task").value = settings.task;
updateSoundButton();
updateTally();
setMode("focus");
restoreState(saved);