"use strict";

// ---------- Settings ----------
const STORAGE_KEY = "unit-converter-v1";
const PX_PER_MAJOR = 110; // how far apart the big ruler marks are
const MAX_VALUE = 1e12;
const GLIDE_MS = 650;
const TOAST_MS = 1600;

const groupFormat = new Intl.NumberFormat("en", { maximumSignificantDigits: 7 });
const ratioFormat = new Intl.NumberFormat("en", { maximumSignificantDigits: 2 });
const tileFormat = new Intl.NumberFormat("en", { maximumSignificantDigits: 6 }); // for the result rows

// ---------- The data ----------
// Every unit knows how to turn itself into a "base" unit and back.
// Most units are just a multiplier (f). Temperature needs real formulas.
const unit = (id, name, sym, f, step) => ({ id, name, sym, f, step });

const CATEGORIES = [
  {
    id: "length",
    label: "Length",
    adj: "long",
    theme: { bg: "#2447f5", on: "#ffffff", hair: "rgba(255,255,255,0.42)", soft: "rgba(255,255,255,0.16)" },
    start: { unit: "m", value: 100 },
    units: [
      unit("m", "Metre", "m", 1, 1),
      unit("km", "Kilometre", "km", 1000, 1),
      unit("cm", "Centimetre", "cm", 0.01, 10),
      unit("mm", "Millimetre", "mm", 0.001, 10),
      unit("mi", "Mile", "mi", 1609.344, 1),
      unit("yd", "Yard", "yd", 0.9144, 1),
      unit("ft", "Foot", "ft", 0.3048, 1),
      unit("in", "Inch", "in", 0.0254, 1),
    ],
    things: [
      { chip: "Rice grain", one: "a grain of rice", v: 0.007 },
      { chip: "Credit card", one: "a credit card", v: 0.0856 },
      { chip: "Door", one: "a door", v: 2 },
      { chip: "Double-decker", one: "a double-decker bus", v: 11 },
      { chip: "Football pitch", one: "a football pitch", v: 105 },
      { chip: "Eiffel Tower", one: "the Eiffel Tower", v: 330 },
      { chip: "Everest", one: "Mount Everest", v: 8849 },
      { chip: "Marathon", one: "a marathon", v: 42195 },
      { chip: "The Moon", one: "the distance to the Moon", v: 384400000 },
    ],
  },
  {
    id: "mass",
    label: "Mass",
    adj: "heavy",
    theme: { bg: "#ff5b2e", on: "#17110d", hair: "rgba(23,17,13,0.4)", soft: "rgba(23,17,13,0.12)" },
    start: { unit: "kg", value: 70 },
    units: [
      unit("kg", "Kilogram", "kg", 1, 1),
      unit("g", "Gram", "g", 0.001, 100),
      unit("mg", "Milligram", "mg", 0.000001, 100),
      unit("t", "Tonne", "t", 1000, 1),
      unit("lb", "Pound", "lb", 0.45359237, 1),
      unit("oz", "Ounce", "oz", 0.028349523125, 1),
      unit("st", "Stone", "st", 6.35029318, 1),
    ],
    things: [
      { chip: "Paperclip", one: "a paperclip", v: 0.001 },
      { chip: "Smartphone", one: "a smartphone", v: 0.2 },
      { chip: "Football", one: "a football", v: 0.43 },
      { chip: "Rice bag", one: "a 50 kg bag of rice", v: 50 },
      { chip: "Adult", one: "an adult", v: 70 },
      { chip: "Small car", one: "a small car", v: 1500 },
      { chip: "Elephant", one: "an African elephant", v: 5000 },
      { chip: "Blue whale", one: "a blue whale", v: 150000 },
    ],
  },
  {
    id: "temperature",
    label: "Temperature",
    adj: "hot",
    theme: null, // this one changes colour with the number, see temperatureTheme()
    start: { unit: "c", value: 21 },
    units: [
      { id: "c", name: "Celsius", sym: "°C", step: 10, to: (v) => v + 273.15, from: (k) => k - 273.15 },
      { id: "f", name: "Fahrenheit", sym: "°F", step: 10, to: (v) => ((v - 32) * 5) / 9 + 273.15, from: (k) => ((k - 273.15) * 9) / 5 + 32 },
      { id: "k", name: "Kelvin", sym: "K", step: 10, to: (v) => v, from: (k) => k },
    ],
    // values are in kelvin, which is the base unit
    things: [
      { chip: "Absolute zero", one: "absolute zero", v: 0 },
      { chip: "Freezing", one: "the freezing point of water", v: 273.15 },
      { chip: "Room", one: "room temperature", v: 294.15 },
      { chip: "Body", one: "body temperature", v: 310.15 },
      { chip: "Boiling", one: "the boiling point of water", v: 373.15 },
      { chip: "Hot oven", one: "a hot oven", v: 503.15 },
      { chip: "Lava", one: "molten lava", v: 1373.15 },
      { chip: "Sun surface", one: "the surface of the Sun", v: 5773.15 },
    ],
  },
  {
    id: "volume",
    label: "Volume",
    adj: "big",
    theme: { bg: "#08796e", on: "#ffffff", hair: "rgba(255,255,255,0.42)", soft: "rgba(255,255,255,0.16)" },
    start: { unit: "l", value: 1.5 },
    units: [
      unit("l", "Litre", "L", 1, 1),
      unit("ml", "Millilitre", "mL", 0.001, 100),
      unit("m3", "Cubic metre", "m³", 1000, 1),
      unit("gal", "US gallon", "gal", 3.785411784, 1),
      unit("cup", "US cup", "cup", 0.2365882365, 1),
      unit("floz", "US fluid ounce", "fl oz", 0.0295735295625, 1),
    ],
    things: [
      { chip: "Teaspoon", one: "a teaspoon", v: 0.005 },
      { chip: "Soda can", one: "a can of soda", v: 0.33 },
      { chip: "Water bottle", one: "a large water bottle", v: 1.5 },
      { chip: "Bucket", one: "a bucket", v: 10 },
      { chip: "Fuel tank", one: "a car's fuel tank", v: 50 },
      { chip: "Bathtub", one: "a bathtub", v: 150 },
      { chip: "Olympic pool", one: "an Olympic swimming pool", v: 2500000 },
    ],
  },
  {
    id: "speed",
    label: "Speed",
    adj: "fast",
    theme: { bg: "#7b2ff7", on: "#ffffff", hair: "rgba(255,255,255,0.42)", soft: "rgba(255,255,255,0.16)" },
    start: { unit: "kmh", value: 100 },
    units: [
      unit("ms", "Metres per second", "m/s", 1, 1),
      unit("kmh", "Kilometres per hour", "km/h", 1 / 3.6, 10),
      unit("mph", "Miles per hour", "mph", 0.44704, 10),
      unit("kn", "Knots", "kn", 1852 / 3600, 10),
      unit("fts", "Feet per second", "ft/s", 0.3048, 10),
    ],
    things: [
      { chip: "Walking", one: "a brisk walk", v: 1.4 },
      { chip: "Cyclist", one: "a cyclist", v: 6 },
      { chip: "Usain Bolt", one: "Usain Bolt at top speed", v: 12.4 },
      { chip: "Car", one: "a car on the highway", v: 30 },
      { chip: "Bullet train", one: "a bullet train", v: 83 },
      { chip: "Jet", one: "a passenger jet", v: 250 },
      { chip: "Sound", one: "the speed of sound", v: 343 },
      { chip: "Space station", one: "the International Space Station", v: 7660 },
      { chip: "Light", one: "the speed of light", v: 299792458 },
    ],
  },
];

