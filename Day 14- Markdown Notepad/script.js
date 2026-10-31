"use strict";

// ---------- Settings ----------
const STORAGE_KEY = "markdown-notes-v1";
const SAVE_DELAY = 350; // wait this long after typing stops before saving
const TOAST_MS = 6000;
const FENCE = "`".repeat(3); // three backticks, built here so they can sit inside this file

// ---------- Starter notes ----------
const STARTER_NOTES = [
  [
    "# Welcome",
    "",
    "Write on the left. The page on the right updates as you type.",
    "",
    "## What you can use",
    "",
    "Wrap words in **two stars** for bold, one star for *italic*, and two tildes to ~~cross out~~. Use `backticks` for code. A [link](https://developer.mozilla.org/en-US/docs/Web/JavaScript) takes one line.",
    "",
    "- Start a line with a dash for a bullet",
    "- Press Enter and the next bullet appears on its own",
    "  - Indent two spaces to put one inside another",
    "",
    "1. Numbers work too",
    "2. They count themselves",
    "",
    "> Quotes start with a greater-than sign.",
    "",
    "## Checklists",
    "",
    "- [x] Open the app",
    "- [ ] Click this box in the preview and watch the note change",
    "- [ ] Select some text and press Ctrl + B",
    "",
    "## Code",
    "",
    FENCE + "js",
    "const greet = (name) => `Hello, ${name}`;",
    'console.log(greet("world"));',
    FENCE,
    "",
    "---",
    "",
    "Everything is saved in this browser. Nothing leaves your device.",
  ].join("\n"),
  [
    "# Weekend plan",
    "",
    "## Saturday",
    "",
    "- [x] Finish the notes app",
    "- [ ] Push it to GitHub",
    "- [ ] Deploy it on Vercel",
    "",
    "## Sunday",
    "",
    "- [ ] Read one article about closures",
    "- [ ] Pick next week's project",
  ].join("\n"),
];

// ---------- State ----------
let notes = []; // [{ id, text, updated }]
let activeId = null;
let query = "";
let storageProblem = false;
let saveTimer = null;
let toastTimer = null;

// ---------- Small helpers ----------
const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Builds an element. Text always goes in with textContent, so note text can never run as HTML.
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children);
  return node;
}

// Turn the characters HTML treats specially into harmless text
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// ============================================================
//  The Markdown converter
//  Step 1 (blocks): go line by line and decide what each line is.
//  Step 2 (inline): inside a line, find **bold**, `code`, [links] and so on.
//  Everything is escaped first, so typing <script> shows as text.
// ============================================================

// Only allow links that are safe. "javascript:" and friends are refused.
// The url comes in already escaped, and goes out already escaped.
function safeUrl(escaped) {
  const plain = escaped.replace(/&amp;/g, "&");
  if (/^(https?:|mailto:)/i.test(plain) || /^(#|\/|\.\.?\/)/.test(plain)) return escaped;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(plain)) return "https://" + escaped; // "example.com"
  return null;
}

function emphasis(s) {
  return s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, "$1<strong>$2</strong>")
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<del>$1</del>")
    .replace(/\*(?=[^\s*])([^*\n]*?[^\s*])\*/g, "<em>$1</em>")
    .replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, "$1<em>$2</em>");
}

function renderInline(source) {
  // Finished pieces (code, links) are set aside as numbered markers so later steps leave them alone
  const kept = [];
  const keep = (html) => {
    kept.push(html);
    return "\u0000" + (kept.length - 1) + "\u0000";
  };

  let t = source.replace(/\u0000/g, "");
  t = t.replace(/`([^`\n]+)`/g, (m, code) => keep("<code>" + esc(code) + "</code>"));
  t = t.replace(/\\([\\*_`~\[\]()#+\-.!>])/g, (m, ch) => keep(esc(ch))); // \* shows a plain star
  t = esc(t);

  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
    const safe = safeUrl(url);
    return safe && /^https?:/i.test(safe) ? keep(`<img src="${safe}" alt="${alt}" loading="lazy">`) : m;
  });

  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const safe = safeUrl(url);
    if (!safe) return label; // unsafe link: keep the words, drop the link
    return keep(`<a href="${safe}" target="_blank" rel="noopener noreferrer">${emphasis(label)}</a>`);
  });

  // Plain web addresses become links too
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g, (m, before, url) => {
    return before + keep(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  });

  t = t.replace(/(?: {2,}|\\)\n/g, "<br>\n"); // two spaces or a backslash at the end of a line
  t = emphasis(t);

  while (/\u0000\d+\u0000/.test(t)) {
    t = t.replace(/\u0000(\d+)\u0000/g, (m, i) => kept[i]);
  }
  return t;
}

