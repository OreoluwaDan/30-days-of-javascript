// ---------- Config ----------
const LEVELS = {
  easy: { pairs: 6 },
  medium: { pairs: 8 },
  hard: { pairs: 10 },
};
const MISMATCH_DELAY_MS = 750;
const STORAGE_KEYS = { level: "pairs-level", bestPrefix: "pairs-best-" };

// ---------- Card artwork ----------
// Each shape is drawn with code (SVG), so there are no image files and no emoji.
// Orange shapes are nudged a little so the two "inks" look slightly off-register.
const SHIFT = 'transform="translate(2.5 2.5)"';

function rays() {
  let out = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = (50 + 33 * Math.cos(a)).toFixed(1);
    const y1 = (50 + 33 * Math.sin(a)).toFixed(1);
    const x2 = (50 + 45 * Math.cos(a)).toFixed(1);
    const y2 = (50 + 45 * Math.sin(a)).toFixed(1);
    out += `<line class="bs" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }
  return out;
}

function starPoints() {
  const points = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const radius = i % 2 === 0 ? 42 : 21;
    points.push(`${(50 + radius * Math.cos(angle)).toFixed(1)},${(50 + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return points.join(" ");
}

const GLYPHS = [
  {
    name: "sun",
    svg: `<g ${SHIFT}><circle class="o" cx="50" cy="50" r="23"/></g>${rays()}`,
  },
  {
    name: "crescent moon",
    svg:
      `<path class="b" d="M52.1 14.06A36 36 0 1 0 83.02 64.34A30 30 0 1 1 52.1 14.06Z"/>` +
      `<g ${SHIFT}><circle class="o" cx="72" cy="36" r="8"/></g>`,
  },
  {
    name: "triangle",
    svg:
      `<path class="b" d="M50 12L90 84H10Z"/>` +
      `<g ${SHIFT}><circle class="o" cx="50" cy="62" r="17"/></g>`,
  },
  {
    name: "waves",
    svg:
      `<path class="bs" d="M8 46q10.5-14 21 0t21 0t21 0t21 0"/>` +
      `<path class="bs" d="M8 62q10.5-14 21 0t21 0t21 0t21 0"/>` +
      `<path class="bs" d="M8 78q10.5-14 21 0t21 0t21 0t21 0"/>` +
      `<g ${SHIFT}><circle class="o" cx="50" cy="22" r="13"/></g>`,
  },
  {
    name: "half circles",
    svg:
      `<g ${SHIFT}><path class="o" d="M8 50A34 34 0 0 1 76 50Z"/></g>` +
      `<path class="b" d="M24 54A34 34 0 0 0 92 54Z"/>`,
  },
  {
    name: "plus",
    svg:
      `<g ${SHIFT}><rect class="o" x="40" y="12" width="20" height="76"/><rect class="o" x="12" y="40" width="76" height="20"/></g>` +
      `<rect class="b" x="56" y="56" width="30" height="30"/>`,
  },
  {
    name: "target",
    svg:
      `<circle class="bs" cx="50" cy="50" r="33"/>` +
      `<g ${SHIFT}><circle class="o" cx="50" cy="50" r="19"/></g>` +
      `<circle class="b" cx="50" cy="50" r="6"/>`,
  },
  {
    name: "diamond",
    svg:
      `<g ${SHIFT}><polygon class="o" points="50,8 92,50 50,92 8,50"/></g>` +
      `<polygon class="b" points="50,28 72,50 50,72 28,50"/>`,
  },
  {
    name: "arch",
    svg:
      `<path class="b" d="M22 88V52A28 28 0 0 1 78 52V88Z"/>` +
      `<g ${SHIFT}><circle class="o" cx="50" cy="60" r="15"/></g>`,
  },
  {
    name: "starburst",
    svg:
      `<g ${SHIFT}><polygon class="o" points="${starPoints()}"/></g>` +
      `<circle class="b" cx="50" cy="50" r="11"/>`,
  },
];

function glyphSVG(glyph) {
  // Our own static markup, never user input.
  return `<svg class="glyph" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${glyph.svg}</svg>`;
}

// ---------- State ----------
let level = readStorage(STORAGE_KEYS.level);
if (!LEVELS[level]) level = "medium";

let cards = []; // { glyph, el, flipped, matched }
let openCards = []; // indexes of the face-up cards waiting to be compared
let moves = 0;
let matchedPairs = 0;
let locked = false; // true while two wrong cards are showing
let startTime = null;
let timerId = null;
let lockTimerId = null;
let finalSeconds = 0;

// ---------- DOM elements ----------
const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const matchedEl = document.getElementById("matched");
const timeEl = document.getElementById("time");
const bestEl = document.getElementById("best");
const liveEl = document.getElementById("live");
const newGameBtn = document.getElementById("new-game");
const levelButtons = document.querySelectorAll(".segmented button");
const dialogEl = document.getElementById("win-dialog");
const winSummaryEl = document.getElementById("win-summary");
const winRecordEl = document.getElementById("win-record");
const playAgainBtn = document.getElementById("play-again");
const closeDialogBtn = document.getElementById("close-dialog");

// ---------- Storage ----------
function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Storage can be blocked (private mode). The game still works without it.
  }
}

function getBest(forLevel) {
  const saved = Number(readStorage(STORAGE_KEYS.bestPrefix + forLevel));
  return saved > 0 ? saved : null;
}