// ---------- State ----------
const state = {
  cat: "length",
  unit: "m",
  value: 100,
  zoom: 1, // 0.1 = fine, 1 = normal, 10 = coarse
  saved: {}, // the last unit and value for each category
};

let tileRefs = []; // [{ unit, el, numEl, valEl, target }]
let glideFrame = null;
let momentumFrame = null;
let saveTimer = null;
let toastTimer = null;
let theme = null; // the colours currently on screen
let ruler = { w: 0, h: 0, dpr: 1 };

// ---------- Small helpers ----------
const $ = (id) => document.getElementById(id);
const heroInput = $("value");
const rulerEl = $("ruler");
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Builds an element. Text goes in with textContent, so nothing typed can run as HTML.
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

const category = (id = state.cat) => CATEGORIES.find((c) => c.id === id);
const unitOf = (cat, id) => cat.units.find((u) => u.id === id);
const currentUnit = () => unitOf(category(), state.unit);

const toBase = (u, v) => (u.to ? u.to(v) : v * u.f);
const fromBase = (u, b) => (u.from ? u.from(b) : b / u.f);
const convert = (v, from, to) => fromBase(to, toBase(from, v));
const clean = (n) => Number(n.toPrecision(12)); // removes 0.30000000000000004 style noise

// The lowest value a unit can have (absolute zero for temperature, 0 for the rest)
const minValue = (u) => clean(fromBase(u, 0));
const clamp = (u, v) => Math.min(MAX_VALUE, Math.max(minValue(u), v));

