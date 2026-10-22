// ---------- Config ----------
// Open-Meteo is free and needs no API key.
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_CITY = "Lagos";
const STORAGE_KEYS = { city: "weather-app-city", unit: "weather-app-unit" };

// ---------- State ----------
let unit = readStorage(STORAGE_KEYS.unit) === "f" ? "f" : "c";
let current = null; // { place, weather } of the last successful search
let requestId = 0; // lets us ignore out-of-date responses

// ---------- DOM elements ----------
const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const statusEl = document.getElementById("status");
const weatherEl = document.getElementById("weather");
const heroEl = document.getElementById("hero");
const heroIconEl = document.getElementById("hero-icon");
const placeNameEl = document.getElementById("place-name");
const placeSubEl = document.getElementById("place-sub");
const tempEl = document.getElementById("temp");
const conditionEl = document.getElementById("condition");
const feelsEl = document.getElementById("feels");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const rangeEl = document.getElementById("range");
const forecastEl = document.getElementById("forecast");
const unitButtons = document.querySelectorAll(".unit-switch button");

// ---------- Icons (simple line icons) ----------
const ICON_PATHS = {
  clear:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  night: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  partly:
    '<path d="M8 2v1.5M2.5 8H4M3.9 3.9l1.1 1.1M12.1 3.9L11 5"/><path d="M5.5 11.2a3.5 3.5 0 1 1 6.3-2.6"/><path d="M18 20H9.5a4 4 0 1 1 .6-7.95A5.5 5.5 0 0 1 20.8 14.2 3 3 0 0 1 18 20z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 0 1 0 9z"/>',
  fog: '<path d="M4 8h16M6 12h12M4 16h16M8 20h8"/>',
  rain: '<path d="M17.5 14H9a6 6 0 1 1 5.8-7.5h2.7a3.75 3.75 0 0 1 0 7.5z"/><path d="M8 17l-1.2 3M12 17l-1.2 3M16 17l-1.2 3"/>',
  storm:
    '<path d="M17.5 13H9a6 6 0 1 1 5.8-7.5h2.7a3.75 3.75 0 0 1 0 7.5z"/><path d="M12.5 13l-3 4.5h4l-3 4.5"/>',
  snow: '<path d="M17.5 14H9a6 6 0 1 1 5.8-7.5h2.7a3.75 3.75 0 0 1 0 7.5z"/><path d="M8 18h.01M12 20h.01M16 18h.01M10 21h.01M14 21h.01"/>',
  thermo: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
  drop: '<path d="M12 2.7l5.66 5.65a8 8 0 1 1-11.32 0z"/>',
  wind: '<path d="M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2M17.7 7.7A2.5 2.5 0 1 1 19.5 12H2"/>',
  updown: '<path d="M8 20V5M3 10l5-5 5 5M16 4v15M11 14l5 5 5-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
};

function iconSVG(name) {
  // ICON_PATHS are our own static strings, never user input.
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ICON_PATHS[name] +
    "</svg>"
  );
}

// ---------- Weather codes ----------
// Open-Meteo returns a numeric "WMO" weather code. Turn it into text, an icon and a theme.
function describeWeather(code, isDay = true) {
  if (code === 0) return isDay ? { label: "Clear sky", kind: "clear" } : { label: "Clear night", kind: "night" };
  if (code === 1) return isDay ? { label: "Mostly clear", kind: "clear" } : { label: "Mostly clear", kind: "night" };
  if (code === 2) return { label: "Partly cloudy", kind: "partly" };
  if (code === 3) return { label: "Overcast", kind: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", kind: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", kind: "rain" };
  if (code >= 61 && code <= 67) return { label: "Rain", kind: "rain" };
  if (code >= 71 && code <= 77) return { label: "Snow", kind: "snow" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", kind: "rain" };
  if (code === 85 || code === 86) return { label: "Snow showers", kind: "snow" };
  if (code >= 95) return { label: "Thunderstorm", kind: "storm" };
  return { label: "Unknown", kind: "cloud" };
}

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
    // Storage can be blocked (private mode). The app still works without it.
  }
}

// ---------- Network ----------
class NotFoundError extends Error {}

async function getJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Step 1: turn a city name into coordinates
async function findPlace(query) {
  const name = query.split(",")[0].trim(); // "Lagos, Nigeria" -> "Lagos"
  const params = new URLSearchParams({ name, count: "1", language: "en", format: "json" });
  const data = await getJSON(`${GEO_URL}?${params}`);

  if (!data.results || data.results.length === 0) {
    throw new NotFoundError(query);
  }
  return data.results[0];
}

// Step 2: get the weather for those coordinates
async function fetchWeather(place) {
  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "6", // today + the next 5 days
  });
  return getJSON(`${WEATHER_URL}?${params}`);
}

