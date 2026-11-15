"use strict";

/* ==========================================================
   Sabi: a daily word game ("sabi" is pidgin for "know")
   30 Days of JS. Six tries to guess a 5-letter word.
   ========================================================== */

/* ---------- Words ----------
   The secret word always comes from this list. Guesses can be any real
   word: if it isn't listed here, we ask a free dictionary API. */

const ANSWERS = new Set(`
about above actor adapt admit adult after again agent agree ahead alarm album alert alike alive allow alone
along alter among angel anger angle angry apart apple apply arena argue arise armed array aside asset avoid
awake award aware badly baker basic beach began begin being below bench birth black blame blank blast blind
block blood board boost booth bound brain brand brave bread break brick brief bring broad brown brush build
bunch burst buyer cable carry catch cause chain chair chalk charm chart chase cheap check cheek cheer chest
chief child chill choir civil claim class clean clear clerk click climb clock close cloth cloud coach coast
color count court cover craft crash crazy cream crime cross crowd crown curve cycle daily dance death delay
depth dirty doubt dozen draft drama dream dress drink drive eager early earth eight elect empty enemy enjoy
enter equal error event every exact exist extra faith false fancy fault feast fence fever field fifth fight
final first flame flash fleet floor flour fluid focus force forth forty frame fresh front fruit funny ghost
giant given glass globe glory grace grade grain grand grant grape grass great green greet grief group guard
guess guest guide habit happy harsh heart heavy hello honey honor horse hotel house human humor ideal image
index inner issue ivory jelly joint judge juice knife knock known label labor large laser later laugh layer
learn least leave legal lemon level light limit local logic loose lover lower lucky lunch magic major maker
march match maybe mayor media mercy metal might minor mixed model money month moral motor mount mouse mouth
movie music nerve never night noise north novel nurse ocean offer often olive onion opera orbit order other
outer owner paint panel paper party pasta patch pause peace pearl phase phone photo piano piece pilot pitch
place plain plane plant plate point pound power press price pride prime print prize proof proud prove pulse
queen quick quiet quite radio raise range rapid ratio reach ready realm rebel refer relax reply rider ridge
right rival river robot rough round route royal rural salad sauce scale scene scope score sense serve seven
shade shake shape share sharp sheet shelf shell shift shine shirt shock shoot short shown sight silly since
sixth skill sleep slice slide small smart smile smoke snake solid solve sorry sound south space spare speak
speed spend spice spoke sport staff stage stair stamp stand start state steam steel stick still stock stone
store storm story strip study stuff style sugar suite sunny super sweet swing table taste teach thank their
theme there thick thing think third those three throw thumb tiger tight timer title today token tooth topic
total touch tough tower trace track trade trail train treat trend trial tribe trick truck truly trust truth
twice uncle under union unity until upper upset urban usual valid value video virus visit vital vocal voice
waste watch water wheat wheel where which while white whole whose widow woman world worry worth would wound
write wrong young youth zebra
`.trim().split(/\s+/));

const WORDS = [...ANSWERS];

/* ---------- Settings ---------- */

const ROWS = 6;
const COLS = 5;
const FLIP_MS = 250;
const START_DAY = Date.UTC(2026, 10, 13); // the day that counts as #1
const PRAISE = ["Genius", "Sharp", "Well done", "Nice one", "Phew", "Just in time"];
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const RANK = { absent: 1, present: 2, correct: 3 };

const DAILY_KEY = "sabi:daily";
const STATS_KEY = "sabi:stats";
const PREFS_KEY = "sabi:prefs";

const $ = (id) => document.getElementById(id);
const els = {
  board: $("board"), kb: $("kb"), toasts: $("toasts"),
  help: $("dlg-help"), stats: $("dlg-stats"),
  nums: $("nums"), dist: $("dist"), end: $("end"), endMsg: $("end-msg"), next: $("next"),
  share: $("share"), again: $("again"), daily: $("daily"), contrast: $("contrast"),
};

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Saved data ---------- */

const store = {
  get(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage blocked or full: the game still works without it */
    }
  },
};

/* ---------- Game state ---------- */

let state;          // { mode, day, answer, guesses, status }
let current = "";   // letters typed in the row being played
let busy = false;   // true while a guess is being checked or revealed
let keyStates = {}; // best colour found so far for each letter

