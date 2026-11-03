"use strict";

const COUNT = 5;
const STORAGE_KEY = "palette-generator-v1";

// Each colour is { hex: "#aabbcc", locked: false }
let colors = Array.from({ length: COUNT }, () => ({ hex: "#cccccc", locked: false }));
let toastTimer = null;

const paletteEl = document.getElementById("palette");
const toastEl = document.getElementById("toast");

// ---------- Colour maths ----------
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return "#" + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
}

// Dark text on light colours, white text on dark ones
function textOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.4 ? "#151515" : "#ffffff";
}

const rand = (min, max) => min + Math.random() * (max - min);

// Colours that sit well together: one starting hue, a gentle step between them,
// and lightness that climbs from dark to light so the palette has shape.
function generate() {
  const base = rand(0, 360);
  const step = rand(18, 48);
  const direction = Math.random() < 0.5 ? 1 : -1;
  colors = colors.map((color, i) => {
    if (color.locked) return color;
    const hue = (base + direction * step * i + 360) % 360;
    const sat = rand(40, 85);
    const light = 24 + i * 12 + rand(-5, 5);
    return { hex: hslToHex(hue, sat, light), locked: false };
  });
  render();
  save();
}

// ---------- Drawing ----------
function render() {
  paletteEl.replaceChildren(
    ...colors.map((color, i) => {
      const swatch = document.createElement("section");
      swatch.className = "swatch";
      swatch.style.background = color.hex;
      swatch.style.color = textOn(color.hex);
      swatch.style.setProperty("--bg", color.hex);

      const hex = document.createElement("button");
      hex.type = "button";
      hex.className = "hex";
      hex.textContent = color.hex;
      hex.title = "Click to copy";
      hex.addEventListener("click", () => copy(color.hex));

      const lock = document.createElement("button");
      lock.type = "button";
      lock.className = "lock";
      lock.setAttribute("aria-pressed", String(color.locked));
      lock.setAttribute("aria-label", `${color.locked ? "Unlock" : "Lock"} colour ${i + 1}`);
      const label = document.createElement("span");
      label.textContent = color.locked ? "Locked" : "Lock";
      lock.append(label);
      lock.addEventListener("click", () => {
        colors[i].locked = !colors[i].locked;
        render();
        save();
      });

      swatch.append(hex, lock);
      return swatch;
    })
  );
}

// ---------- Copy and toast ----------
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied ${text.toUpperCase()}`);
  } catch (error) {
    toast("Couldn't copy");
  }
}

function toast(message) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 1500);
}

// ---------- Saving ----------
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch (error) {
    // Storage can be blocked. The app still works for this visit.
  }
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const valid =
      Array.isArray(data) &&
      data.length === COUNT &&
      data.every((c) => c && /^#[0-9a-f]{6}$/i.test(c.hex) && typeof c.locked === "boolean");
    if (valid) {
      colors = data.map((c) => ({ hex: c.hex.toLowerCase(), locked: c.locked }));
      return true;
    }
  } catch (error) {
    // Nothing saved, or it was unreadable
  }
  return false;
}

// ---------- Wiring ----------
document.getElementById("generate").addEventListener("click", generate);

document.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || event.repeat) return;
  event.preventDefault(); // stops the page scrolling and stops a focused button from also clicking
  generate();
});

if (load()) render();
else generate();