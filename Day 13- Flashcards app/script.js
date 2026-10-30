"use strict";

// ---------- Settings ----------
const STORAGE_KEY = "flashcards-v1";
const MAX_BOX = 5; // Leitner boxes go from 1 (new or missed) to 5 (well known)
const SESSION_SIZE = 20; // most cards in one sitting
const RETRY_GAP = 3; // a missed card comes back after this many other cards
const TOAST_MS = 6000;

// A starter deck so the app isn't empty the first time you open it
const SAMPLE_CARDS = [
  ["What is the difference between == and ===?", "== converts types before comparing, so 1 == '1' is true. === compares value and type with no conversion, so 1 === '1' is false."],
  ["What does const do?", "Creates a variable that cannot be reassigned. An object or array stored in it can still be changed."],
  ["What does Array.map() return?", "A new array with the result of calling a function on every item. The original array is left alone."],
  ["What is a closure?", "A function that remembers the variables from the place it was created, even after the outer function has finished."],
  ["What does typeof null return?", "'object'. It is an old bug in the language that was never fixed."],
  ["What is the event loop?", "The mechanism that lets JavaScript handle async work while running one thing at a time. When the call stack is empty, it moves finished callbacks onto it."],
  ["What do async and await do?", "They let you write code that waits for a Promise in a top-to-bottom style. await pauses inside an async function until the Promise settles."],
  ["What is the difference between null and undefined?", "undefined means a value was never assigned. null is a value you set on purpose to mean 'nothing here'."],
];

// ---------- State ----------
let state = { decks: [] }; // filled in at the bottom, once the helpers exist
let session = null; // the study session in progress, if any
let ui = {}; // the buttons on the study screen
let storageProblem = false;
let toastTimer = null;

// ---------- Small helpers ----------
const $ = (id) => document.getElementById(id);
const app = $("app");

// Builds an element. Everything goes in with textContent, so card text can never run as HTML.
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function announce(message) {
  $("announce").textContent = "";
  setTimeout(() => ($("announce").textContent = message), 30);
}

function toast(message, actionLabel, onAction) {
  const el = $("toast");
  clearTimeout(toastTimer);
  el.replaceChildren(h("span", { text: message }));
  if (actionLabel) {
    el.append(
      h("button", {
        type: "button",
        text: actionLabel,
        onclick: () => {
          el.classList.remove("is-visible");
          onAction();
        },
      })
    );
  }
  el.classList.add("is-visible");
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), TOAST_MS);
}

// ---------- Saving and loading ----------
function sampleState() {
  return {
    decks: [
      {
        id: uid(),
        name: "JavaScript basics",
        cards: SAMPLE_CARDS.map(([front, back]) => ({ id: uid(), front, back, box: 1 })),
      },
    ],
  };
}

// Whatever is in storage, turn it into data we can trust
function cleanState(data) {
  const decks = data.decks
    .filter((d) => d && typeof d.name === "string")
    .map((d) => ({
      id: String(d.id || uid()),
      name: d.name,
      cards: (Array.isArray(d.cards) ? d.cards : [])
        .filter((c) => c && typeof c.front === "string" && typeof c.back === "string")
        .map((c) => ({
          id: String(c.id || uid()),
          front: c.front,
          back: c.back,
          box: Math.min(MAX_BOX, Math.max(1, Math.round(Number(c.box)) || 1)),
        })),
    }));
  return { decks };
}

function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    storageProblem = true; // storage is blocked, the app still works for this visit
  }
  if (raw === null) return sampleState();
  try {
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.decks)) return cleanState(data);
  } catch (error) {
    // Broken data: fall through to the sample deck
  }
  return sampleState();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    storageProblem = true;
    $("notice").hidden = false;
  }
}

// ---------- The spaced repetition part ----------
// Cards in low boxes get a bigger weight, so they tend to be picked and shown first.
// Box 1 -> 25, box 2 -> 16, box 3 -> 9, box 4 -> 4, box 5 -> 1.
function weightOf(card) {
  return (MAX_BOX + 1 - card.box) ** 2;
}