function todayNumber() {
  const d = new Date();
  const midnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((midnight - START_DAY) / 86400000) + 1;
}

// Everyone gets the same word on the same day. 7919 is prime, so it never repeats early.
function dailyWord(day) {
  const index = (((day * 7919) % WORDS.length) + WORDS.length) % WORDS.length;
  return WORDS[index];
}

function newGame(mode) {
  const day = todayNumber();
  state = {
    mode, day,
    answer: mode === "daily" ? dailyWord(day) : WORDS[Math.floor(Math.random() * WORDS.length)],
    guesses: [],
    status: "playing",
  };
  current = "";
  persist();
}

function persist() {
  if (state.mode === "daily") store.set(DAILY_KEY, state);
}

function loadDaily() {
  const saved = store.get(DAILY_KEY, null);
  const valid =
    saved && saved.day === todayNumber() && typeof saved.answer === "string" &&
    Array.isArray(saved.guesses) && saved.mode === "daily";
  if (valid) {
    state = saved;
    current = "";
  } else {
    newGame("daily");
  }
}

/* ---------- Scoring ----------
   Two passes so repeated letters are handled properly.
   Answer CRANE, guess EERIE: only one E can be coloured, because the
   answer only has one E. */

function score(guess, answer) {
  const result = Array(COLS).fill("absent");
  const left = {};

  for (let i = 0; i < COLS; i++) {
    if (guess[i] === answer[i]) result[i] = "correct";
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < COLS; i++) {
    if (result[i] === "correct") continue;
    if (left[guess[i]] > 0) {
      result[i] = "present";
      left[guess[i]]--;
    }
  }
  return result;
}

/* ---------- Checking that a guess is a real word ---------- */

const checked = new Map();

