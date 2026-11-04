"use strict";

const WORDS = (
  "the of and to in is you that it he was for on are as with his they at be this from I have or by one had not " +
  "but what all were when we there can an your which their said if do will each about how up out them then she " +
  "many some so these would other into has more her two like him see time could no make than first been its who " +
  "now people my made over did down only way find use may water long little very after words called just where " +
  "most know get through back much before go good new write our me man too any day same right look think also " +
  "around another came come work three word must because does part even place well such here take why help put " +
  "different away again off went old number great tell men say small every found still between name should home " +
  "big give air line set own under read last never us left end along while might next sound below saw something"
).split(" ");

const BEST_KEY = "typing-test-best-v1";
const TEXT_WORDS = 160;

let mode = 30;
let text = "";
let typed = "";
let charEls = [];
let started = false;
let finished = false;
let startTime = 0;
let keys = 0;
let errors = 0;
let timer = null;

const $ = (id) => document.getElementById(id);
const textEl = $("text");
const boxEl = $("box");
const stageEl = $("stage");
const typer = $("typer");

// ---------- Setting up a test ----------
function randomText() {
  const out = [];
  for (let i = 0; i < TEXT_WORDS; i++) out.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  return out.join(" ");
}

function newTest() {
  clearInterval(timer);
  text = randomText();
  typed = "";
  started = false;
  finished = false;
  keys = 0;
  errors = 0;
  typer.value = "";
  boxEl.scrollTop = 0;

  charEls = [...text].map((ch) => {
    const span = document.createElement("span");
    span.textContent = ch;
    return span;
  });
  textEl.replaceChildren(...charEls);

  $("time").textContent = mode;
  $("live-wpm").textContent = "0";
  $("result").hidden = true;
  $("test").hidden = false;
  paint();
  typer.focus();
}

// ---------- Drawing the letters ----------
function paint() {
  for (let i = 0; i < charEls.length; i++) {
    let cls = "";
    if (i < typed.length) cls = typed[i] === text[i] ? "ok" : "bad";
    else if (i === typed.length) cls = "cur";
    charEls[i].className = cls;
  }
  // keep the line you are typing on in view
  const current = charEls[Math.min(typed.length, charEls.length - 1)];
  const lineHeight = parseFloat(getComputedStyle(textEl).lineHeight);
  boxEl.scrollTop = Math.max(0, current.offsetTop - lineHeight);
}

// ---------- Typing ----------
typer.addEventListener("input", () => {
  if (finished) return;
  let value = typer.value;
  if (value.length > text.length) value = value.slice(0, text.length);
  typer.value = value;

  if (!started && value.length > 0) {
    started = true;
    startTime = performance.now();
    timer = setInterval(tick, 100);
  }

  // count every new letter as a keystroke, so fixed mistakes still count against accuracy
  for (let i = typed.length; i < value.length; i++) {
    keys++;
    if (value[i] !== text[i]) errors++;
  }
  typed = value;
  paint();

  if (typed.length === text.length) finish();
});

function correctLetters() {
  let n = 0;
  for (let i = 0; i < typed.length; i++) if (typed[i] === text[i]) n++;
  return n;
}

function wpmAt(seconds) {
  if (seconds < 1) return 0;
  return Math.round(correctLetters() / 5 / (seconds / 60));
}

function tick() {
  const elapsed = (performance.now() - startTime) / 1000;
  const left = Math.max(0, mode - elapsed);
  $("time").textContent = Math.ceil(left);
  $("live-wpm").textContent = wpmAt(elapsed);
  if (left <= 0) finish();
}

// ---------- Best scores ----------
function loadBest() {
  try {
    const data = JSON.parse(localStorage.getItem(BEST_KEY));
    return data && typeof data === "object" ? data : {};
  } catch (error) {
    return {};
  }
}

function saveBest(data) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(data));
  } catch (error) {
    // Storage can be blocked. The test still works.
  }
}

// ---------- The end ----------
function finish() {
  if (finished) return;
  finished = true;
  clearInterval(timer);
  typer.blur();

  const elapsed = Math.min(mode, (performance.now() - startTime) / 1000);
  const wpm = wpmAt(Math.max(elapsed, 1));
  const accuracy = keys ? Math.round(((keys - errors) / keys) * 100) : 100;

  const best = loadBest();
  const previous = Number(best[mode]) || 0;
  const isRecord = wpm > previous;
  if (isRecord) {
    best[mode] = wpm;
    saveBest(best);
  }

  $("r-wpm").textContent = wpm;
  $("r-acc").textContent = accuracy + "%";
  $("r-best").textContent = isRecord
    ? previous
      ? `New best for ${mode} seconds. Your old one was ${previous}.`
      : `That's your first score for ${mode} seconds.`
    : `Your best for ${mode} seconds is ${previous} wpm.`;

  $("test").hidden = true;
  $("result").hidden = false;
  $("again").focus();
}

// ---------- Wiring ----------
$("modes").addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (!button) return;
  mode = Number(button.dataset.mode);
  document.querySelectorAll("#modes button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
  newTest();
});

$("again").addEventListener("click", newTest);
stageEl.addEventListener("click", () => typer.focus());
typer.addEventListener("focus", () => stageEl.classList.remove("is-blurred"));
typer.addEventListener("blur", () => stageEl.classList.add("is-blurred"));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") newTest();
});

newTest();