// Weighted shuffle without repeats: every card gets a random "waiting time" that is
// shorter on average when its weight is bigger. Sorting by that time gives the order.
function weightedOrder(cards) {
  return cards
    .map((card) => ({ card, wait: -Math.log(1 - Math.random()) / weightOf(card) }))
    .sort((a, b) => a.wait - b.wait)
    .map((item) => item.card);
}

function startSession(deck) {
  const picked = weightedOrder(deck.cards).slice(0, SESSION_SIZE);
  return {
    deckId: deck.id,
    queue: picked.map((c) => c.id),
    total: picked.length,
    done: new Set(), // cards answered "Got it"
    missed: new Set(), // cards that needed another go
    up: 0, // cards that moved up a box
    flipped: false,
  };
}

function countByBox(cards) {
  const counts = [0, 0, 0, 0, 0];
  cards.forEach((c) => counts[c.box - 1]++);
  return counts;
}

// ---------- Routing ----------
// #/            -> all decks
// #/deck/ID     -> one deck
// #/study/ID    -> a study session
function render() {
  const [view, id] = location.hash.replace(/^#\/?/, "").split("/");
  const deck = state.decks.find((d) => d.id === id);

  if (view !== "study") session = null; // leaving the study screen ends the session
  $("notice").hidden = !storageProblem;

  if (view === "deck" && deck) renderDeck(deck);
  else if (view === "study" && deck) renderStudy(deck);
  else if (view === "deck" || view === "study") location.replace("#/"); // unknown deck
  else renderDecks();
}

function show(title, ...nodes) {
  document.title = title;
  app.replaceChildren(...nodes);
}

function focusHeading() {
  window.scrollTo(0, 0);
  const heading = app.querySelector("h1");
  if (heading) heading.focus({ preventScroll: true });
}

// ---------- Dialogs ----------
// One dialog for everything: asks for some text fields, or just asks "are you sure?".
// Resolves with the values (an object), or null if the person cancelled.
function openForm({ title, text, fields = [], submit = "Save", danger = false }) {
  return new Promise((resolve) => {
    const dialog = $("dialog");
    let result = null;

    const parts = fields.map((f) => {
      const id = "field-" + f.name;
      const input = f.multiline
        ? h("textarea", { id, rows: "4", class: "ruled" })
        : h("input", { id, type: "text", maxlength: "50", autocomplete: "off" });
      input.value = f.value || "";
      return { name: f.name, input, node: h("div", { class: "field" }, h("label", { for: id, text: f.label }), input) };
    });

    const error = h("p", { class: "form-error", role: "alert" });
    const cancel = h("button", { type: "button", class: "btn", text: "Cancel", onclick: () => dialog.close() });
    const ok = h("button", { type: "submit", class: "btn " + (danger ? "danger" : "primary"), text: submit });

    const form = h(
      "form",
      { method: "dialog" },
      h("h2", { text: title }),
      text ? h("p", { text }) : null,
      ...parts.map((p) => p.node),
      error,
      h("div", { class: "dialog-actions" }, cancel, ok)
    );

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = {};
      for (const part of parts) {
        values[part.name] = part.input.value.trim();
        if (!values[part.name]) {
          error.textContent = "Please fill in every box.";
          part.input.focus();
          return;
        }
      }
      result = values;
      dialog.close();
    });

    dialog.addEventListener(
      "close",
      () => {
        dialog.replaceChildren();
        resolve(result);
      },
      { once: true }
    );
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close(); // click on the dim background
    });

    dialog.replaceChildren(form);
    dialog.showModal();
  });
}

// ---------- Decks screen ----------
function strip(cards) {
  const counts = countByBox(cards);
  return h(
    "span",
    { class: "strip", "aria-hidden": "true" },
    ...counts.map((n, i) => h("span", { class: `seg b${i + 1}`, style: `flex: ${n} 0 0` }))
  );
}

function deckTile(deck) {
  const known = deck.cards.filter((c) => c.box === MAX_BOX).length;
  return h(
    "li",
    {},
    h(
      "a",
      { class: "paper deck-tile", href: `#/deck/${deck.id}` },
      h("span", { class: "eyebrow", text: plural(deck.cards.length, "card") }),
      h("span", { class: "tile-name", text: deck.name }),
      h("span", { class: "tile-mastered", text: deck.cards.length ? `${known} of ${deck.cards.length} well known` : "No cards yet" }),
      strip(deck.cards)
    )
  );
}

