// ---------- Config ----------
// The country data comes from the open "mledoze/countries" dataset, served by jsDelivr.
// It's one JSON file: free, no API key, and no request limits to worry about.
const DATA_URL = "https://cdn.jsdelivr.net/gh/mledoze/countries@master/dist/countries.json";
// Flag pictures come from flagcdn.com, which is also free and needs no key.
const flagUrl = (cca2) => `https://flagcdn.com/w320/${cca2.toLowerCase()}.png`;
const REQUEST_TIMEOUT_MS = 15000;
const THEME_KEY = "country-explorer-theme";
const SKELETON_COUNT = 12;

// ---------- State ----------
let countries = []; // every country, cleaned up
let byCode = new Map(); // "NGA" -> the Nigeria object, for quick lookups
let view = "list"; // "list" or "detail"
let listScroll = 0; // where the list was scrolled to before opening a country
let lastOpenedCode = null;

// ---------- DOM elements ----------
const $ = (id) => document.getElementById(id);
const listView = $("list-view");
const detailView = $("detail-view");
const grid = $("grid");
const messageEl = $("message");
const countEl = $("result-count");
const searchInput = $("search");
const regionSelect = $("region");
const sortSelect = $("sort");
const themeBtn = $("theme");
const subtitle = $("subtitle");

// ---------- Helpers ----------
// Small helper to build elements. Using textContent keeps data from the API safe.
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

// "Côte d'Ivoire" -> "cote d'ivoire", so searching "cote" works
function normalizeText(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const fullNumber = new Intl.NumberFormat("en"); // 923768 -> "923,768"

// ---------- Getting the data ----------
// The data's shape is deep and some countries miss fields (no capital, no borders...),
// so we turn each one into a simple, predictable object.
function toCountry(c) {
  const natives = Object.values(c.name.native || {}).map((n) => n.common);
  const currencies = Object.values(c.currencies || {}).map((cur) =>
    cur.symbol ? `${cur.name} (${cur.symbol})` : cur.name
  );
  const capital = (c.capital || []).join(", ");

  return {
    code: c.cca3,
    name: c.name.common,
    official: c.name.official,
    native: [...new Set(natives)].filter((n) => n !== c.name.common),
    flag: flagUrl(c.cca2),
    area: c.area || 0, // square kilometres
    region: c.region,
    subregion: c.subregion || "",
    capital,
    languages: Object.values(c.languages || {}),
    currencies,
    borders: c.borders || [],
    searchText: normalizeText(`${c.name.common} ${c.name.official} ${capital}`),
  };
}

async function fetchCountries() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(DATA_URL, { signal: controller.signal });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Unexpected data");
    return data.map(toCountry);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Messages (loading, error, empty) ----------
function showMessage(text, buttonLabel, onClick) {
  messageEl.replaceChildren(h("p", { text }));
  if (buttonLabel) {
    const button = h("button", { type: "button", class: "btn", text: buttonLabel });
    button.addEventListener("click", onClick);
    messageEl.append(button);
  }
  messageEl.hidden = false;
}

function hideMessage() {
  messageEl.hidden = true;
  messageEl.replaceChildren();
}

// ---------- The list ----------
function fillRegions() {
  regionSelect.length = 1; // keep only "All regions"
  const regions = [...new Set(countries.map((c) => c.region))].filter(Boolean).sort();
  regions.forEach((region) => regionSelect.append(h("option", { value: region, text: region })));
}

function getVisible() {
  const query = normalizeText(searchInput.value.trim());
  const region = regionSelect.value;

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    largest: (a, b) => b.area - a.area,
    smallest: (a, b) => a.area - b.area,
  };

  return countries
    .filter((c) => (!region || c.region === region) && (!query || c.searchText.includes(query)))
    .sort(sorters[sortSelect.value]);
}

function buildCard(c) {
  const lines = [];
  if (c.capital) lines.push(h("span", { class: "stamp-line", text: c.capital }));
  lines.push(h("span", { class: "stamp-line", text: `${fullNumber.format(Math.round(c.area))} km²` }));

  return h(
    "li",
    {},
    h(
      "a",
      { class: "stamp", href: `#${c.code}`, "data-code": c.code },
      h(
        "span",
        { class: "stamp-art" },
        h("img", { src: c.flag, alt: "", loading: "lazy" }),
        h("span", { class: "postmark", "aria-hidden": "true", text: c.code })
      ),
      h("span", { class: "stamp-name", text: c.name }),
      ...lines
    )
  );
}

function renderGrid() {
  if (countries.length === 0) return; // still loading

  const visible = getVisible();
  countEl.textContent = `Showing ${visible.length} of ${countries.length} countries`;

  if (visible.length === 0) {
    grid.replaceChildren();
    showMessage("No countries match your search. Try a different name or clear the filters.", "Clear filters", clearFilters);
    return;
  }

  hideMessage();
  grid.replaceChildren(...visible.map(buildCard));
}

