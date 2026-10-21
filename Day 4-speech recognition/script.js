const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const notes = document.getElementById("notes");
const interimEl = document.getElementById("interim");
const wordCountEl = document.getElementById("wordCount");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;

// ---------- Helpers ----------
function setStatus(message, listening) {
  statusEl.textContent = message;
  statusEl.classList.toggle("listening", Boolean(listening));
}

function updateWordCount() {
  const text = notes.value.trim();
  const count = text === "" ? 0 : text.split(/\s+/).length;
  wordCountEl.textContent = count + (count === 1 ? " word" : " words");
}

function addText(text) {
  const needsSpace = notes.value !== "" && !notes.value.endsWith("\n") && !notes.value.endsWith(" ");
  notes.value += (needsSpace ? " " : "") + text;
  notes.scrollTop = notes.scrollHeight;
  updateWordCount();
}

function copyNotes() {
  if (notes.value.trim() === "") {
    setStatus("Nothing to copy", isListening);
    return;
  }
  navigator.clipboard.writeText(notes.value).then(
    function () { setStatus("Copied to clipboard ✅", isListening); },
    function () { setStatus("Could not copy. Select the text and copy it manually.", isListening); }
  );
}

function clearNotes() {
  notes.value = "";
  interimEl.textContent = "";
  updateWordCount();
  setStatus("Cleared", isListening);
}

function stopListening() {
  isListening = false;
  if (recognition) {
    recognition.stop();
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
  interimEl.textContent = "";
  setStatus("Stopped", false);
}

// ---------- Voice commands (conditionals!) ----------
function handleSpeech(rawText) {
  const spoken = rawText.trim().toLowerCase().replace(/[.,!?]/g, "");

  if (spoken === "clear") {
    clearNotes();
  } else if (spoken === "copy") {
    copyNotes();
  } else if (spoken === "new line") {
    notes.value += "\n";
    updateWordCount();
  } else if (spoken === "stop") {
    stopListening();
  } else {
    addText(rawText.trim());
  }
}

// ---------- Speech recognition setup ----------
if (!SpeechRecognition) {
  setStatus("Sorry, your browser does not support speech recognition. Please use Chrome or Edge.", false);
  startBtn.disabled = true;
} else {
  recognition = new SpeechRecognition();
  recognition.lang = "en-NG";        // Nigerian English. Change to "en-US" if it works poorly.
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = function (event) {
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        handleSpeech(transcript);
      } else {
        interimText += transcript;
      }
    }

    interimEl.textContent = interimText;
  };

  recognition.onerror = function (event) {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      setStatus("Microphone blocked. Allow mic access in your browser and try again.", false);
      isListening = false;
      startBtn.disabled = false;
      stopBtn.disabled = true;
    } else if (event.error === "no-speech") {
      setStatus("Didn't hear anything. Still listening...", true);
    } else if (event.error === "network") {
      setStatus("Network error. Speech recognition needs an internet connection.", false);
    } else if (event.error !== "aborted") {
      setStatus("Error: " + event.error, false);
    }
  };

  // Chrome stops after a pause, so restart if the user hasn't pressed Stop
  recognition.onend = function () {
    if (isListening) {
      try {
        recognition.start();
      } catch (e) {
        // already starting, ignore
      }
    }
  };
}

// ---------- Button events ----------
startBtn.addEventListener("click", function () {
  if (!recognition) return;
  isListening = true;
  recognition.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;
  setStatus("🔴 Listening... speak now", true);
});

stopBtn.addEventListener("click", stopListening);
copyBtn.addEventListener("click", copyNotes);
clearBtn.addEventListener("click", clearNotes);
notes.addEventListener("input", updateWordCount);

updateWordCount();