function renderDecks() {
  const head = h(
    "div",
    { class: "page-head" },
    h("h1", { tabindex: "-1", text: "Your decks" }),
    h("button", { type: "button", class: "btn primary", text: "New deck", onclick: newDeck })
  );

  const body = state.decks.length
    ? h("ul", { class: "deck-grid" }, ...state.decks.map(deckTile))
    : h(
        "div",
        { class: "paper empty" },
        h("span", { class: "eyebrow", text: "Nothing here yet" }),
        h("h2", { text: "Start your first deck" }),
        h("p", { text: "A deck is a pile of cards on one topic. Make one, add some cards, then study them." }),
        h("button", { type: "button", class: "btn primary", text: "New deck", onclick: newDeck })
      );

  show("Flashcards", head, body);
  focusHeading();
}

async function newDeck() {
  const values = await openForm({
    title: "New deck",
    fields: [{ name: "name", label: "Deck name" }],
    submit: "Create deck",
  });
  if (!values) return;
  const deck = { id: uid(), name: values.name, cards: [] };
  state.decks.push(deck);
  save();
  location.hash = `#/deck/${deck.id}`;
}

// ---------- One deck ----------
function drawer(cards, currentBox) {
  const counts = countByBox(cards);
  return h(
    "ol",
    { class: "drawer", "aria-label": "Cards in each box" },
    ...counts.map((n, i) =>
      h(
        "li",
        { class: `slot b${i + 1}${currentBox === i + 1 ? " is-current" : ""}` },
        h("span", { class: "slot-name", text: `Box ${i + 1}` }),
        h("span", { class: "slot-count", text: String(n) })
      )
    )
  );
}

function cardRow(deck, card) {
  return h(
    "li",
    { class: "row" },
    h("div", {}, h("span", { class: "row-label", text: "Front" }), h("span", { class: "row-text", text: card.front })),
    h("div", {}, h("span", { class: "row-label", text: "Back" }), h("span", { class: "row-text", text: card.back })),
    h(
      "div",
      { class: "row-side" },
      h("span", { class: `box-badge b${card.box}`, text: `Box ${card.box}` }),
      h(
        "div",
        { class: "row-buttons" },
        h("button", { type: "button", class: "btn small", text: "Edit", "aria-label": `Edit card: ${card.front}`, onclick: () => editCard(deck, card) }),
        h("button", { type: "button", class: "btn small danger", text: "Delete", "aria-label": `Delete card: ${card.front}`, onclick: () => deleteCard(deck, card) })
      )
    )
  );
}

function renderDeck(deck) {
  const cards = deck.cards;

  const study = cards.length
    ? h("a", { class: "btn primary", href: `#/study/${deck.id}`, text: "Study this deck" })
    : h("button", { type: "button", class: "btn primary", text: "Study this deck", disabled: true });

  const head = h(
    "div",
    { class: "page-head" },
    h("div", {}, h("h1", { tabindex: "-1", text: deck.name }), h("p", { class: "sub", text: cards.length ? plural(cards.length, "card") : "Add a card below to start studying." })),
    h(
      "div",
      { class: "actions" },
      study,
      h("button", { type: "button", class: "btn", text: "Rename", onclick: () => renameDeck(deck) }),
      h("button", { type: "button", class: "btn danger", text: "Delete deck", onclick: () => deleteDeck(deck) })
    )
  );

  const front = h("textarea", { id: "new-front", class: "ruled", rows: "3" });
  const back = h("textarea", { id: "new-back", class: "ruled", rows: "3" });
  const error = h("p", { class: "form-error", role: "alert" });

  const form = h(
    "form",
    { class: "paper add-card", novalidate: true },
    h("h2", { text: "Add a card" }),
    h(
      "div",
      { class: "sides" },
      h("div", { class: "field" }, h("label", { for: "new-front", text: "Front (question)" }), front),
      h("div", { class: "field" }, h("label", { for: "new-back", text: "Back (answer)" }), back)
    ),
    error,
    h("div", { class: "form-actions" }, h("button", { type: "submit", class: "btn primary", text: "Add card" }), h("span", { class: "hint", text: "Tip: Ctrl + Enter adds the card." }))
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const frontText = front.value.trim();
    const backText = back.value.trim();
    if (!frontText || !backText) {
      error.textContent = "Write both sides of the card first.";
      (frontText ? back : front).focus();
      return;
    }
    deck.cards.push({ id: uid(), front: frontText, back: backText, box: 1 });
    save();
    renderDeck(deck);
    $("new-front").focus();
    toast(`Card added. ${plural(deck.cards.length, "card")} in this deck.`);
  });

  back.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") form.requestSubmit();
  });

  const list = cards.length
    ? [
        h("h2", { class: "list-title", text: "All cards" }),
        // newest first, so a card you just added is easy to find
        h("ul", { class: "card-list" }, ...[...cards].reverse().map((card) => cardRow(deck, card))),
      ]
    : [];

  show(
    `${deck.name} | Flashcards`,
    h("a", { class: "back", href: "#/", text: "All decks" }),
    head,
    drawer(cards),
    h("p", { class: "drawer-note", text: "Cards you get right move up a box. Cards you miss go back to box 1. Lower boxes come up more often." }),
    form,
    ...list
  );
}