function clearFilters() {
  searchInput.value = "";
  regionSelect.value = "";
  renderGrid();
  searchInput.focus();
}

function renderSkeleton() {
  const placeholders = Array.from({ length: SKELETON_COUNT }, () =>
    h("li", {}, h("div", { class: "stamp skeleton", "aria-hidden": "true" }))
  );
  grid.replaceChildren(...placeholders);
  grid.setAttribute("aria-busy", "true");
}

// ---------- The detail view ----------
function buildDetail(c) {
  const facts = [
    ["Capital", c.capital],
    ["Region", [c.region, c.subregion].filter(Boolean).join(", ")],
    ["Area", `${fullNumber.format(Math.round(c.area))} km²`],
    ["Native name", c.native.join(", ")],
    ["Languages", c.languages.join(", ")],
    ["Currencies", c.currencies.join(", ")],
  ].filter(([, value]) => value); // hide facts the data doesn't have

  const factList = h("dl", { class: "facts" });
  facts.forEach(([label, value]) => {
    factList.append(h("div", { class: "fact" }, h("dt", { text: label }), h("dd", { text: value })));
  });

  // Turn border codes like "BEN" into countries we can link to
  const neighbours = c.borders.map((code) => byCode.get(code)).filter(Boolean);
  const bordering = h(
    "section",
    { class: "bordering" },
    h("h3", { text: "Bordering countries" }),
    neighbours.length > 0
      ? h(
          "ul",
          { class: "chips" },
          ...neighbours.map((n) =>
            h("li", {}, h("a", { class: "chip", href: `#${n.code}`, text: n.name }))
          )
        )
      : h("p", { class: "muted", text: "No land borders." })
  );

  return h(
    "article",
    { class: "postcard" },
    h(
      "div",
      { class: "postcard-flag" },
      h("img", { src: c.flag, alt: `Flag of ${c.name}` }),
      h("span", { class: "postmark", "aria-hidden": "true", text: c.code })
    ),
    h(
      "div",
      { class: "postcard-body" },
      h("h2", { tabindex: "-1", text: c.name }),
      h("p", { class: "official", text: c.official }),
      factList,
      bordering
    )
  );
}

function showDetail(c) {
  if (view === "list") listScroll = window.scrollY; // remember where we were
  view = "detail";
  lastOpenedCode = c.code;

  listView.hidden = true;
  detailView.hidden = false;
  detailView.replaceChildren(
    h("a", { class: "back", href: "#", text: "Back to all countries" }),
    buildDetail(c)
  );

  document.title = `${c.name} | Country explorer`;
  window.scrollTo(0, 0);
  detailView.querySelector("h2").focus();
}

function showList() {
  const comingBack = view === "detail";
  view = "list";

  detailView.hidden = true;
  listView.hidden = false;
  document.title = "Country explorer";

  if (comingBack) {
    window.scrollTo(0, listScroll);
    const card = grid.querySelector(`[data-code="${lastOpenedCode}"]`);
    if (card) card.focus({ preventScroll: true });
  }
}

// ---------- Routing ----------
// The page address decides what to show: "#NGA" opens Nigeria, no hash shows the list.
// This makes the browser's back button work and lets people share a link to a country.
function router() {
  const code = decodeURIComponent(location.hash.slice(1)).toUpperCase();
  const country = byCode.get(code);
  if (country) showDetail(country);
  else showList();
}

// ---------- Theme ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.setAttribute("aria-pressed", String(theme === "dark"));
}

themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (error) {
    // Storage can be blocked. The theme still changes for this visit.
  }
});

// ---------- Events ----------
searchInput.addEventListener("input", renderGrid);
regionSelect.addEventListener("change", renderGrid);
sortSelect.addEventListener("change", renderGrid);
window.addEventListener("hashchange", router);

// ---------- Start ----------
async function init() {
  renderSkeleton();
  countEl.textContent = "";
  showMessage("Loading countries…");

  try {
    countries = await fetchCountries();
  } catch (error) {
    grid.replaceChildren();
    grid.setAttribute("aria-busy", "false");
    showMessage("Couldn't load the countries. Check your internet connection and try again.", "Try again", init);
    return;
  }

  byCode = new Map(countries.map((c) => [c.code, c]));
  grid.setAttribute("aria-busy", "false");
  fillRegions();
  subtitle.textContent = `Browse ${countries.length} countries by name, region or size.`;
  renderGrid();
  router(); // open a country straight away if the link has one, like #NGA
}

applyTheme(document.documentElement.dataset.theme || "light");
init();