// Distance between the big marks, in the current unit, after the Fine / Normal / Coarse setting
const bigStep = () => currentUnit().step * state.zoom;

// "1250", "0.0125": a number as plain text for the input box
function plainText(v) {
  let s = Number(v.toPrecision(10)).toString();
  if (/e/i.test(s)) s = v.toFixed(12).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

// Shows a number with commas, or as 3.84 × 10⁸ when it is huge or tiny
function fillNumber(el, n) {
  if (Object.is(n, -0)) n = 0;
  const abs = Math.abs(n);
  if (n === 0 || (abs >= 1e-4 && abs < 1e9)) {
    el.textContent = tileFormat.format(n);
    return;
  }
  const [mantissa, exponent] = n.toExponential(4).split("e");
  el.replaceChildren(mantissa.replace(/\.?0+$/, "") + " × 10", h("sup", { text: String(Number(exponent)) }));
}

// Counts a number up (or down) to its new value
function tweenNumber(el, to, ms = 520, onFrame) {
  cancelAnimationFrame(el._frame);
  const from = el._n ?? 0;
  if (reducedMotion() || from === to) return setNumberNow(el, to);
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - p, 4);
    el._n = from + (to - from) * eased;
    fillNumber(el, p === 1 ? to : el._n);
    if (onFrame) onFrame();
    if (p < 1) el._frame = requestAnimationFrame(step);
  };
  el._frame = requestAnimationFrame(step);
}

function setNumberNow(el, n) {
  cancelAnimationFrame(el._frame);
  el._n = n;
  fillNumber(el, n);
}

// ---------- Colours ----------
// Temperature has no fixed colour: it slides from icy blue to hot red as the number changes.
const TEMP_STOPS = [
  [-40, [91, 140, 255]],
  [0, [127, 216, 255]],
  [21, [255, 224, 102]],
  [37, [255, 166, 77]],
  [100, [255, 90, 77]],
];

function temperatureTheme() {
  const c = clean(toBase(currentUnit(), state.value) - 273.15);
  let rgb;
  if (c <= TEMP_STOPS[0][0]) rgb = TEMP_STOPS[0][1];
  else if (c >= TEMP_STOPS[TEMP_STOPS.length - 1][0]) rgb = TEMP_STOPS[TEMP_STOPS.length - 1][1];
  else {
    const i = TEMP_STOPS.findIndex(([t]) => t > c);
    const [t0, a] = TEMP_STOPS[i - 1];
    const [t1, b] = TEMP_STOPS[i];
    const p = (c - t0) / (t1 - t0);
    rgb = a.map((x, k) => Math.round(x + (b[k] - x) * p));
  }
  const hex = "#" + rgb.map((x) => x.toString(16).padStart(2, "0")).join("");
  return { bg: hex, on: "#17110d", hair: "rgba(23,17,13,0.4)", soft: "rgba(23,17,13,0.12)" };
}

function applyTheme() {
  const next = category().theme || temperatureTheme();
  if (theme && theme.bg === next.bg && theme.on === next.on) return;
  theme = next;
  const root = document.documentElement.style;
  root.setProperty("--bg", next.bg);
  root.setProperty("--on", next.on);
  root.setProperty("--hair", next.hair);
  root.setProperty("--soft", next.soft);
  $("theme-color").setAttribute("content", next.bg);
}