// ---------- Helpers ----------
// Fisher-Yates shuffle. (sort(() => Math.random() - 0.5) looks shorter but is not a fair shuffle.)
function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function announce(message) {
  liveEl.textContent = message;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// ---------- Timer ----------
function startTimer() {
  startTime = Date.now();
  timerId = setInterval(() => {
    timeEl.textContent = formatTime(Math.floor((Date.now() - startTime) / 1000));
  }, 250);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

// ---------- Rendering ----------
function updateCardLabel(index) {
  const card = cards[index];
  const number = index + 1;
  let label = `Card ${number}, face down`;
  if (card.matched) label = `Card ${number}, ${card.glyph.name}, matched`;
  else if (card.flipped) label = `Card ${number}, ${card.glyph.name}`;
  card.el.setAttribute("aria-label", label);
  card.el.setAttribute("aria-disabled", String(card.flipped || card.matched));
}

function renderStats() {
  movesEl.textContent = moves;
  matchedEl.textContent = `${matchedPairs}/${LEVELS[level].pairs}`;
}

function renderBest() {
  const best = getBest(level);
  bestEl.textContent = best
    ? `Best on ${level}: ${plural(best, "move")}`
    : `No best score on ${level} yet.`;
}

function renderLevelButtons() {
  levelButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.level === level));
  });
}

function buildBoard(deck) {
  boardEl.innerHTML = "";
  cards = deck.map((glyph, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.innerHTML =
      `<span class="card-inner">` +
      `<span class="face back"></span>` +
      `<span class="face front">${glyphSVG(glyph)}</span>` +
      `</span>`;
    button.addEventListener("click", () => flipCard(index));
    boardEl.appendChild(button);
    return { glyph, el: button, flipped: false, matched: false };
  });
  cards.forEach((_, index) => updateCardLabel(index));
}

// ---------- Game flow ----------
function startGame() {
  clearTimeout(lockTimerId);
  stopTimer();
  if (dialogEl.open) dialogEl.close();

  // Pick this level's shapes, double them to make pairs, then shuffle
  const chosen = shuffle(GLYPHS).slice(0, LEVELS[level].pairs);
  const deck = shuffle([...chosen, ...chosen]);

  moves = 0;
  matchedPairs = 0;
  openCards = [];
  locked = false;
  startTime = null;
  finalSeconds = 0;

  buildBoard(deck);
  timeEl.textContent = "0:00";
  renderStats();
  renderBest();
  renderLevelButtons();
  announce(`New ${level} game. ${deck.length} cards, face down.`);
}

function setFlipped(index, isFlipped) {
  const card = cards[index];
  card.flipped = isFlipped;
  card.el.classList.toggle("is-flipped", isFlipped);
  updateCardLabel(index);
}

function flipCard(index) {
  const card = cards[index];
  if (locked || card.flipped || card.matched) return;

  if (startTime === null) startTimer(); // the clock starts on your first flip

  setFlipped(index, true);
  openCards.push(index);

  if (openCards.length < 2) {
    announce(card.glyph.name);
    return;
  }

  // Two cards are open: count a move and compare them
  moves++;
  const [firstIndex, secondIndex] = openCards;
  const isMatch = cards[firstIndex].glyph.name === cards[secondIndex].glyph.name;

  if (isMatch) {
    markMatched(firstIndex, secondIndex);
  } else {
    locked = true;
    announce(`${card.glyph.name}. No match.`);
    lockTimerId = setTimeout(() => {
      setFlipped(firstIndex, false);
      setFlipped(secondIndex, false);
      openCards = [];
      locked = false;
    }, MISMATCH_DELAY_MS);
  }
  renderStats();
}

function markMatched(firstIndex, secondIndex) {
  [firstIndex, secondIndex].forEach((index) => {
    const card = cards[index];
    card.matched = true;
    card.el.classList.add("is-matched");
    updateCardLabel(index);
  });
  openCards = [];
  matchedPairs++;
  announce(`Matched ${cards[firstIndex].glyph.name}.`);

  if (matchedPairs === LEVELS[level].pairs) {
    winGame();
  }
}

function winGame() {
  stopTimer();
  finalSeconds = Math.floor((Date.now() - startTime) / 1000);
  timeEl.textContent = formatTime(finalSeconds);

  // Best score = fewest moves
  const previousBest = getBest(level);
  const isNewBest = previousBest === null || moves < previousBest;
  if (isNewBest) writeStorage(STORAGE_KEYS.bestPrefix + level, String(moves));
  renderBest();

  winSummaryEl.textContent = `${plural(moves, "move")} in ${formatTime(finalSeconds)}.`;
  if (previousBest === null) {
    winRecordEl.textContent = `Your first score on ${level}.`;
  } else if (isNewBest) {
    winRecordEl.textContent = `New best on ${level}. The old one was ${plural(previousBest, "move")}.`;
  } else {
    winRecordEl.textContent = `Your best on ${level} is ${plural(previousBest, "move")}.`;
  }

  announce(`All pairs found in ${plural(moves, "move")}.`);

  // Short pause so the last flip finishes before the dialog opens
  setTimeout(() => {
    if (typeof dialogEl.showModal === "function") dialogEl.showModal();
  }, 600);
}

// ---------- Events ----------
newGameBtn.addEventListener("click", startGame);

levelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.level === level) return;
    level = button.dataset.level;
    writeStorage(STORAGE_KEYS.level, level);
    startGame();
  });
});

playAgainBtn.addEventListener("click", startGame);
closeDialogBtn.addEventListener("click", () => dialogEl.close());

// ---------- Init ----------
startGame();