// ---------- Formatting ----------
function temp(celsius) {
  const value = unit === "f" ? (celsius * 9) / 5 + 32 : celsius;
  return Math.round(value) + "°";
}

function wind(kmh) {
  return unit === "f" ? Math.round(kmh * 0.621371) + " mph" : Math.round(kmh) + " km/h";
}

function dayName(dateString, isToday) {
  if (isToday) return "Today";
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "short" });
}

// ---------- Rendering ----------
function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status" + (type ? " " + type : "");
}

function setLoading(isLoading) {
  searchBtn.disabled = isLoading;
  weatherEl.classList.toggle("is-loading", isLoading);
  if (isLoading) setStatus("Fetching the sky…", "loading");
}

function renderForecast(daily) {
  forecastEl.innerHTML = "";

  // Index 0 is today (shown in the tiles), so the list starts at 1
  for (let i = 1; i < daily.time.length; i++) {
    const info = describeWeather(daily.weather_code[i]);

    const li = document.createElement("li");
    li.dataset.theme = info.kind === "night" ? "clear" : info.kind;

    const day = document.createElement("span");
    day.className = "f-day";
    day.textContent = dayName(daily.time[i], false);

    const icon = document.createElement("span");
    icon.className = "f-icon";
    icon.innerHTML = iconSVG(info.kind);

    const label = document.createElement("span");
    label.className = "f-label";
    label.textContent = info.label;

    const temps = document.createElement("span");
    temps.className = "f-temps";
    temps.append(temp(daily.temperature_2m_max[i]) + " ");
    const low = document.createElement("span");
    low.className = "low";
    low.textContent = temp(daily.temperature_2m_min[i]);
    temps.append(low);

    li.append(day, icon, label, temps);
    forecastEl.appendChild(li);
  }
}

function render() {
  if (!current) return;
  const { place, weather } = current;
  const now = weather.current;
  const daily = weather.daily;
  const info = describeWeather(now.weather_code, now.is_day === 1);

  placeNameEl.textContent = place.name;
  placeSubEl.textContent = [place.admin1, place.country].filter(Boolean).join(", ");
  tempEl.textContent = temp(now.temperature_2m);
  conditionEl.textContent = info.label;
  heroEl.dataset.theme = info.kind;
  heroIconEl.innerHTML = iconSVG(info.kind);

  feelsEl.textContent = temp(now.apparent_temperature);
  humidityEl.textContent = Math.round(now.relative_humidity_2m) + "%";
  windEl.textContent = wind(now.wind_speed_10m);
  rangeEl.textContent = `${temp(daily.temperature_2m_max[0])} / ${temp(daily.temperature_2m_min[0])}`;

  renderForecast(daily);
  weatherEl.hidden = false;
  document.title = `${temp(now.temperature_2m)} in ${place.name} | Weather`;
}

function updateUnitButtons() {
  unitButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.unit === unit));
  });
}

function friendlyError(error, query) {
  if (error instanceof NotFoundError) {
    return `No city found for "${query}". Check the spelling or try a bigger nearby city.`;
  }
  if (error.name === "AbortError") {
    return "The weather service took too long to answer. Try again.";
  }
  if (error instanceof TypeError) {
    return "Can't reach the weather service. Check your internet connection and try again.";
  }
  return "The weather service ran into a problem. Try again in a moment.";
}

// ---------- Main flow ----------
async function loadCity(rawQuery) {
  const query = rawQuery.trim();
  if (!query) {
    setStatus("Enter a city name to search.", "error");
    cityInput.focus();
    return;
  }

  const id = ++requestId;
  setLoading(true);

  try {
    const place = await findPlace(query);
    if (id !== requestId) return; // a newer search started; ignore this one

    const weather = await fetchWeather(place);
    if (id !== requestId) return;

    current = { place, weather };
    render();
    setStatus("");
    writeStorage(STORAGE_KEYS.city, place.name);
  } catch (error) {
    if (id !== requestId) return;
    setStatus(friendlyError(error, query), "error");
  } finally {
    if (id === requestId) setLoading(false);
  }
}

// ---------- Events ----------
form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadCity(cityInput.value);
});

unitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    unit = button.dataset.unit;
    writeStorage(STORAGE_KEYS.unit, unit);
    updateUnitButtons();
    render(); // no new request needed, just re-show the same data
  });
});

// ---------- Init ----------
document.querySelectorAll("[data-icon]").forEach((el) => {
  el.innerHTML = iconSVG(el.dataset.icon);
});
updateUnitButtons();

const startCity = readStorage(STORAGE_KEYS.city) || DEFAULT_CITY;
cityInput.value = startCity;
loadCity(startCity);