// ---------- The caption: what this number is like in real life ----------
function describe() {
  const cat = category();
  const base = toBase(currentUnit(), state.value);
  const things = cat.things;

  if (cat.id === "temperature") {
    if (base <= 0) return "Absolute zero. Nothing can be colder.";
    const near = things.find((t) => Math.abs(base - t.v) <= Math.max(1, t.v * 0.01));
    if (near) return `About ${near.one}.`;
    const above = things.findIndex((t) => t.v > base);
    if (above === -1) return `Hotter than ${things[things.length - 1].one}.`;
    return `Between ${things[above - 1].one} and ${things[above].one}.`;
  }

  if (base <= 0) return "Drag the ruler or type a number.";

  // pick the real-world thing closest in size
  let best = things[0];
  for (const t of things) {
    if (Math.abs(Math.log(base / t.v)) < Math.abs(Math.log(base / best.v))) best = t;
  }
  const r = base / best.v;
  const ratio = (x) => (x < 10 ? String(Number(x.toFixed(1))) : ratioFormat.format(x));
  const sentence = best.one.charAt(0).toUpperCase() + best.one.slice(1);

  if (r >= 0.9 && r <= 1.1) return `About as ${cat.adj} as ${best.one}.`;
  if (r > 1.1) return `About ${ratio(r)} times as ${cat.adj} as ${best.one}.`;
  if (r >= 0.1) return `About ${Math.round(r * 100)}% as ${cat.adj} as ${best.one}.`;
  return `${sentence} is about ${ratio(1 / r)} times as ${cat.adj}.`;
}

// ---------- Building the screen ----------
function buildTabs() {
  $("cats").replaceChildren(
    ...CATEGORIES.map((cat) =>
      h("button", {
        type: "button",
        class: "chip",
        "data-cat": cat.id,
        "aria-pressed": String(cat.id === state.cat),
        text: cat.label,
      })
    )
  );
}

