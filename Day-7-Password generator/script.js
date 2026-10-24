// ---------- Character sets ----------
const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+?",
};
const LOOKALIKES = "0O1lI";

// ---------- DOM elements ----------
const el = {
  password: document.getElementById("password"),
  length: document.getElementById("length"),
  lengthOut: document.getElementById("length-out"),
  lookalike: document.getElementById("lookalike"),
  copy: document.getElementById("copy"),
  generate: document.getElementById("generate"),
  status: document.getElementById("status"),
  meter: document.getElementById("meter"),
  strengthText: document.getElementById("strength-text"),
};
const typeBoxes = ["lower", "upper", "numbers", "symbols"].map((id) => document.getElementById(id));

// ---------- Secure randomness ----------
// Math.random() is predictable, so it is not safe for passwords.
// crypto.getRandomValues() is made for security.
function randomInt(max) {
  // Throw away numbers that would make some results more likely than others ("modulo bias")
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  let number;
  do {
    crypto.getRandomValues(buffer);
    number = buffer[0];
  } while (number >= limit);
  return number % max;
}

function pick(text) {
  return text[randomInt(text.length)];
}

// Fisher-Yates shuffle, using the secure random numbers
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// ---------- Building the password ----------
function getPools() {
  return typeBoxes
    .filter((box) => box.checked)
    .map((box) => {
      let chars = SETS[box.id];
      if (el.lookalike.checked) {
        chars = [...chars].filter((c) => !LOOKALIKES.includes(c)).join("");
      }
      return chars;
    });
}

function makePassword(length, pools) {
  const chars = [];

  // One from every ticked type, so a ticked option always shows up
  pools.forEach((pool) => chars.push(pick(pool)));

  // Fill the rest from all ticked types together
  const everything = pools.join("");
  while (chars.length < length) {
    chars.push(pick(everything));
  }

  // Shuffle so the guaranteed characters aren't always at the start
  return shuffle(chars).join("");
}

// ---------- Strength ----------
// entropy (bits) = length x log2(number of possible characters)
function rate(bits) {
  if (bits < 40) return { label: "Weak", level: 1 };
  if (bits < 60) return { label: "Okay", level: 2 };
  if (bits < 80) return { label: "Strong", level: 3 };
  return { label: "Very strong", level: 4 };
}

// ---------- Rendering ----------
function charType(char) {
  if (/[0-9]/.test(char)) return "digit";
  if (/[a-z]/i.test(char)) return "letter";
  return "symbol";
}

function showPassword(password) {
  el.password.textContent = "";
  const fragment = document.createDocumentFragment();
  for (const char of password) {
    const span = document.createElement("span");
    span.className = "c-" + charType(char);
    span.textContent = char;
    fragment.appendChild(span);
  }
  el.password.appendChild(fragment);
}

let statusTimer = null;
function setStatus(message, clearAfterMs = 0) {
  clearTimeout(statusTimer);
  el.status.textContent = message;
  if (clearAfterMs) {
    statusTimer = setTimeout(() => (el.status.textContent = ""), clearAfterMs);
  }
}

function update() {
  const length = Number(el.length.value);
  const pools = getPools();

  showPassword(makePassword(length, pools));
  el.lengthOut.textContent = length;

  const bits = length * Math.log2(pools.join("").length);
  const rating = rate(bits);
  el.meter.dataset.level = rating.level;
  el.strengthText.textContent = `${rating.label}, about ${Math.round(bits)} bits`;
}

// ---------- Copy ----------
function fallbackCopy(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (error) {
    ok = false;
  }
  area.remove();
  return ok;
}

async function copyPassword() {
  const text = el.password.textContent;
  let copied = false;

  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch (error) {
    copied = fallbackCopy(text);
  }

  if (copied) {
    el.copy.textContent = "Copied";
    setTimeout(() => (el.copy.textContent = "Copy"), 1600);
    setStatus("Password copied.", 1600);
  } else {
    setStatus("Couldn't copy. Select the password and copy it yourself.", 4000);
  }
}

// ---------- Events ----------
el.length.addEventListener("input", update);

typeBoxes.forEach((box) => {
  box.addEventListener("change", () => {
    // Need at least one type, or there is nothing to build a password from
    if (!typeBoxes.some((b) => b.checked)) {
      box.checked = true;
      setStatus("Keep at least one type selected.", 3000);
      return;
    }
    update();
  });
});

el.lookalike.addEventListener("change", update);

el.generate.addEventListener("click", () => {
  update();
  setStatus("New password ready.", 1200);
});

el.copy.addEventListener("click", copyPassword);

// ---------- Init ----------
update();