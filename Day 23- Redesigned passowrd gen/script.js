const pwEl = document.getElementById("pw");
const copyEl = document.getElementById("copy");
const lenEl = document.getElementById("len");
const lenVal = document.getElementById("lenVal");
const upperEl = document.getElementById("upper");
const lowerEl = document.getElementById("lower");
const numberEl = document.getElementById("number");
const symbolEl = document.getElementById("symbol");
const generateEl = document.getElementById("generate");
const entropyEl = document.getElementById("entropy");
const strengthLabel = document.getElementById("strengthLabel");
const poolSizeEl = document.getElementById("poolSize");
const meterFill = document.getElementById("meterFill");

const upperLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lowerLetters = "abcdefghijklmnopqrstuvwxyz";
const numbers = "0123456789";
const symbols = "!@#$%^&*()_+=";

function getLowercase() {
  return lowerLetters[Math.floor(Math.random() * lowerLetters.length)];
}

function getUppercase() {
  return upperLetters[Math.floor(Math.random() * upperLetters.length)];
}

function getNumber() {
  return numbers[Math.floor(Math.random() * numbers.length)];
}

function getSymbol() {
  return symbols[Math.floor(Math.random() * symbols.length)];
}

function getPool() {
  let pool = "";
  if (upperEl.checked) pool += upperLetters;
  if (lowerEl.checked) pool += lowerLetters;
  if (numberEl.checked) pool += numbers;
  if (symbolEl.checked) pool += symbols;
  return pool;
}

function pickFrom(str) {
  return str[Math.floor(Math.random() * str.length)];
}

function shuffle(chars) {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

function updateStats() {
  const len = Number(lenEl.value);
  const pool = getPool();
  const poolSize = pool.length;
  const entropy = poolSize ? Math.round(len * Math.log2(poolSize)) : 0;

  let label = "None";
  let color = "var(--weak)";
  let width = "8%";

  if (poolSize && entropy < 45) {
    label = "Weak";
    color = "var(--weak)";
    width = "28%";
  } else if (entropy < 70) {
    label = "Fair";
    color = "var(--warn)";
    width = "52%";
  } else if (entropy < 95) {
    label = "Strong";
    color = "var(--ok)";
    width = "76%";
  } else if (poolSize) {
    label = "Very strong";
    color = "var(--ok)";
    width = "100%";
  }

  entropyEl.textContent = poolSize ? `${entropy} bits` : "—";
  strengthLabel.textContent = label;
  poolSizeEl.textContent = poolSize ? `${poolSize} chars` : "—";
  meterFill.style.width = width;
  meterFill.style.background = color;
}

function generatePassword() {
  const len = Number(lenEl.value);
  const pool = getPool();

  if (!pool) {
    pwEl.textContent = "Choose at least one character set.";
    updateStats();
    return;
  }

  if (len < 8 || len > 32) {
    pwEl.textContent = "Length should be between 8 and 32.";
    updateStats();
    return;
  }

  const required = [];
  if (upperEl.checked) required.push(getUppercase());
  if (lowerEl.checked) required.push(getLowercase());
  if (numberEl.checked) required.push(getNumber());
  if (symbolEl.checked) required.push(getSymbol());

  const chars = [...required];
  while (chars.length < len) {
    chars.push(pickFrom(pool));
  }

  pwEl.textContent = shuffle(chars).join("");
  updateStats();
}

function copyPassword() {
  const password = pwEl.textContent;
  if (!password || password.includes(" ")) return;

  const done = () => {
    copyEl.textContent = "Copied";
    setTimeout(() => {
      copyEl.textContent = "Copy";
    }, 1400);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(password).then(done);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = password;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  done();
}

lenEl.addEventListener("input", () => {
  lenVal.textContent = lenEl.value;
  updateStats();
});

[upperEl, lowerEl, numberEl, symbolEl].forEach((el) => {
  el.addEventListener("change", updateStats);
});

generateEl.addEventListener("click", generatePassword);
copyEl.addEventListener("click", copyPassword);

lenVal.textContent = lenEl.value;
generatePassword();