function refreshTabs() {
  document.querySelectorAll("#cats .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === state.cat)));
}

function buildUnitChips() {
  $("units").replaceChildren(
    ...category().units.map((u) =>
      h("button", { type: "button", class: "chip", "data-unit": u.id, "aria-pressed": String(u.id === state.unit), title: u.name, text: u.sym })
    )
  );
  $("hero-unit").textContent = currentUnit().sym;
}

function buildThings() {
  $("things").replaceChildren(...category().things.map((t, i) => h("button", { type: "button", class: "chip", "data-thing": String(i), text: t.chip })));
}

// One ruled row for every unit except the one you are converting from
function buildTiles() {
  const cat = category();
  tileRefs = cat.units
    .filter((u) => u.id !== state.unit)
    .map((u) => {
      const numEl = h("span");
      const symEl = h("span", { class: "tile-sym", text: u.sym });
      const valEl = h("span", { class: "tile-val" }, numEl, symEl);
      const el = h(
        "li",
        { class: "tile" },
        h("button", { type: "button", class: "tile-main", "data-unit": u.id, title: `Convert from ${u.name}` }, h("span", { class: "tile-name", text: u.name }), valEl),
        h("button", { type: "button", class: "tile-copy", "data-copy": u.id, "aria-label": `Copy ${u.name} value`, text: "Copy" })
      );
      return { unit: u, el, numEl, valEl, target: 0 };
    });
  $("tiles").replaceChildren(...tileRefs.map((t) => t.el));
}

// If a number is too wide for its row, make it smaller instead of letting it wrap
function fitTile(t) {
  t.valEl.style.fontSize = "";
  if (t.valEl.scrollWidth > t.valEl.clientWidth + 1) {
    const size = parseFloat(getComputedStyle(t.valEl).fontSize);
    t.valEl.style.fontSize = Math.floor((size * t.valEl.clientWidth) / t.valEl.scrollWidth) - 1 + "px";
  }
}

function updateTiles(countUp = false) {
  const from = currentUnit();
  for (const t of tileRefs) {
    t.target = convert(state.value, from, t.unit);
    if (countUp) tweenNumber(t.numEl, t.target, 520, () => fitTile(t));
    else setNumberNow(t.numEl, t.target);
    fitTile(t);
  }
}

// Make the number in the hero as large as it can be, and keep the unit symbol right next to it
function fitHero() {
  const measure = $("measure");
  const row = heroInput.parentElement;
  const max = window.innerWidth < 600 ? 104 : 176;
  measure.textContent = heroInput.value || "0";
  measure.style.fontSize = max + "px";
  const available = row.clientWidth - $("hero-unit").offsetWidth - 26;
  const width = measure.offsetWidth;
  const size = Math.max(44, width > available ? (max * available) / width : max);
  heroInput.style.fontSize = size + "px";
  heroInput.style.width = Math.ceil(Math.min(available, (width * size) / max) + size * 0.08) + "px";
}

// ---------- Changing the value (everything goes through here) ----------
// src says where the change came from, so we know how to write it in the box:
//   "input" = the person is typing (leave the box alone), "drag" = ruler,
//   "glide" = a jump chip is animating, anything else = write it out neatly
function setValue(v, src = "set") {
  const u = currentUnit();
  v = clamp(u, Number.isFinite(v) ? v : 0);
  state.value = v;

  if (src !== "input") {
    if (src === "drag") {
      const decimals = Math.max(0, Math.min(8, 2 - Math.floor(Math.log10(bigStep()))));
      heroInput.value = plainText(Number(v.toFixed(decimals)));
    } else if (src === "glide") {
      heroInput.value = plainText(Number(v.toPrecision(6)));
    } else {
      heroInput.value = plainText(v);
    }
  }

  fitHero();
  updateTiles(false);
  $("caption").textContent = describe();
  applyTheme();
  updateRulerAria();
  drawRuler();
  scheduleSave();
}

// ---------- The ruler ----------
function resizeRuler() {
  const rect = rulerEl.getBoundingClientRect();
  ruler.dpr = window.devicePixelRatio || 1;
  ruler.w = Math.round(rect.width);
  ruler.h = Math.round(rect.height);
  canvas.width = ruler.w * ruler.dpr;
  canvas.height = ruler.h * ruler.dpr;
  canvas.style.width = ruler.w + "px";
  canvas.style.height = ruler.h + "px";
  ctx.setTransform(ruler.dpr, 0, 0, ruler.dpr, 0, 0);
  drawRuler();
}

function drawRuler() {
  if (!ruler.w || !theme) return;
  const { w, h: height } = ruler;
  const minor = bigStep() / 10;
  const pxMinor = PX_PER_MAJOR / 10;
  const half = w / 2;
  const min = minValue(currentUnit());

  ctx.clearRect(0, 0, w, height);
  ctx.fillStyle = theme.on;
  ctx.textAlign = "center";
  ctx.font = '700 14px Archivo, "Helvetica Neue", Arial, sans-serif';

  const first = Math.floor((state.value - (half / pxMinor) * minor) / minor);
  const last = Math.ceil((state.value + (half / pxMinor) * minor) / minor);
  const baseline = height - 14;

  for (let k = first; k <= last; k++) {
    const t = clean(k * minor);
    if (t < min - minor / 2) continue; // nothing exists below the lowest value
    const x = half + ((t - state.value) / minor) * pxMinor;
    const slot = ((k % 10) + 10) % 10;
    const big = slot === 0;
    const mid = slot === 5;
    const len = big ? 58 : mid ? 38 : 22;

    ctx.globalAlpha = big ? 1 : mid ? 0.85 : 0.55;
    ctx.fillRect(Math.round(x) - (big ? 1.5 : 1), baseline - len, big ? 3 : 2, len);

    if (big && Math.abs(x - half) > 24) {
      ctx.globalAlpha = 1;
      ctx.fillText(groupFormat.format(t), x, baseline - len - 12);
    }
  }
  ctx.globalAlpha = 1;
}

function updateRulerAria() {
  const u = currentUnit();
  rulerEl.setAttribute("aria-valuemin", String(minValue(u)));
  rulerEl.setAttribute("aria-valuemax", String(MAX_VALUE));
  rulerEl.setAttribute("aria-valuenow", String(state.value));
  rulerEl.setAttribute("aria-valuetext", `${groupFormat.format(state.value)} ${u.name}`);
}

// Snap to a fine grid so dragging gives tidy numbers
const snap = (v) => {
  const q = bigStep() / 100;
  return clean(Math.round(v / q) * q);
};

function stopMotion() {
  cancelAnimationFrame(glideFrame);
  cancelAnimationFrame(momentumFrame);
  glideFrame = momentumFrame = null;
}

let drag = null;

rulerEl.addEventListener("pointerdown", (event) => {
  if (event.button > 0) return;
  stopMotion();
  rulerEl.setPointerCapture(event.pointerId);
  rulerEl.classList.add("is-dragging");
  drag = { id: event.pointerId, x: event.clientX, value: state.value, samples: [{ t: performance.now(), x: event.clientX }] };
});

rulerEl.addEventListener("pointermove", (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x;
  // dragging the ruler to the right moves the marks right, so the number goes down
  setValue(snap(drag.value - (dx / PX_PER_MAJOR) * bigStep()), "drag");
  drag.samples.push({ t: performance.now(), x: event.clientX });
  if (drag.samples.length > 6) drag.samples.shift();
});

function endDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  rulerEl.classList.remove("is-dragging");
  const now = performance.now();
  const recent = drag.samples.filter((s) => now - s.t < 90);
  drag = null;
  if (recent.length < 2 || reducedMotion()) return;
  const a = recent[0];
  const b = recent[recent.length - 1];
  const velocity = (b.x - a.x) / Math.max(1, b.t - a.t); // pixels per millisecond
  if (Math.abs(velocity) > 0.15) coast(velocity);
}