async function isWord(word) {
  if (ANSWERS.has(word)) return true;
  if (checked.has(word)) return checked.get(word);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`,
      { signal: controller.signal }
    );
    if (response.status === 404) {
      checked.set(word, false);
      return false;
    }
    if (response.ok) checked.set(word, true);
    return true; // any other problem: don't punish the player
  } catch {
    return true; // offline or slow: accept the guess
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Building the screen ---------- */

function buildBoard() {
  const rows = Array.from({ length: ROWS }, () => {
    const row = document.createElement("div");
    row.className = "row";
    row.setAttribute("role", "row");
    for (let c = 0; c < COLS; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.setAttribute("role", "gridcell");
      tile.style.setProperty("--i", c);
      row.append(tile);
    }
    return row;
  });
  els.board.replaceChildren(...rows);
}

function buildKeyboard() {
  const make = (label, key, wide) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "key" + (wide ? " key--wide" : "");
    button.dataset.key = key;
    button.textContent = label;
    if (key === "back") button.setAttribute("aria-label", "Delete");
    return button;
  };
  const gap = () => Object.assign(document.createElement("span"), { className: "key-gap" });

  const rows = KEY_ROWS.map((letters, i) => {
    const row = document.createElement("div");
    row.className = "kb-row";
    const keys = [...letters].map((ch) => make(ch, ch));
    if (i === 1) row.append(gap(), ...keys, gap());
    else if (i === 2) row.append(make("Enter", "enter", true), ...keys, make("⌫", "back", true));
    else row.append(...keys);
    return row;
  });
  els.kb.replaceChildren(...rows);
}

const tileAt = (row, col) => els.board.children[row].children[col];

function drawCurrent(popLast = false) {
  const row = state.guesses.length;
  for (let c = 0; c < COLS; c++) {
    const tile = tileAt(row, c);
    const letter = current[c] || "";
    tile.textContent = letter;
    tile.dataset.filled = letter ? "true" : "false";
    tile.setAttribute("aria-label", letter || "empty");
    tile.classList.remove("pop");
  }
  if (popLast && current) {
    const tile = tileAt(row, current.length - 1);
    void tile.offsetWidth; // restart the animation
    tile.classList.add("pop");
  }
}

function reveal(row, guess, result, animate) {
  const quick = !animate || reduceMotion();
  for (let c = 0; c < COLS; c++) {
    const tile = tileAt(row, c);
    const paint = () => {
      tile.dataset.state = result[c];
      tile.setAttribute("aria-label", `${guess[c]}, ${result[c]}`);
    };
    tile.textContent = guess[c];
    tile.dataset.filled = "true";
    if (quick) {
      paint();
    } else {
      tile.style.animationDelay = `${c * FLIP_MS}ms`;
      tile.classList.add("flip");
      setTimeout(paint, c * FLIP_MS + FLIP_MS); // swap colour while the tile is edge-on
    }
  }
  return new Promise((resolve) => setTimeout(resolve, quick ? 0 : COLS * FLIP_MS + FLIP_MS));
}

function markKeys(guess, result) {
  [...guess].forEach((letter, i) => {
    const best = keyStates[letter];
    if (!best || RANK[result[i]] > RANK[best]) keyStates[letter] = result[i];
    els.kb.querySelector(`[data-key="${letter}"]`).dataset.state = keyStates[letter];
  });
}

function toast(message, stay = false) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  els.toasts.prepend(el);
  if (!stay) setTimeout(() => el.remove(), 1600);
}

function shakeRow() {
  const row = els.board.children[state.guesses.length];
  row.classList.remove("shake");
  void row.offsetWidth;
  row.classList.add("shake");
}

function renderGame() {
  keyStates = {};
  els.kb.querySelectorAll(".key").forEach((key) => delete key.dataset.state);
  buildBoard();
  state.guesses.forEach((guess, row) => {
    const result = score(guess, state.answer);
    reveal(row, guess, result, false);
    markKeys(guess, result);
  });
  drawCurrent();
}

/* ---------- Playing ---------- */

function press(key) {
  if (busy || state.status !== "playing") return;
  if (key === "enter") return submit();
  if (key === "back") {
    if (current) {
      current = current.slice(0, -1);
      drawCurrent();
    }
    return;
  }
  if (current.length < COLS) {
    current += key;
    drawCurrent(true);
  }
}

async function submit() {
  if (current.length < COLS) {
    shakeRow();
    toast("Need 5 letters");
    return;
  }
  busy = true;
  const guess = current;

  if (!(await isWord(guess))) {
    busy = false;
    shakeRow();
    toast("Not in word list");
    return;
  }

  const row = state.guesses.length;
  const result = score(guess, state.answer);
  state.guesses.push(guess);
  current = "";
  persist();

  await reveal(row, guess, result, true);
  markKeys(guess, result);

  if (guess === state.answer) await finish(true, row);
  else if (state.guesses.length === ROWS) await finish(false, row);

  busy = false;
}

async function finish(won, row) {
  state.status = won ? "won" : "lost";
  persist();
  if (state.mode === "daily") recordStats(won);

  if (won) {
    toast(PRAISE[row]);
    if (!reduceMotion()) els.board.children[row].classList.add("bounce");
  } else {
    toast(state.answer.toUpperCase(), true);
  }
  setTimeout(openStats, won && !reduceMotion() ? 1600 : 900);
}

/* ---------- Stats ---------- */

const blankStats = () => ({ played: 0, wins: 0, streak: 0, best: 0, lastWin: 0, dist: [0, 0, 0, 0, 0, 0] });

function recordStats(won) {
  const stats = { ...blankStats(), ...store.get(STATS_KEY, {}) };
  stats.played++;
  if (won) {
    stats.wins++;
    stats.streak = stats.lastWin === state.day - 1 ? stats.streak + 1 : 1;
    stats.best = Math.max(stats.best, stats.streak);
    stats.lastWin = state.day;
    stats.dist[state.guesses.length - 1]++;
  } else {
    stats.streak = 0;
  }
  store.set(STATS_KEY, stats);
}

function renderStats() {
  const s = { ...blankStats(), ...store.get(STATS_KEY, {}) };
  // A streak is only alive if you won today or yesterday.
  const alive = s.lastWin >= todayNumber() - 1;
  const winRate = s.played ? Math.round((s.wins / s.played) * 100) : 0;

  const items = [["Played", s.played], ["Win %", winRate], ["Streak", alive ? s.streak : 0], ["Best", s.best]];
  els.nums.replaceChildren(...items.map(([label, value]) => {
    const box = document.createElement("div");
    const dt = Object.assign(document.createElement("dt"), { textContent: label });
    const dd = Object.assign(document.createElement("dd"), { textContent: value });
    box.append(dt, dd);
    return box;
  }));

  const most = Math.max(1, ...s.dist);
  els.dist.replaceChildren(...s.dist.map((count, i) => {
    const li = document.createElement("li");
    const n = Object.assign(document.createElement("span"), { className: "n", textContent: i + 1 });
    const bar = Object.assign(document.createElement("span"), { className: "bar", textContent: count });
    bar.style.width = `${Math.max(8, (count / most) * 100)}%`;
    if (state.mode === "daily" && state.status === "won" && i === lastWinRowIndex()) bar.classList.add("hit");
    li.append(n, bar);
    return li;
  }));

  const over = state.status !== "playing";
  els.end.hidden = !over;
  if (over) {
    const isDaily = state.mode === "daily";
    els.endMsg.textContent = state.status === "won"
      ? `You got it in ${state.guesses.length}.`
      : `The word was ${state.answer.toUpperCase()}.`;
    els.share.hidden = !isDaily;
    els.next.hidden = !isDaily;
    els.daily.hidden = isDaily;
    els.again.textContent = isDaily ? "Play a practice word" : "Play another word";
    updateCountdown();
  }
}

function lastWinRowIndex() {
  return state.guesses.length - 1;
}

function updateCountdown() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const total = Math.max(0, Math.floor((next - now) / 1000));
  const pad = (n) => String(n).padStart(2, "0");
  els.next.textContent =
    `Next word in ${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

let countdownTimer;

function openStats() {
  if (els.help.open) els.help.close();
  renderStats();
  if (!els.stats.open) els.stats.showModal();
  clearInterval(countdownTimer);
  countdownTimer = setInterval(updateCountdown, 1000);
}

async function shareResult() {
  const prefs = store.get(PREFS_KEY, {});
  const emoji = prefs.contrast
    ? { correct: "🟧", present: "🟦", absent: "⬛" }
    : { correct: "🟩", present: "🟨", absent: "⬛" };
  const grid = state.guesses
    .map((guess) => score(guess, state.answer).map((s) => emoji[s]).join(""))
    .join("\n");
  const tries = state.status === "won" ? state.guesses.length : "X";
  const text = `Sabi #${state.day} ${tries}/${ROWS}\n\n${grid}`;
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    toast("Couldn't copy");
  }
}

/* ---------- Events ---------- */

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (document.querySelector("dialog[open]")) return;
  // If a button has focus, Enter already "clicks" it. Don't submit twice.
  if (event.key === "Enter" && event.target.closest("button")) return;

  if (event.key === "Enter") press("enter");
  else if (event.key === "Backspace") press("back");
  else if (/^[a-z]$/i.test(event.key)) press(event.key.toLowerCase());
});

