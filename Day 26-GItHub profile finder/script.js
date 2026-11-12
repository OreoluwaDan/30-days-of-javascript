"use strict";

/* ==========================================================
   Handle: a GitHub profile finder
   Day 27 of 30 Days of JS.
   Uses the public GitHub API (no key needed).
   ========================================================== */

/* ---------- Config ---------- */

const API = "https://api.github.com";
const RECENT_KEY = "handle:recent";
const CACHE_KEY = "handle:cache";
const CACHE_TTL = 10 * 60 * 1000; // reuse a lookup for 10 minutes
const CACHE_MAX = 8;              // keep at most 8 users in the cache
const REPOS_SHOWN = 8;
const EXAMPLES = ["torvalds", "gaearon", "sindresorhus"];

// GitHub rule: letters, numbers, single hyphens, max 39 characters.
const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

const SORTS = [
  ["recent", "Recently pushed"],
  ["stars", "Most starred"],
];

const LANG_COLORS = {
  JavaScript: "#F1E05A", TypeScript: "#3178C6", Python: "#3572A5", HTML: "#E34C26",
  CSS: "#563D7C", Java: "#B07219", C: "#555555", "C++": "#F34B7D", "C#": "#178600",
  Go: "#00ADD8", Rust: "#DEA584", PHP: "#4F5D95", Ruby: "#701516", Shell: "#89E051",
  Swift: "#F05138", Kotlin: "#A97BFF", Dart: "#00B4AB", Vue: "#41B883",
};

/* ---------- Elements and state ---------- */

const $ = (id) => document.getElementById(id);
const els = {
  form: $("form"),
  input: $("q"),
  go: $("go"),
  recent: $("recent"),
  result: $("result"),
};

let current = null;  // { user, repos, sort } for the profile on screen
let requestId = 0;   // lets us ignore answers from older searches

/* ---------- Tiny DOM helper ----------
   h("a", { href: "..." }, "text", otherElement) builds an element.
   Text goes in as text (never as HTML), so a bio like "<script>"
   can't run code on our page. */

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === "class") el.className = value;
    else el.setAttribute(key, value);
  }
  const kids = children.flat().filter((c) => c != null && c !== false && c !== "");
  el.append(...kids);
  return el;
}

/* ---------- Talking to GitHub ---------- */

class ApiError extends Error {
  constructor(status, resetAt = null) {
    super(`GitHub returned ${status}`);
    this.status = status;
    this.resetAt = resetAt;
  }
}

async function getJson(url) {
  const response = await fetch(url);

  if (response.ok) return response.json();

  if (response.status === 404) throw new ApiError(404);

  // GitHub answers 403 or 429 when you pass the anonymous limit (60 per hour).
  if (response.status === 403 || response.status === 429) {
    const reset = Number(response.headers.get("X-RateLimit-Reset")) * 1000;
    throw new ApiError(429, reset || null);
  }

  throw new ApiError(response.status);
}

// Keep only the fields we use, so the saved copy stays small.
function slimUser(u) {
  return {
    login: u.login, name: u.name, avatar_url: u.avatar_url, bio: u.bio,
    location: u.location, company: u.company, blog: u.blog, html_url: u.html_url,
    created_at: u.created_at, public_repos: u.public_repos,
    followers: u.followers, following: u.following,
  };
}

function slimRepo(r) {
  return {
    name: r.name, description: r.description, language: r.language,
    stargazers_count: r.stargazers_count, pushed_at: r.pushed_at, html_url: r.html_url,
  };
}

async function fetchProfile(login) {
  // Both requests start at the same time, so we wait for the slower one
  // instead of waiting for one and then the other.
  const [user, repos] = await Promise.all([
    getJson(`${API}/users/${login}`),
    getJson(`${API}/users/${login}/repos?per_page=100&sort=pushed&direction=desc`),
  ]);
  return {
    user: slimUser(user),
    repos: repos.filter((r) => !r.fork).map(slimRepo),
  };
}

/* ---------- Saved data (localStorage) ---------- */

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function getCached(login) {
  const entry = readCache()[login.toLowerCase()];
  return entry && Date.now() - entry.t < CACHE_TTL ? entry : null;
}

function setCached(login, data) {
  const cache = readCache();
  cache[login.toLowerCase()] = { ...data, t: Date.now() };
  // Drop the oldest entries so the cache can't grow forever.
  const newestFirst = Object.keys(cache).sort((a, b) => cache[b].t - cache[a].t);
  for (const key of newestFirst.slice(CACHE_MAX)) delete cache[key];
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked: the app still works without it */
  }
}

function loadRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(list) ? list.filter((n) => typeof n === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveRecent(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function addRecent(login) {
  const others = loadRecent().filter((n) => n.toLowerCase() !== login.toLowerCase());
  saveRecent([login, ...others].slice(0, 6));
  renderRecent();
}

/* ---------- Helpers ---------- */

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function timeAgo(iso) {
  const seconds = (new Date(iso) - Date.now()) / 1000; // negative = in the past
  const units = [
    ["year", 31536000], ["month", 2592000], ["week", 604800],
    ["day", 86400], ["hour", 3600], ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

// Accepts "torvalds", "@torvalds" or a pasted profile link.
function cleanUsername(raw) {
  let text = raw.trim().replace(/^@/, "");
  text = text.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "");
  text = text.split(/[/?#]/)[0];
  return USERNAME_RE.test(text) ? text : "";
}

function websiteLink(blog) {
  if (!blog) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(blog) ? blog : `https://${blog}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const label = url.host + (url.pathname === "/" ? "" : url.pathname);
    return h("a", { href: url.href, target: "_blank", rel: "noopener noreferrer" }, label);
  } catch {
    return null;
  }
}

/* ---------- Rendering ---------- */

function count(n, one, many = one) {
  return h("li", {}, h("strong", {}, compact.format(n)), n === 1 ? one : many);
}

function profileEl(user) {
  const displayName = user.name || user.login;
  const joiner = user.avatar_url.includes("?") ? "&" : "?";

  const sentences = [];
  if (user.location) sentences.push(`Based in ${user.location}.`);
  if (user.company) sentences.push(`Works at ${user.company.replace(/^@/, "")}.`);
  sentences.push(`On GitHub since ${new Date(user.created_at).getFullYear()}.`);

  const facts = h("p", { class: "facts" }, sentences.join(" "));
  const site = websiteLink(user.blog);
  if (site) facts.append(" ", site);

  return h("article", { class: "profile" },
    h("img", {
      class: "avatar",
      src: `${user.avatar_url}${joiner}s=400`,
      alt: `${displayName}'s GitHub avatar`,
      width: "200",
      height: "200",
    }),
    h("div", { class: "who" },
      h("h2", { class: "name" }, displayName),
      h("p", { class: "login" },
        h("a", { href: user.html_url, target: "_blank", rel: "noopener noreferrer" }, `@${user.login}`)),
      user.bio && h("p", { class: "bio" }, user.bio),
      facts,
      h("ul", { class: "counts" },
        count(user.public_repos, "repo", "repos"),
        count(user.followers, "follower", "followers"),
        count(user.following, "following"))
    )
  );
}

function sortedRepos() {
  const list = [...current.repos];
  if (current.sort === "stars") list.sort((a, b) => b.stargazers_count - a.stargazers_count);
  return list.slice(0, REPOS_SHOWN);
}

function repoRow(repo) {
  const meta = h("div", { class: "repo-meta" });

  if (repo.language) {
    const lang = h("span", { class: "lang" }, repo.language);
    lang.style.setProperty("--lang", LANG_COLORS[repo.language] || "#9AA0B4");
    meta.append(lang);
  }
  if (repo.stargazers_count > 0) {
    const stars = repo.stargazers_count === 1 ? "star" : "stars";
    meta.append(h("span", {}, `${compact.format(repo.stargazers_count)} ${stars}`));
  }
  if (repo.pushed_at) meta.append(h("span", {}, `Updated ${timeAgo(repo.pushed_at)}`));

  return h("li", {},
    h("a", { class: "repo", href: repo.html_url, target: "_blank", rel: "noopener noreferrer" },
      h("div", {},
        h("span", { class: "repo-name" }, repo.name),
        repo.description && h("p", { class: "repo-desc" }, repo.description)),
      meta)
  );
}

function reposEl(user) {
  if (current.repos.length === 0) {
    return h("section", { class: "repos" },
      h("h3", {}, "Repositories"),
      h("p", { class: "empty-note" }, `${user.login} has no public original repositories yet.`));
  }

  const buttons = SORTS.map(([key, label]) =>
    h("button", { type: "button", "data-sort": key, "aria-pressed": String(key === current.sort) }, label));

  return h("section", { class: "repos" },
    h("div", { class: "repos-head" },
      h("h3", {}, "Repositories"),
      h("div", { class: "sort" }, ...buttons)),
    h("ul", { class: "repo-list", id: "repo-list" }, ...sortedRepos().map(repoRow)),
    h("p", { class: "repos-foot" },
      "Original repositories only. ",
      h("a", { href: `${user.html_url}?tab=repositories`, target: "_blank", rel: "noopener noreferrer" },
        "See everything on GitHub"))
  );
}

function render() {
  els.result.replaceChildren(profileEl(current.user), reposEl(current.user));
  document.title = `${current.user.name || current.user.login} on Handle`;
}

function setSort(key) {
  if (!current || current.sort === key) return;
  current.sort = key;
  document.querySelectorAll("[data-sort]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.sort === key));
  });
  $("repo-list").replaceChildren(...sortedRepos().map(repoRow));
}

function showNotice(title, text, { error = false, examples = false } = {}) {
  const parts = [h("h2", {}, title), h("p", {}, text)];
  if (examples) {
    parts.push(h("div", { class: "chips" },
      ...EXAMPLES.map((name) => h("button", { class: "chip", type: "button", "data-user": name }, name))));
  }
  els.result.replaceChildren(h("div", { class: error ? "notice notice--error" : "notice" }, ...parts));
}

function showEmpty() {
  showNotice("Who are you looking for?", "Type a GitHub username above, or try one of these.", { examples: true });
}

function showSkeleton() {
  els.result.replaceChildren(
    h("p", { class: "sr-only" }, "Loading profile"),
    h("div", { class: "profile", "aria-hidden": "true" },
      h("div", { class: "bone bone--avatar" }),
      h("div", {},
        h("div", { class: "bone bone--title" }),
        h("div", { class: "bone bone--line" }),
        h("div", { class: "bone bone--line bone--short" }))),
    h("div", { class: "repos", "aria-hidden": "true" },
      h("div", { class: "bone bone--row" }),
      h("div", { class: "bone bone--row" }),
      h("div", { class: "bone bone--row" }))
  );
}

function showError(error, login) {
  if (error instanceof ApiError && error.status === 404) {
    showNotice(`No one called “${login}”`,
      "Check the spelling. GitHub usernames have no spaces and no @ sign.", { error: true });
    return;
  }
  if (error instanceof ApiError && error.status === 429) {
    const when = error.resetAt
      ? ` Try again after ${new Date(error.resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
      : " Try again a bit later.";
    showNotice("Too many searches",
      `GitHub only allows 60 anonymous lookups an hour.${when}`, { error: true });
    return;
  }
  console.error(error);
  showNotice("Couldn't reach GitHub", "Check your connection and try again.", { error: true });
}

function renderRecent() {
  const list = loadRecent();
  els.recent.hidden = list.length === 0;
  els.recent.replaceChildren(
    h("span", { class: "chips-label" }, "Recent"),
    ...list.map((name) => h("button", { class: "chip", type: "button", "data-user": name }, name)),
    h("button", { class: "link-btn", type: "button", id: "clear-recent" }, "Clear")
  );
}

function setBusy(busy) {
  els.go.disabled = busy;
  els.result.setAttribute("aria-busy", String(busy));
}

function syncUrl(login) {
  // Makes the page link shareable: ?u=torvalds
  try {
    const url = new URL(location.href);
    url.searchParams.set("u", login);
    history.replaceState(null, "", url);
  } catch {
    /* opening the file straight from disk blocks this; that's fine */
  }
}

/* ---------- The search itself ---------- */

async function search(raw) {
  const login = cleanUsername(raw);

  if (!login) {
    const empty = raw.trim() === "";
    showNotice(
      empty ? "Type a username first" : "That doesn't look like a username",
      empty
        ? "Enter a GitHub username in the box above."
        : "GitHub usernames use letters, numbers and single hyphens, and are up to 39 characters.",
      { error: !empty }
    );
    return;
  }

  const myId = ++requestId;
  els.input.value = login;
  setBusy(true);
  showSkeleton();

  try {
    let data = getCached(login);
    if (!data) {
      data = await fetchProfile(login);
      setCached(login, data);
    }
    if (myId !== requestId) return; // a newer search has started, drop this answer

    current = { user: data.user, repos: data.repos, sort: "recent" };
    render();
    addRecent(data.user.login);
    syncUrl(data.user.login);
  } catch (error) {
    if (myId !== requestId) return;
    showError(error, login);
  } finally {
    if (myId === requestId) setBusy(false);
  }
}

/* ---------- Events ---------- */

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  search(els.input.value);
});

// One click handler for everything that gets created later (chips, sort buttons).
document.addEventListener("click", (event) => {
  const userButton = event.target.closest("[data-user]");
  if (userButton) {
    search(userButton.dataset.user);
    return;
  }
  const sortButton = event.target.closest("[data-sort]");
  if (sortButton) {
    setSort(sortButton.dataset.sort);
    return;
  }
  if (event.target.closest("#clear-recent")) {
    saveRecent([]);
    renderRecent();
  }
});

/* ---------- Start ---------- */

function init() {
  renderRecent();
  const start = new URLSearchParams(location.search).get("u");
  if (start) {
    search(start);
  } else {
    showEmpty();
    // Skip auto-focus on phones, where it would pop the keyboard open.
    if (window.matchMedia("(hover: hover)").matches) els.input.focus();
  }
}

init();