async function renameDeck(deck) {
  const values = await openForm({ title: "Rename deck", fields: [{ name: "name", label: "Deck name", value: deck.name }] });
  if (!values) return;
  deck.name = values.name;
  save();
  renderDeck(deck);
  focusHeading();
}

async function deleteDeck(deck) {
  const ok = await openForm({
    title: `Delete "${deck.name}"?`,
    text: `This deletes the deck and its ${plural(deck.cards.length, "card")}. It can't be undone.`,
    submit: "Delete deck",
    danger: true,
  });
  if (!ok) return;
  state.decks = state.decks.filter((d) => d.id !== deck.id);
  save();
  location.hash = "#/";
  toast("Deck deleted.");
}

async function editCard(deck, card) {
  const values = await openForm({
    title: "Edit card",
    fields: [
      { name: "front", label: "Front (question)", value: card.front, multiline: true },
      { name: "back", label: "Back (answer)", value: card.back, multiline: true },
    ],
  });
  if (!values) return;
  card.front = values.front;
  card.back = values.back;
  save();
  renderDeck(deck);
}

function deleteCard(deck, card) {
  const index = deck.cards.indexOf(card);
  deck.cards.splice(index, 1);
  save();
  renderDeck(deck);
  toast("Card deleted.", "Undo", () => {
    deck.cards.splice(Math.min(index, deck.cards.length), 0, card); // put it back where it was
    save();
    if (location.hash === `#/deck/${deck.id}`) renderDeck(deck);
  });
}