rulerEl.addEventListener("pointerup", endDrag);
rulerEl.addEventListener("pointercancel", endDrag);

// After you let go, the ruler keeps moving and slows down, like a real dial
function coast(velocity) {
  let last = performance.now();
  const step = (now) => {
    const dt = now - last;
    last = now;
    velocity *= Math.exp(-dt / 320);
    const before = state.value;
    setValue(snap(state.value - velocity * dt / PX_PER_MAJOR * bigStep()), "drag");
    const atEdge = state.value === before;
    if (Math.abs(velocity) < 0.02 || atEdge) {
      momentumFrame = null;
      return;
    }
    momentumFrame = requestAnimationFrame(step);
  };
  momentumFrame = requestAnimationFrame(step);
}

rulerEl.addEventListener("keydown", (event) => {
  const small = bigStep() / 10;
  const amount = event.shiftKey ? bigStep() : small;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") next = state.value + amount;
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = state.value - amount;
  else if (event.key === "PageUp") next = state.value + bigStep() * 10;
  else if (event.key === "PageDown") next = state.value - bigStep() * 10;
  if (next === null) return;
  event.preventDefault();
  stopMotion();
  setValue(snap(next), "drag");
});

// A jump chip: the ruler spins to the new number and slows down on it
function glideTo(target) {
  stopMotion();
  const from = state.value;
  target = clamp(currentUnit(), clean(target));
  if (reducedMotion() || from === target) {
    setValue(target, "set");
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / GLIDE_MS);
    const eased = 1 - Math.pow(1 - p, 4);
    if (p === 1) {
      setValue(target, "set");
      glideFrame = null;
      return;
    }
    setValue(from + (target - from) * eased, "glide");
    glideFrame = requestAnimationFrame(step);
  };
  glideFrame = requestAnimationFrame(step);
}

// ---------- Typing in the big number ----------
heroInput.addEventListener("input", () => {
  stopMotion();
  const canBeNegative = minValue(currentUnit()) < 0;
  let text = heroInput.value.replace(canBeNegative ? /[^0-9.\-]/g : /[^0-9.]/g, "");
  const parts = text.split(".");
  text = parts.shift() + (parts.length ? "." + parts.join("") : ""); // only one dot
  text = (text.startsWith("-") ? "-" : "") + text.replace(/-/g, ""); // minus only at the start
  if (text !== heroInput.value) heroInput.value = text;
  const n = parseFloat(text);
  setValue(Number.isFinite(n) ? n : 0, "input");
});

heroInput.addEventListener("blur", () => {
  heroInput.value = plainText(state.value);
  fitHero();
});

// ---------- Switching units and categories ----------
function setUnit(id) {
  if (id === state.unit) return;
  const cat = category();
  const from = currentUnit();
  const to = unitOf(cat, id);
  state.value = clamp(to, clean(convert(state.value, from, to)));
  state.unit = id;
  buildUnitChips();
  buildTiles();
  setValue(state.value, "set");
  updateTiles(true); // numbers count up from zero
}

