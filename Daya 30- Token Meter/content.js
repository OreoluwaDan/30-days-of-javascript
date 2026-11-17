(() => {
  "use strict";

  /* ==========================================================
     Token Meter v2
     Estimates tokens per reply and keeps a running total until you reset it.
     Everything is an ESTIMATE: English text averages about 4 characters per token.

     Two numbers per reply:
       Last reply = the reply's own text
       Last turn  = the reply PLUS the chat Claude had to re-read to write it
     The running total adds up the "turn" numbers, because that is closer to what is really used.
     ========================================================== */

  // Change these to suit you.
  const CHARS_PER_TOKEN = 4;
  const LONG = 15000;       // chat size turns amber
  const VERY_LONG = 40000;  // chat size turns red, bar is full
  const SETTLE_MS = 1500;   // how long the page must be quiet before a reply counts as finished

  // Where messages live on the page. If claude.ai changes its layout and replies
  // stop being found, update these (right-click a message > Inspect).
  const USER_SEL = '[data-testid="user-message"]';
  const BOT_SEL = ".font-claude-response, .font-claude-message";
  const ALL_SEL = `${USER_SEL}, ${BOT_SEL}`;
  const STREAMING_SEL = '[data-is-streaming="true"]';

  /* ---------- Saved numbers (shared by all your claude.ai tabs) ---------- */

  const DEFAULTS = { total: 0, turns: 0, since: Date.now(), lastReply: 0, lastTurn: 0, collapsed: false };
  let state = { ...DEFAULTS };

  const save = () => chrome.storage.local.set({ tm: state });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.tm?.newValue) {
      state = { ...DEFAULTS, ...changes.tm.newValue };
      render();
    }
  });

  /* ---------- Building the card ---------- */

  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  };

  function mark() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("aria-hidden", "true");
    [[1.5, 9, 3], [6.5, 5, 7], [11.5, 1.5, 11]].forEach(([x, y, height]) => {
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", 16 - height - 1);
      rect.setAttribute("width", "3");
      rect.setAttribute("height", height);
      rect.setAttribute("rx", "1");
      rect.setAttribute("fill", "currentColor");
      svg.append(rect);
    });
    return svg;
  }

  const root = h("div");
  root.id = "token-meter";

  // Small pill, shown when minimised
  const pill = h("button", "tm-pill");
  pill.type = "button";
  pill.title = "Token Meter: running total. Click to open.";
  const pillTotal = h("span", "tm-pill-total");
  pill.append(mark(), pillTotal);

  // Full card
  const card = h("div", "tm-card");
  const minBtn = h("button", "tm-min", "–");
  minBtn.type = "button";
  minBtn.setAttribute("aria-label", "Minimise Token Meter");
  const head = h("div", "tm-head");
  head.append(mark(), h("span", "tm-title", "Token Meter"), minBtn);

  const since = h("div", "tm-since");
  const big = h("span", "tm-big");
  const total = h("div", "tm-total");
  total.append(big, h("span", "tm-unit", "tokens"));
  const turns = h("div", "tm-turns");
  const hero = h("div", "tm-hero");
  hero.append(since, total, turns);

  function row(label, hint) {
    const wrap = h("div", "tm-row");
    wrap.title = hint;
    const value = h("span", "tm-val");
    wrap.append(h("span", "tm-label", label), value);
    return { wrap, value };
  }
  const rLast = row("Last reply", "The estimated size of Claude's newest reply.");
  const rTurn = row("Last turn", "The reply plus all the chat Claude had to re-read to write it. This is closer to real usage.");
  const rChat = row("This chat", "The estimated size of the whole chat on screen.");
  const rows = h("div", "tm-rows");
  rows.append(rLast.wrap, rTurn.wrap, rChat.wrap);

  const bar = h("div", "tm-bar");
  const fill = h("span", "tm-fill");
  bar.append(fill);

  const note = h("p", "tm-note");

  const resetBtn = h("button", "tm-reset", "Reset total");
  resetBtn.type = "button";
  const foot = h("div", "tm-foot");
  foot.append(resetBtn, h("span", "tm-est", "Estimates only"));

  card.append(head, hero, rows, bar, note, foot);
  root.append(pill, card);
  document.body.append(root);

  /* ---------- Showing the numbers ---------- */

  const dateFormat = new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  function format(n) {
    if (n < 1000) return String(n);
    if (n < 100000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    if (n < 1000000) return Math.round(n / 1000) + "k";
    return (n / 1000000).toFixed(2).replace(/0$/, "") + "M";
  }

  let chatTokens = 0;
  let canTrackReplies = true;

  function render() {
    root.dataset.collapsed = String(state.collapsed);
    pillTotal.textContent = format(state.total);
    big.textContent = format(state.total);
    since.textContent = `Since ${dateFormat.format(state.since)}`;
    turns.textContent = state.turns === 1 ? "across 1 reply" : `across ${state.turns} replies`;
    rLast.value.textContent = state.turns ? `~${format(state.lastReply)}` : "none yet";
    rTurn.value.textContent = state.turns ? `~${format(state.lastTurn)}` : "none yet";
    rChat.value.textContent = `~${format(chatTokens)}`;

    const level = chatTokens >= VERY_LONG ? "very-long" : chatTokens >= LONG ? "long" : "ok";
    root.dataset.state = level;
    fill.style.width = `${Math.min(100, (chatTokens / VERY_LONG) * 100)}%`;
    note.textContent = !canTrackReplies
      ? "Can't find individual replies on this page, so the total won't grow. Chat size is a rough count of the page."
      : level === "very-long" ? "Very long chat. A new chat will use fewer tokens."
      : level === "long" ? "Getting long. Each message re-reads the whole chat."
      : "";
  }

  function flash() {
    [rLast.wrap, rTurn.wrap].forEach((el) => {
      el.classList.remove("tm-flash");
      void el.offsetWidth;
      el.classList.add("tm-flash");
    });
  }

  /* ---------- Reading the chat ---------- */

  function messages() {
    // Skip anything nested inside another matching element, so nothing is counted twice.
    return [...document.querySelectorAll(ALL_SEL)]
      .filter((node) => !node.parentElement?.closest(ALL_SEL))
      .map((node) => ({ node, user: node.matches(USER_SEL), chars: node.innerText.length }));
  }

  function refreshSize() {
    const msgs = messages();
    canTrackReplies = msgs.length > 0;
    let chars;
    if (msgs.length) chars = msgs.reduce((sum, m) => sum + m.chars, 0);
    else if (document.querySelector("main")) chars = document.querySelector("main").innerText.length;
    else chars = Math.max(0, document.body.innerText.length - root.innerText.length);
    chatTokens = Math.round(chars / CHARS_PER_TOKEN);
    render();
  }

  /* ---------- Counting finished replies ---------- */

  const seen = new WeakSet();   // messages we've already dealt with
  let needsBaseline = true;     // true on load and after switching chats
  let path = location.pathname;
  let sizeTimer, settleTimer;

  function scan() {
    // Claude is still typing: check again shortly.
    if (document.querySelector(STREAMING_SEL)) {
      settleTimer = setTimeout(scan, 800);
      return;
    }
    const msgs = messages();
    if (!msgs.length) return;

    // Opening an existing chat: everything on screen is history, not new usage.
    // (One or two messages is treated as a brand-new chat, so its first reply counts.)
    if (needsBaseline) {
      needsBaseline = false;
      if (msgs.length > 2) {
        msgs.forEach((m) => seen.add(m.node));
        return;
      }
    }

    let before = 0;   // characters of everything above this message
    let counted = false;
    for (const m of msgs) {
      if (!m.chars) continue;
      if (!seen.has(m.node) && !m.user) {
        const reply = Math.round(m.chars / CHARS_PER_TOKEN);
        const turn = Math.round((before + m.chars) / CHARS_PER_TOKEN);
        state.total += turn;
        state.turns += 1;
        state.lastReply = reply;
        state.lastTurn = turn;
        counted = true;
      }
      seen.add(m.node);
      before += m.chars;
    }
    if (counted) {
      save();
      render();
      flash();
    }
  }

  // claude.ai changes pages without reloading, so notice when the chat changes.
  function checkRoute() {
    if (location.pathname !== path) {
      path = location.pathname;
      needsBaseline = true;
    }
  }

  /* ---------- Buttons ---------- */

  minBtn.addEventListener("click", () => { state.collapsed = true; save(); render(); });
  pill.addEventListener("click", () => { state.collapsed = false; save(); render(); });

  let confirmTimer;
  resetBtn.addEventListener("click", () => {
    if (!resetBtn.classList.contains("tm-confirm")) {
      resetBtn.classList.add("tm-confirm");
      resetBtn.textContent = "Tap again to reset";
      confirmTimer = setTimeout(cancelConfirm, 3000);
      return;
    }
    clearTimeout(confirmTimer);
    cancelConfirm();
    state = { ...state, total: 0, turns: 0, lastReply: 0, lastTurn: 0, since: Date.now() };
    save();
    render();
  });

  function cancelConfirm() {
    resetBtn.classList.remove("tm-confirm");
    resetBtn.textContent = "Reset total";
  }

  /* ---------- Staying up to date ----------
     Wait for the page to go quiet before measuring, so a streaming reply isn't counted halfway. */

  new MutationObserver((records) => {
    // Ignore changes we make ourselves, or updating would trigger itself forever.
    if (records.every((record) => root.contains(record.target))) return;
    checkRoute();
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(refreshSize, 400);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(scan, SETTLE_MS);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  chrome.storage.local.get("tm").then(({ tm }) => {
    state = { ...DEFAULTS, ...tm };
    if (!tm) save(); // remember when recording started
    refreshSize();
    settleTimer = setTimeout(scan, SETTLE_MS);
  });

  console.log("[Token Meter] running");
})();