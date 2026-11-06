"use strict";

const SIZE = 20; // 20 x 20 cells
const CELL = 22; // pixels per cell (the canvas is 440 x 440)
const BEST_KEY = "snake-best-v1";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");

let snake, dir, queue, food, score, best, timer;
let status = "idle"; // idle, running, paused or over

// ---------- Best score ----------
try {
  best = Number(localStorage.getItem(BEST_KEY)) || 0;
} catch (error) {
  best = 0;
}
document.getElementById("best").textContent = best;

// ---------- Setting up ----------
function reset() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir = { x: 1, y: 0 };
  queue = []; // turns waiting to happen, so two quick key presses both count
  score = 0;
  document.getElementById("score").textContent = 0;
  placeFood();
  draw();
}

function placeFood() {
  if (snake.length >= SIZE * SIZE) return;
  do {
    food = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
}

const delay = () => Math.max(65, 130 - Math.floor(score / 4) * 7); // gets faster as you eat

// ---------- The game loop ----------
function step() {
  if (queue.length) dir = queue.shift();
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  const ate = head.x === food.x && head.y === food.y;
  // the tail moves out of the way unless the snake is growing
  const body = ate ? snake : snake.slice(0, -1);

  const hitWall = head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE;
  if (hitWall || body.some((s) => s.x === head.x && s.y === head.y)) {
    return gameOver();
  }

  snake.unshift(head);
  if (ate) {
    score++;
    document.getElementById("score").textContent = score;
    if (snake.length >= SIZE * SIZE) {
      draw();
      return gameOver(true);
    }
    placeFood();
  } else {
    snake.pop();
  }

  draw();
  timer = setTimeout(step, delay());
}

function gameOver(won = false) {
  status = "over";
  clearTimeout(timer);
  if (score > best) {
    best = score;
    document.getElementById("best").textContent = best;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (error) {
      // Storage can be blocked. The game still works.
    }
  }
  showOverlay(won ? "You filled the board" : "Game over", `Score ${score}. Press Space to play again`);
}

// ---------- Starting and pausing ----------
function start() {
  if (status === "idle" || status === "over") reset();
  status = "running";
  overlay.hidden = true;
  clearTimeout(timer);
  timer = setTimeout(step, delay());
}

function pause() {
  if (status !== "running") return;
  status = "paused";
  clearTimeout(timer);
  showOverlay("Paused", "Press Space to keep going");
}

function toggle() {
  if (status === "running") pause();
  else start();
}

function showOverlay(title, sub) {
  document.getElementById("overlay-title").textContent = title;
  document.getElementById("overlay-sub").textContent = sub;
  overlay.hidden = false;
}

// ---------- Steering ----------
function turn(x, y) {
  const last = queue.length ? queue[queue.length - 1] : dir;
  if ((x === last.x && y === last.y) || (x === -last.x && y === -last.y)) return; // same way, or straight back
  if (status !== "running") start();
  if (queue.length < 2) queue.push({ x, y });
}

const KEYS = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
};

document.addEventListener("keydown", (event) => {
  if (event.key === " ") {
    event.preventDefault();
    if (!event.repeat) toggle();
    return;
  }
  const move = KEYS[event.key];
  if (!move) return;
  event.preventDefault();
  turn(move[0], move[1]);
});

// Swipe on a phone
let touchStart = null;
canvas.addEventListener("touchstart", (event) => {
  const t = event.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });

canvas.addEventListener("touchend", (event) => {
  if (!touchStart) return;
  const t = event.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; // too small to be a swipe
  if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
  else turn(0, dy > 0 ? 1 : -1);
}, { passive: true });

overlay.addEventListener("click", toggle);
overlay.addEventListener("keydown", (event) => {
  if (event.key === "Enter") toggle();
});

// Stop the game if you switch tabs
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});

// ---------- Drawing ----------
function cell(x, y, color, radius) {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2, radius);
  else ctx.rect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  ctx.fill();
}

function draw() {
  ctx.fillStyle = "#1b1a17";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // a faint checkerboard so you can judge distances
  ctx.fillStyle = "#211f1c";
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  ctx.fillStyle = "#ef6b5b";
  ctx.beginPath();
  ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 4, 0, Math.PI * 2);
  ctx.fill();

  snake.forEach((part, i) => cell(part.x, part.y, i === 0 ? "#ffd27a" : "#f2b84b", 6));
}

// ---------- Start ----------
reset();
showOverlay("Snake", "Press Space or tap to start");