function applyCategory(id) {
  state.saved[state.cat] = { unit: state.unit, value: state.value };
  const cat = category(id);
  const back = state.saved[id] || cat.start;
  state.cat = id;
  state.unit = unitOf(cat, back.unit) ? back.unit : cat.start.unit;
  state.value = clamp(currentUnit(), Number.isFinite(back.value) ? back.value : cat.start.value);

  theme = null; // force the colours to be set again
  refreshTabs();
  buildUnitChips();
  buildThings();
  buildTiles();
  setValue(state.value, "set");
  updateTiles(true);
  resizeRuler();
}

// A wave of the new colour spreads out from the button you pressed
function switchCategory(id, origin) {
  if (id === state.cat) return;
  stopMotion();
  if (!document.startViewTransition || reducedMotion()) {
    applyCategory(id);
    return;
  }
  const box = origin.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = document.startViewTransition(() => applyCategory(id));
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 720, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    })
    .catch(() => {});
}

// ---------- Copy ----------
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
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

function toast(message) {
  const el = $("toast");
  clearTimeout(toastTimer);
  el.textContent = message;
  el.classList.add("is-visible");
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), TOAST_MS);
}

// ---------- Saving ----------
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
}

function save() {
  state.saved[state.cat] = { unit: state.unit, value: state.value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cat: state.cat, zoom: state.zoom, saved: state.saved }));
  } catch (error) {
    // Storage can be blocked. The converter still works for this visit.
  }
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!data || !category(data.cat)) return;
    state.cat = data.cat;
    if ([0.1, 1, 10].includes(data.zoom)) state.zoom = data.zoom;
    for (const cat of CATEGORIES) {
      const s = data.saved && data.saved[cat.id];
      if (s && unitOf(cat, s.unit) && Number.isFinite(s.value)) state.saved[cat.id] = { unit: s.unit, value: s.value };
    }
    const mine = state.saved[state.cat];
    if (mine) {
      state.unit = mine.unit;
      state.value = clamp(unitOf(category(), mine.unit), mine.value);
    } else {
      state.unit = category().start.unit;
      state.value = category().start.value;
    }
  } catch (error) {
    // Nothing saved yet, or it was unreadable: start fresh
  }
}

// ---------- Wiring ----------
$("cats").addEventListener("click", (event) => {
  const button = event.target.closest("[data-cat]");
  if (button) switchCategory(button.dataset.cat, button);
});

$("units").addEventListener("click", (event) => {
  const button = event.target.closest("[data-unit]");
  if (!button) return;
  setUnit(button.dataset.unit);
  document.querySelector(`#units [data-unit="${state.unit}"]`).focus();
});

$("tiles").addEventListener("click", async (event) => {
  const copy = event.target.closest("[data-copy]");
  if (copy) {
    const tile = tileRefs.find((t) => t.unit.id === copy.dataset.copy);
    const text = `${plainText(tile.target)} ${tile.unit.sym}`;
    toast((await copyText(text)) ? `Copied ${text}` : "Couldn't copy");
    return;
  }
  const main = event.target.closest("[data-unit]");
  if (!main) return;
  setUnit(main.dataset.unit);
  document.querySelector(`#units [data-unit="${state.unit}"]`).focus();
});

$("things").addEventListener("click", (event) => {
  const button = event.target.closest("[data-thing]");
  if (!button) return;
  const thing = category().things[Number(button.dataset.thing)];
  glideTo(fromBase(currentUnit(), thing.v));
});

$("zoom").addEventListener("click", (event) => {
  const button = event.target.closest("[data-zoom]");
  if (!button) return;
  state.zoom = Number(button.dataset.zoom);
  document.querySelectorAll("#zoom button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
  drawRuler();
  scheduleSave();
});

window.addEventListener("resize", () => {
  fitHero();
  resizeRuler();
  tileRefs.forEach(fitTile);
});

window.addEventListener("pagehide", save);

// ---------- Start ----------
load();
buildTabs();
document.querySelectorAll("#zoom button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.zoom) === state.zoom)));
buildUnitChips();
buildThings();
buildTiles();
new ResizeObserver(resizeRuler).observe(rulerEl);
setValue(state.value, "set");
updateTiles(true);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitHero(); drawRuler(); });