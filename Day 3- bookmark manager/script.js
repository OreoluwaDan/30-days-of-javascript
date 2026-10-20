// ---------- State ----------
const STORAGE_KEY = "bookmark-manager-v1";

let bookmarks = loadBookmarks();
let activeTag = null; // currently selected tag filter (or null for "all")
let searchQuery = ""; // current search text

// ---------- DOM elements ----------
const form = document.getElementById("bookmark-form");
const titleInput = document.getElementById("title");
const urlInput = document.getElementById("url");
const tagsInput = document.getElementById("tags");
const formError = document.getElementById("form-error");
const searchInput = document.getElementById("search");
const tagFiltersEl = document.getElementById("tag-filters");
const countEl = document.getElementById("count");
const listEl = document.getElementById("bookmark-list");

// ---------- Storage ----------
function loadBookmarks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    return [];
  }
}

function saveBookmarks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch (error) {
    // Storage may be unavailable (private mode); app still works for this session.
  }
}

// ---------- Helpers ----------
function normalizeUrl(raw) {
  let value = raw.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    value = "https://" + value;
  }
  try {
    const parsed = new URL(value);
    // Require a dot in the hostname (e.g. example.com) to catch obvious typos
    if (!parsed.hostname.includes(".")) return null;
    return parsed.href;
  } catch (error) {
    return null;
  }
}

function parseTags(raw) {
  const cleaned = raw
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag !== "");
  return [...new Set(cleaned)]; // remove duplicates
}

function getAllTags() {
  const allTags = bookmarks.flatMap((b) => b.tags);
  return [...new Set(allTags)].sort();
}

function getVisibleBookmarks() {
  const query = searchQuery.trim().toLowerCase();

  return bookmarks.filter((b) => {
    const matchesTag = activeTag === null || b.tags.includes(activeTag);

    const matchesSearch =
      query === "" ||
      b.title.toLowerCase().includes(query) ||
      b.url.toLowerCase().includes(query) ||
      b.tags.some((tag) => tag.includes(query));

    return matchesTag && matchesSearch;
  });
}

// ---------- Actions ----------
function addBookmark(title, url, tags) {
  const newBookmark = {
    id: Date.now(),
    title,
    url,
    tags,
  };
  bookmarks = [newBookmark, ...bookmarks]; // newest first
  saveBookmarks();
  render();
}

function deleteBookmark(id) {
  bookmarks = bookmarks.filter((b) => b.id !== id);

  // If the active tag no longer exists, reset the filter
  if (activeTag !== null && !getAllTags().includes(activeTag)) {
    activeTag = null;
  }

  saveBookmarks();
  render();
}

function setActiveTag(tag) {
  activeTag = activeTag === tag ? null : tag; // click again to clear
  render();
}

// ---------- Rendering ----------
function renderTagFilters() {
  tagFiltersEl.innerHTML = "";
  const tags = getAllTags();
  if (tags.length === 0) return;

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "tag-btn" + (activeTag === null ? " active" : "");
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => {
    activeTag = null;
    render();
  });
  tagFiltersEl.appendChild(allBtn);

  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-btn" + (activeTag === tag ? " active" : "");
    btn.textContent = tag;
    btn.addEventListener("click", () => setActiveTag(tag));
    tagFiltersEl.appendChild(btn);
  });
}

function renderList() {
  const visible = getVisibleBookmarks();
  listEl.innerHTML = "";

  countEl.textContent =
    visible.length === bookmarks.length
      ? `${bookmarks.length} bookmark${bookmarks.length === 1 ? "" : "s"}`
      : `Showing ${visible.length} of ${bookmarks.length}`;

  if (visible.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent =
      bookmarks.length === 0
        ? "No bookmarks yet. Add your first one above."
        : "No bookmarks match your search or filter.";
    listEl.appendChild(empty);
    return;
  }

  visible.forEach((b) => {
    const li = document.createElement("li");
    li.className = "bookmark";

    const info = document.createElement("div");
    info.className = "bookmark-info";

    const link = document.createElement("a");
    link.className = "bookmark-title";
    link.href = b.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = b.title;

    const urlText = document.createElement("div");
    urlText.className = "bookmark-url";
    urlText.textContent = b.url;

    const tagsWrap = document.createElement("div");
    tagsWrap.className = "bookmark-tags";
    b.tags.forEach((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = "#" + tag;
      chip.addEventListener("click", () => setActiveTag(tag));
      tagsWrap.appendChild(chip);
    });

    info.append(link, urlText, tagsWrap);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.setAttribute("aria-label", `Delete ${b.title}`);
    deleteBtn.addEventListener("click", () => deleteBookmark(b.id));

    li.append(info, deleteBtn);
    listEl.appendChild(li);
  });
}

function render() {
  renderTagFilters();
  renderList();
}

// ---------- Events ----------
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const url = normalizeUrl(urlInput.value);
  const tags = parseTags(tagsInput.value);

  if (!title) {
    formError.textContent = "Please enter a title.";
    titleInput.focus();
    return;
  }

  if (!url) {
    formError.textContent = "Please enter a valid URL (e.g. example.com).";
    urlInput.focus();
    return;
  }

  formError.textContent = "";
  addBookmark(title, url, tags);
  form.reset();
  titleInput.focus();
});

searchInput.addEventListener("input", (event) => {
  searchQuery = event.target.value;
  renderList(); // tag buttons don't change while searching
});

// ---------- Init ----------
render();