const RE = {
  heading: /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/,
  hr: /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/,
  fence: /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/,
  fenceEnd: /^ {0,3}(`{3,}|~{3,})\s*$/,
  quote: /^ {0,3}>\s?(.*)$/,
  ul: /^(\s*)([-*+])\s+(.*)$/,
  ol: /^(\s*)(\d{1,9})[.)]\s+(.*)$/,
  task: /^\[( |x|X)\]\s+(.*)$/,
};

// Does this line start something other than a plain paragraph?
function startsBlock(line) {
  return (
    RE.fence.test(line) ||
    RE.heading.test(line) ||
    RE.hr.test(line) ||
    RE.quote.test(line) ||
    RE.ul.test(line) ||
    /^\s*1[.)]\s+/.test(line) // a numbered list may interrupt a paragraph only if it starts at 1
  );
}

function codeBlock(body, lang, interactive) {
  const cls = lang ? ` class="language-${esc(lang)}"` : "";
  const pre = `<pre><code${cls}>${esc(body)}</code></pre>`;
  return interactive ? `<div class="code"><button type="button" class="copy-code">Copy</button>${pre}</div>` : pre;
}

// Lists can nest: a deeper indent opens a list inside the previous item.
function renderList(items, interactive) {
  let html = "";
  const stack = []; // open lists: { indent, type }

  for (const item of items) {
    while (stack.length && item.indent < stack[stack.length - 1].indent) {
      html += "</li></" + stack.pop().type + ">";
    }
    const top = stack[stack.length - 1];

    if (!top || item.indent > top.indent) {
      const start = item.type === "ol" && item.num !== 1 ? ` start="${item.num}"` : "";
      html += `<${item.type}${start}>`;
      stack.push({ indent: item.indent, type: item.type });
    } else {
      html += "</li>";
      if (top.type !== item.type) {
        html += `</${top.type}><${item.type}>`;
        top.type = item.type;
      }
    }

    const task = item.text.match(RE.task);
    if (task) {
      const checked = task[1] !== " " ? " checked" : "";
      const state = interactive ? "" : " disabled";
      html +=
        `<li class="task"><input type="checkbox" class="task-box" data-line="${item.line}"${checked}${state} aria-label="${esc(task[2])}">` +
        `<span>${renderInline(task[2])}</span>`;
    } else {
      html += "<li>" + renderInline(item.text);
    }
  }

  while (stack.length) html += "</li></" + stack.pop().type + ">";
  return html;
}

function parseBlocks(lines, interactive) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Code block
    let m = line.match(RE.fence);
    if (m) {
      const fence = m[1];
      const body = [];
      i++;
      while (i < lines.length) {
        const end = lines[i].match(RE.fenceEnd);
        if (end && end[1][0] === fence[0] && end[1].length >= fence.length) {
          i++;
          break;
        }
        body.push(lines[i]);
        i++;
      }
      out.push(codeBlock(body.join("\n"), m[2], interactive));
      continue;
    }

    // Heading
    m = line.match(RE.heading);
    if (m) {
      out.push(`<h${m[1].length}>${renderInline(m[2])}</h${m[1].length}>`);
      i++;
      continue;
    }

    // Divider (checked before lists, because "- - -" and "***" look like list items)
    if (RE.hr.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    // Quote: strip the ">" and read what is inside like a small document
    if (RE.quote.test(line)) {
      const inner = [];
      while (i < lines.length && RE.quote.test(lines[i])) {
        inner.push(lines[i].match(RE.quote)[1]);
        i++;
      }
      out.push("<blockquote>" + parseBlocks(inner, false) + "</blockquote>");
      continue;
    }

    // List
    if (RE.ul.test(line) || RE.ol.test(line)) {
      const items = [];
      while (i < lines.length) {
        const ul = lines[i].match(RE.ul);
        const ol = ul ? null : lines[i].match(RE.ol);
        const found = ul || ol;
        if (!found || RE.hr.test(lines[i])) break;
        items.push({
          indent: found[1].replace(/\t/g, "    ").length,
          type: ul ? "ul" : "ol",
          num: ol ? Number(ol[2]) : 0,
          text: found[3],
          line: i,
        });
        i++;
      }
      out.push(renderList(items, interactive));
      continue;
    }

    // Paragraph: keep going until a blank line or the start of something else
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push("<p>" + renderInline(para.join("\n")) + "</p>");
  }

  return out.join("\n");
}

// interactive: true gives clickable checkboxes and copy buttons (for the live preview)
function renderMarkdown(text, interactive = true) {
  return parseBlocks(text.replace(/\r\n?/g, "\n").split("\n"), interactive);
}

// ============================================================
//  The editor's coloured copy of the text (Markdown symbols dimmed)
//  It must contain exactly the same characters as the textarea, only wrapped in spans.
// ============================================================
function highlight(text) {
  let inFence = false;

  const html = text
    .split("\n")
    .map((line) => {
      let s = esc(line);

      if (/^ {0,3}(`{3,}|~{3,})/.test(line)) {
        inFence = !inFence;
        return `<span class="md-dim">${s}</span>`;
      }
      if (inFence) return `<span class="md-code">${s}</span>`;

      // inline marks first, then the marks at the start of the line
      s = s.replace(/(`[^`\n]+`)/g, '<span class="md-code">$1</span>');
      s = s.replace(/(\*\*)(?=\S)(.+?\S)(\*\*)/g, '<span class="md-dim">$1</span>$2<span class="md-dim">$3</span>');
      s = s.replace(/(~~)(?=\S)(.+?\S)(~~)/g, '<span class="md-dim">$1</span>$2<span class="md-dim">$3</span>');
      s = s.replace(/(^|[^*\\])(\*)(?=[^\s*])([^*\n]*?[^\s*])(\*)(?!\*)/g, '$1<span class="md-dim">$2</span>$3<span class="md-dim">$4</span>');
      s = s.replace(/(\[)([^\]\n]+)(\]\()([^)\s]+)(\))/g, '<span class="md-dim">$1</span>$2<span class="md-dim">$3</span><span class="md-url">$4</span><span class="md-dim">$5</span>');

      s = s.replace(/^( {0,3}#{1,6}\s)(.*)$/, '<span class="md-dim">$1</span><span class="md-head">$2</span>');
      s = s.replace(/^(\s*(?:[-*+]|\d{1,9}[.)])\s)(\[[ xX]\]\s)?/, (m, marker, task) =>
        `<span class="md-dim">${marker}${task || ""}</span>`
      );
      s = s.replace(/^(\s*(?:&gt;\s?)+)/, '<span class="md-dim">$1</span>');
      if (RE.hr.test(line)) s = `<span class="md-dim">${s}</span>`;
      return s;
    })
    .join("\n");

  return html + "\n"; // the extra line keeps the height the same when the text ends with a new line
}

// ============================================================
//  Saving and loading
// ============================================================
function starterState() {
  const now = Date.now();
  const list = STARTER_NOTES.map((text, i) => ({ id: uid(), text, updated: now - i * 30 * 3600 * 1000 }));
  return { notes: list, activeId: list[0].id };
}

function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    storageProblem = true; // storage is blocked: the app still works for this visit
  }
  if (raw !== null) {
    try {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.notes)) {
        const clean = data.notes
          .filter((n) => n && typeof n.text === "string")
          .map((n) => ({ id: String(n.id || uid()), text: n.text, updated: Number(n.updated) || Date.now() }));
        if (clean.length) {
          const active = clean.find((n) => n.id === data.activeId) || clean[0];
          return { notes: clean, activeId: active.id };
        }
      }
    } catch (error) {
      // Broken data: fall through to the starter notes
    }
  }
  return starterState();
}

function setStatus(message) {
  $("status").textContent = message;
}

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, activeId }));
    setStatus("Saved");
  } catch (error) {
    storageProblem = true;
    setStatus("Not saved. Your browser is blocking storage.");
  }
}

function scheduleSave() {
  setStatus("Saving...");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, SAVE_DELAY);
}

// ============================================================
//  Notes
// ============================================================
const editor = $("editor");
const overlay = $("highlight");
const preview = $("preview");
const editorScroll = $("editor-scroll");
const layout = $("layout");

const activeNote = () => notes.find((n) => n.id === activeId);

// "## Heading", "- [ ] task" and so on, without the symbols
function plain(line) {
  return line
    .replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}

function noteTitle(note) {
  const first = note.text.split("\n").find((l) => l.trim());
  return (first && plain(first)) || "Untitled";
}

// A short preview for the list: skips headings, and separates items with commas
function noteSnippet(note) {
  const lines = note.text
    .split("\n")
    .slice(note.text.split("\n").findIndex((l) => l.trim()) + 1) // everything after the title line
    .filter((l) => l.trim() && !/^\s*#{1,6}\s/.test(l) && !RE.hr.test(l) && !RE.fence.test(l))
    .slice(0, 4)
    .map(plain)
    .filter(Boolean);
  return lines.reduce((text, line, i) => text + (i === 0 ? "" : /[.!?:]$/.test(lines[i - 1]) ? " " : ", ") + line, "").slice(0, 140);
}

function dateLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  const opts = d.getFullYear() === now.getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" };
  return d.toLocaleDateString("en", opts);
}

function renderNoteList() {
  const q = query.trim().toLowerCase();
  const shown = [...notes]
    .sort((a, b) => b.updated - a.updated)
    .filter((n) => !q || n.text.toLowerCase().includes(q));

  $("note-list").replaceChildren(
    ...shown.map((note) =>
      h(
        "li",
        {},
        h(
          "button",
          { type: "button", class: "note-item", "data-id": note.id, "aria-current": note.id === activeId ? "true" : "false" },
          h("span", { class: "note-top" }, h("span", { class: "note-title", text: noteTitle(note) }), h("span", { class: "note-date", text: dateLabel(note.updated) })),
          noteSnippet(note) ? h("span", { class: "note-snippet", text: noteSnippet(note) }) : ""
        )
      )
    )
  );

  const empty = $("no-results");
  empty.hidden = shown.length > 0;
  empty.textContent = shown.length ? "" : `No notes match "${query.trim()}".`;
}

function updateMeta() {
  const note = activeNote();
  const words = note.text.trim() ? note.text.trim().split(/\s+/).length : 0;
  $("count").textContent = `${words} ${words === 1 ? "word" : "words"}`;
  const title = noteTitle(note);
  $("doc-title").textContent = title;
  document.title = `${title} | Markdown notes`;
}

function updateOverlay() {
  overlay.innerHTML = highlight(editor.value);
}

function renderPreview() {
  const text = activeNote().text;
  preview.innerHTML = text.trim() ? renderMarkdown(text, true) : '<p class="placeholder">Nothing to preview yet. Start typing on the left.</p>';
}

// Show the active note in the editor and the preview
function loadActive() {
  const note = activeNote();
  editor.value = note.text;
  updateOverlay();
  renderPreview();
  updateMeta();
  editorScroll.scrollTop = 0;
  $("preview-pane").scrollTop = 0;
}

function selectNote(id) {
  if (id === activeId) return;
  activeId = id;
  loadActive();
  renderNoteList();
  saveNow();
}

function newNote() {
  // Reuse a blank note instead of piling up empty ones
  const blank = notes.find((n) => !n.text.trim());
  if (blank) {
    blank.updated = Date.now();
    activeId = blank.id;
  } else {
    const note = { id: uid(), text: "", updated: Date.now() };
    notes.push(note);
    activeId = note.id;
  }
  loadActive();
  renderNoteList();
  saveNow();
  setPane("write");
  closeNotes();
  editor.focus();
}

function deleteNote() {
  const note = activeNote();
  const index = notes.indexOf(note);
  notes.splice(index, 1);

  let blankId = null;
  if (notes.length === 0) {
    const blank = { id: uid(), text: "", updated: Date.now() };
    notes.push(blank);
    blankId = blank.id;
  }
  activeId = [...notes].sort((a, b) => b.updated - a.updated)[0].id;
  loadActive();
  renderNoteList();
  saveNow();

  toast("Note deleted.", "Undo", () => {
    notes = notes.filter((n) => n.id !== blankId || n.text.trim()); // drop the blank note we made, if still empty
    notes.splice(Math.min(index, notes.length), 0, note);
    activeId = note.id;
    loadActive();
    renderNoteList();
    saveNow();
  });
}

// ---------- Typing ----------
function onInput() {
  const note = activeNote();
  note.text = editor.value;
  note.updated = Date.now();
  updateOverlay();
  renderPreview();
  updateMeta();
  renderNoteList();
  scheduleSave();
}

// Keep the preview at about the same place as the editor
editorScroll.addEventListener("scroll", () => {
  const pane = $("preview-pane");
  const room = editorScroll.scrollHeight - editorScroll.clientHeight;
  if (room <= 0) return;
  pane.scrollTop = (editorScroll.scrollTop / room) * (pane.scrollHeight - pane.clientHeight);
});

// Put text where the cursor is. execCommand keeps Ctrl + Z working; setRangeText is the backup.
function insertText(str) {
  editor.focus();
  if (!document.execCommand("insertText", false, str)) {
    editor.setRangeText(str, editor.selectionStart, editor.selectionEnd, "end");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function deleteSelection() {
  if (!document.execCommand("delete")) {
    editor.setRangeText("", editor.selectionStart, editor.selectionEnd, "end");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

// Ctrl + B and Ctrl + I: wrap the selected words, or take the marks off again
function wrapSelection(mark) {
  const { selectionStart: s, selectionEnd: t, value } = editor;
  const chosen = value.slice(s, t);

  if (value.slice(s - mark.length, s) === mark && value.slice(t, t + mark.length) === mark) {
    editor.setSelectionRange(s - mark.length, t + mark.length);
    insertText(chosen);
    editor.setSelectionRange(s - mark.length, s - mark.length + chosen.length);
    return;
  }
  insertText(mark + chosen + mark);
  editor.setSelectionRange(s + mark.length, s + mark.length + chosen.length);
}

// Enter at the end of a list item starts the next one. Enter on an empty item ends the list.
function continueList(event) {
  const { selectionStart: s, selectionEnd: t, value } = editor;
  if (s !== t) return;

  const lineStart = value.lastIndexOf("\n", s - 1) + 1;
  let lineEnd = value.indexOf("\n", s);
  if (lineEnd === -1) lineEnd = value.length;
  if (s !== lineEnd) return; // only when the cursor is at the end of the line

  const m = value.slice(lineStart, lineEnd).match(/^(\s*)([-*+]|(\d{1,9})[.)])\s+(\[[ xX]\]\s+)?(.*)$/);
  if (!m) return;

  event.preventDefault();
  const [, indent, marker, num, task, rest] = m;

  if (!rest.trim()) {
    editor.setSelectionRange(lineStart, lineEnd);
    deleteSelection();
    return;
  }
  const next = num ? Number(num) + 1 + marker.slice(num.length) : marker;
  insertText(`\n${indent}${next} ${task ? "[ ] " : ""}`);
}

function onEditorKeydown(event) {
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (mod && !event.altKey && !event.shiftKey && (key === "b" || key === "i")) {
    event.preventDefault();
    wrapSelection(key === "b" ? "**" : "*");
  } else if (event.key === "Enter" && !mod && !event.shiftKey && !event.altKey && !event.isComposing) {
    continueList(event);
  }
}

// ---------- Preview interactions ----------
function onPreviewChange(event) {
  const box = event.target.closest(".task-box");
  if (!box) return;

  const lineNo = Number(box.dataset.line);
  const note = activeNote();
  const lines = note.text.split("\n");
  lines[lineNo] = lines[lineNo].replace(/\[( |x|X)\]/, box.checked ? "[x]" : "[ ]");
  note.text = lines.join("\n");
  note.updated = Date.now();

  editor.value = note.text;
  updateOverlay();
  renderPreview();
  renderNoteList();
  scheduleSave();

  const again = preview.querySelector(`.task-box[data-line="${lineNo}"]`);
  if (again) again.focus(); // the preview was redrawn, so give the checkbox its focus back
}

async function onPreviewClick(event) {
  const button = event.target.closest(".copy-code");
  if (!button) return;
  const ok = await copyText(button.parentElement.querySelector("code").textContent);
  button.textContent = ok ? "Copied" : "Couldn't copy";
  setTimeout(() => (button.textContent = "Copy"), 1500);
}

// ---------- Copy and download ----------
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Older browsers, or a page that isn't secure: try the old way
    const temp = h("textarea", { "aria-hidden": "true", style: "position:fixed;opacity:0" });
    temp.value = text;
    document.body.append(temp);
    temp.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    temp.remove();
    return ok;
  }
}

async function copyHtml() {
  const html = renderMarkdown(activeNote().text, false);
  toast((await copyText(html)) ? "HTML copied." : "Couldn't copy. Try again.");
}

function downloadNote() {
  const note = activeNote();
  const name = noteTitle(note).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "note";
  const url = URL.createObjectURL(new Blob([note.text], { type: "text/markdown" }));
  const link = h("a", { href: url, download: name + ".md" });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Toast ----------
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

// ---------- Panes and the phone notes panel ----------
function setPane(pane) {
  layout.dataset.pane = pane;
  $("seg-write").setAttribute("aria-pressed", String(pane === "write"));
  $("seg-preview").setAttribute("aria-pressed", String(pane === "preview"));
}

function openNotes() {
  layout.dataset.notesOpen = "true";
  $("notes-toggle").setAttribute("aria-expanded", "true");
  const current = document.querySelector('.note-item[aria-current="true"]') || $("search");
  current.focus();
}

function closeNotes() {
  if (layout.dataset.notesOpen !== "true") return;
  layout.dataset.notesOpen = "false";
  $("notes-toggle").setAttribute("aria-expanded", "false");
}

// ---------- Wiring ----------
editor.addEventListener("input", onInput);
editor.addEventListener("keydown", onEditorKeydown);
preview.addEventListener("change", onPreviewChange);
preview.addEventListener("click", onPreviewClick);

$("note-list").addEventListener("click", (event) => {
  const item = event.target.closest(".note-item");
  if (!item) return;
  selectNote(item.dataset.id);
  closeNotes();
});

$("search").addEventListener("input", (event) => {
  query = event.target.value;
  renderNoteList();
});

$("new-note").addEventListener("click", newNote);
$("delete").addEventListener("click", deleteNote);
$("copy-html").addEventListener("click", copyHtml);
$("download").addEventListener("click", downloadNote);
$("seg-write").addEventListener("click", () => setPane("write"));
$("seg-preview").addEventListener("click", () => setPane("preview"));
$("notes-toggle").addEventListener("click", () => (layout.dataset.notesOpen === "true" ? closeNotes() : openNotes()));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && layout.dataset.notesOpen === "true") {
    closeNotes();
    $("notes-toggle").focus();
  }
});

window.addEventListener("pagehide", () => {
  if (saveTimer) saveNow(); // don't lose the last few letters if the tab closes
});

// ---------- Start ----------
({ notes, activeId } = loadState());
renderNoteList();
loadActive();
saveNow();