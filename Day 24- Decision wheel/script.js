
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");

const optionInput = document.getElementById("optionInput");
const optionForm = document.getElementById("optionForm");
const optionList = document.getElementById("optionList");
const optionCount = document.getElementById("optionCount");

const spinButton = document.getElementById("spinButton");
const shuffleButton = document.getElementById("shuffleButton");
const resetButton = document.getElementById("resetButton");

const resultText = document.getElementById("resultText");

const colors = [
  "#F5A45C",
  "#F5D8B9",
  "#E8753D",
  "#F2C18D",
  "#D96B36",
  "#F7E6D4",
  "#E99B59",
  "#EFCBA9",
  "#C96C3B",
  "#F5DCC4"
];

const defaultOptions = [
  "Coffee",
  "Take a walk",
  "Watch a film",
  "Cook something",
  "Read a book",
  "Surprise me"
];

let options = [...defaultOptions];
let rotation = 0;
let spinning = false;
let animationFrame = null;

const TAU = Math.PI * 2;

function normalizeAngle(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

/* Canvas sizing */

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  drawWheel();
}

/* Draw wheel */

function drawWheel() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  if (!width || !height) return;

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.46;

  ctx.clearRect(0, 0, width, height);

  if (options.length === 0) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, TAU);
    ctx.fillStyle = "#F1EEE8";
    ctx.fill();

    ctx.fillStyle = "#89877F";
    ctx.font = "500 15px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Add some options", centerX, centerY);

    return;
  }

  const slice = TAU / options.length;
  const startAngle = -Math.PI / 2 + rotation;

  // Outer rim
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 5, 0, TAU);
  ctx.fillStyle = "#F0E7DC";
  ctx.fill();

  // Wheel segments
  options.forEach((option, index) => {
    const start = startAngle + index * slice;
    const end = start + slice;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, start, end);
    ctx.closePath();

    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Segment text
    ctx.save();

    const middle = start + slice / 2;

    ctx.translate(centerX, centerY);
    ctx.rotate(middle);

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#382D24";

    const fontSize = Math.max(
      9,
      Math.min(16, 210 / options.length)
    );

    ctx.font = `600 ${fontSize}px DM Sans, sans-serif`;

    const maxTextWidth = radius * 0.68;
    let label = option;

    while (
      ctx.measureText(label).width > maxTextWidth &&
      label.length > 3
    ) {
      label = label.slice(0, -2) + "…";
    }

    ctx.fillText(label, radius - 18, 0);

    ctx.restore();
  });

  // Inner hub outline
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.13, 0, TAU);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
}

/* Render option list */

function renderOptions() {
  optionList.innerHTML = "";

  options.forEach((option, index) => {
    const item = document.createElement("div");
    item.className = "option-item";

    const dot = document.createElement("span");
    dot.className = "option-dot";
    dot.style.backgroundColor = colors[index % colors.length];

    const input = document.createElement("input");
    input.type = "text";
    input.value = option;
    input.maxLength = 32;
    input.setAttribute("aria-label", `Option ${index + 1}`);

    input.addEventListener("change", () => {
      const value = input.value.trim();

      if (!value) {
        input.value = options[index];
        return;
      }

      options[index] = value;
      drawWheel();
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
    });

    const removeButton = document.createElement("button");
    removeButton.className = "remove-option";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Remove ${option}`);

    removeButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"/>
      </svg>
    `;

    removeButton.addEventListener("click", () => {
      if (spinning) return;

      options.splice(index, 1);
      updateInterface();
    });

    item.append(dot, input, removeButton);
    optionList.appendChild(item);
  });

  optionCount.textContent =
    `${options.length} ${options.length === 1 ? "option" : "options"}`;

  spinButton.disabled = spinning || options.length < 2;
}

/* Update interface */

function updateInterface() {
  renderOptions();
  drawWheel();
}

/* Add option */

optionForm.addEventListener("submit", event => {
  event.preventDefault();

  if (spinning) return;

  const value = optionInput.value.trim();

  if (!value) {
    optionInput.focus();
    return;
  }

  if (options.length >= 24) {
    alert("You can add up to 24 options.");
    return;
  }

  options.push(value);
  optionInput.value = "";

  resultText.textContent = "Your answer will appear here.";
  resultText.classList.remove("winner");

  updateInterface();
  optionInput.focus();
});

/* Shuffle options */

shuffleButton.addEventListener("click", () => {
  if (spinning) return;

  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [options[i], options[j]] = [options[j], options[i]];
  }

  rotation = 0;

  resultText.textContent = "Your answer will appear here.";
  resultText.classList.remove("winner");

  updateInterface();
});

/* Reset */

resetButton.addEventListener("click", () => {
  if (spinning) return;

  options = [...defaultOptions];
  rotation = 0;

  resultText.textContent = "Your answer will appear here.";
  resultText.classList.remove("winner");

  updateInterface();
});

/* Spin wheel */

function spinWheel() {
  if (spinning || options.length < 2) return;

  spinning = true;
  spinButton.disabled = true;

  resultText.textContent = "The wheel is spinning...";
  resultText.classList.remove("winner");

  const slice = TAU / options.length;

  // Select the winning option first.
  const winnerIndex = Math.floor(
    Math.random() * options.length
  );

  // Find the rotation that puts the selected segment
  // directly under the fixed pointer at the top.
  const currentAngle = normalizeAngle(rotation);

  const targetAngle = normalizeAngle(
    -(winnerIndex + 0.5) * slice
  );

  const extraTurns = 5 + Math.floor(Math.random() * 3);

  const delta = normalizeAngle(targetAngle - currentAngle)
    + extraTurns * TAU;

  const startRotation = rotation;
  const endRotation = rotation + delta;

  const duration = 5000;
  const startTime = performance.now();

  // Ease out cubic: fast at first, gradually slows down.
  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const eased = 1 - Math.pow(1 - progress, 4);

    rotation = startRotation +
      (endRotation - startRotation) * eased;

    drawWheel();

    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      finishSpin(winnerIndex);
    }
  }

  animationFrame = requestAnimationFrame(animate);
}

/* Finish spin */

function finishSpin(winnerIndex) {
  rotation = normalizeAngle(rotation);

  drawWheel();

  spinning = false;
  spinButton.disabled = options.length < 2;

  const winner = options[winnerIndex];

  resultText.textContent = winner;
  resultText.classList.add("winner");
}

/* Spin button */

spinButton.addEventListener("click", spinWheel);

/* Initial render */

updateInterface();

if ("ResizeObserver" in window) {
  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas);
} else {
  window.addEventListener("resize", resizeCanvas);
}

resizeCanvas();