els.kb.addEventListener("click", (event) => {
  const key = event.target.closest(".key");
  if (!key) return;
  key.blur();
  press(key.dataset.key);
});

$("btn-help").addEventListener("click", () => els.help.showModal());
$("btn-stats").addEventListener("click", openStats);

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-close]")) dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.activeElement?.blur();
    clearInterval(countdownTimer);
  });
});

els.share.addEventListener("click", shareResult);

els.again.addEventListener("click", () => {
  newGame("free");
  renderGame();
  els.stats.close();
});

els.daily.addEventListener("click", () => {
  loadDaily();
  renderGame();
  els.stats.close();
});

els.contrast.addEventListener("change", () => {
  const prefs = { ...store.get(PREFS_KEY, {}), contrast: els.contrast.checked };
  store.set(PREFS_KEY, prefs);
  applyPrefs();
});

function applyPrefs() {
  const prefs = store.get(PREFS_KEY, {});
  els.contrast.checked = Boolean(prefs.contrast);
  if (prefs.contrast) document.documentElement.dataset.contrast = "high";
  else delete document.documentElement.dataset.contrast;
}

/* ---------- Start ---------- */

function init() {
  applyPrefs();
  buildKeyboard();
  loadDaily();
  renderGame();
  if (!store.get("sabi:seen", false)) {
    store.set("sabi:seen", true);
    els.help.showModal();
  }
}

init();