// ---------- Studying ----------
function renderStudy(deck) {
  if (deck.cards.length === 0) {
    location.replace(`#/deck/${deck.id}`);
    return;
  }
  if (!session || session.deckId !== deck.id) session = startSession(deck);
  if (session.queue.length === 0) {
    renderSummary(deck);
    return;
  }

  const card = deck.cards.find((c) => c.id === session.queue[0]);
  const second = session.missed.has(card.id);
  session.flipped = false;

  const flipBtn = h(
    "button",
    { type: "button", class: "flip deal", onclick: toggleFlip },
    h(
      "span",
      { class: "flip-inner" },
      h(
        "span",
        { class: "paper face face-front", "aria-hidden": "true" },
        h("span", { class: "eyebrow", text: second ? "Question, another go" : "Question" }),
        h("span", { class: "face-text", text: card.front })
      ),
      h(
        "span",
        { class: "paper face face-back", "aria-hidden": "true" },
        h("span", { class: "eyebrow", text: "Answer" }),
        h("span", { class: "face-text", text: card.back })
      )
    )
  );

  const again = h("button", { type: "button", class: "btn again", disabled: true, onclick: () => answer(false) }, "Again ", h("kbd", { "aria-hidden": "true", text: "←" }));
  const gotIt = h("button", { type: "button", class: "btn gotit", disabled: true, onclick: () => answer(true) }, "Got it ", h("kbd", { "aria-hidden": "true", text: "→" }));
  ui = { card, flipBtn, again, gotIt };
  syncFlip();

  const shown = Math.min(session.done.size + 1, session.total);
  const bar = h("div", { class: "progress", role: "progressbar", "aria-label": "Cards finished", "aria-valuemin": "0", "aria-valuemax": String(session.total), "aria-valuenow": String(session.done.size) }, h("span", { style: `width: ${(session.done.size / session.total) * 100}%` }));

  show(
    `Studying ${deck.name} | Flashcards`,
    h(
      "div",
      { class: "study" },
      h("div", { class: "study-head" }, h("a", { class: "back", href: `#/deck/${deck.id}`, text: "End session" }), h("p", { class: "count", text: `Card ${shown} of ${session.total}` })),
      bar,
      drawer(deck.cards, card.box),
      flipBtn,
      h("p", { class: "tap-hint", text: "Tap the card or press Space to flip it." }),
      h("div", { class: "answer-row" }, again, gotIt)
    )
  );
  flipBtn.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function toggleFlip() {
  session.flipped = !session.flipped;
  syncFlip();
}

function syncFlip() {
  const { card, flipBtn, again, gotIt } = ui;
  const flipped = session.flipped;
  flipBtn.classList.toggle("is-flipped", flipped);
  flipBtn.setAttribute("aria-label", flipped ? `Answer: ${card.back}. Press to show the question again.` : `Question: ${card.front}. Press to show the answer.`);
  again.disabled = !flipped;
  gotIt.disabled = !flipped;
}

function answer(gotIt) {
  if (!session || !session.flipped) return; // you have to see the answer first
  const deck = state.decks.find((d) => d.id === session.deckId);
  const id = session.queue.shift();
  const card = deck.cards.find((c) => c.id === id);
  let message;

  if (gotIt) {
    // A card you missed earlier in this sitting doesn't climb when you finally get it
    if (!session.missed.has(id) && card.box < MAX_BOX) {
      card.box++;
      session.up++;
      message = `Got it. Moved up to box ${card.box}.`;
    } else {
      message = "Got it.";
    }
    session.done.add(id);
  } else {
    card.box = 1;
    session.missed.add(id);
    // show it again soon, after a few other cards
    session.queue.splice(Math.min(RETRY_GAP, session.queue.length), 0, id);
    message = "Again. Back to box 1. It will come back soon.";
  }

  save();
  announce(message);
  renderStudy(deck);
}

function renderSummary(deck) {
  const total = session.total;
  const firstTry = total - session.missed.size;
  const missedCards = deck.cards.filter((c) => session.missed.has(c.id));

  const parts = [
    h("span", { class: "eyebrow", text: "Session finished" }),
    h("h1", { tabindex: "-1", text: "Nice work." }),
    h("p", { class: "big-score" }, `${firstTry} `, h("small", { text: `of ${total} right first time` })),
    h("p", { text: session.up === 0 ? "No cards moved up a box this time." : `${plural(session.up, "card")} moved up a box.` }),
  ];

  if (missedCards.length) {
    parts.push(h("h2", { text: "Needed another go:" }), h("ul", {}, ...missedCards.map((c) => h("li", { text: c.front }))));
  }

  parts.push(
    h(
      "div",
      { class: "actions" },
      h("button", { type: "button", class: "btn primary", text: "Study again", onclick: () => { session = null; render(); } }),
      h("a", { class: "btn", href: `#/deck/${deck.id}`, text: "Back to deck" })
    )
  );

  show(`Done | ${deck.name}`, h("div", { class: "paper summary" }, ...parts));
  focusHeading();
}

// ---------- Keyboard shortcuts while studying ----------
document.addEventListener("keydown", (event) => {
  if (!session || session.queue.length === 0 || !location.hash.startsWith("#/study/")) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (document.querySelector("dialog[open]")) return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;

  if (event.key === "ArrowLeft" || event.key === "1") {
    if (session.flipped) {
      event.preventDefault();
      answer(false);
    }
  } else if (event.key === "ArrowRight" || event.key === "2") {
    if (session.flipped) {
      event.preventDefault();
      answer(true);
    }
  } else if (event.key === " " && event.target === document.body) {
    event.preventDefault(); // otherwise the page scrolls
    toggleFlip();
  }
});

// ---------- Start ----------
window.addEventListener("hashchange", render);
state = loadState();
save(); // saves the starter deck on the first visit, so its links keep working
render();