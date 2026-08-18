// ==========================================
// 1. IndexedDB Engine for Persistent Audio Clips
// ==========================================
const DB_NAME = "DadSoundboardDB";
const STORE_NAME = "custom_pads";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveCustomPadToDB(padObj) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(padObj);
    return tx.complete;
  } catch (err) {
    console.error("IndexedDB Save Error:", err);
  }
}

async function getAllCustomPadsFromDB() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error("IndexedDB Load Error:", err);
    return [];
  }
}

// ==========================================
// 2. Audio Libraries & Sound Bank State
// ==========================================
const classicSounds = {
  rimshot: {
    title: "Ba-Dum-Tss!",
    emoji: "🥁",
    laugh: "https://www.myinstants.com/media/sounds/bad-joke-drum.mp3",
    groan: "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3"
  },
  crickets: {
    title: "Crickets",
    emoji: "🦗",
    laugh: "https://www.myinstants.com/media/sounds/awkward-cricket-sound-effect.mp3",
    groan: "https://assets.mixkit.co/active_storage/sfx/2805/2805-preview.mp3"
  },
  applause: {
    title: "Crowd",
    emoji: "👏",
    laugh: "https://www.myinstants.com/media/sounds/crowd-cheer-deltarune.mp3",
    groan: "https://assets.mixkit.co/active_storage/sfx/2804/2804-preview.mp3"
  },
  risitas: {
    title: "El Risitas",
    emoji: "😂",
    laugh: "https://www.myinstants.com/media/sounds/untitled_Bh5UcZG.mp3",
    groan: "https://cdn.jsdelivr.net/gh/gist-assets/audio/kekw-risitas.mp3"
  },
  throat_clear: {
    title: "Ahem!",
    emoji: "🗣️",
    laugh: "https://assets.mixkit.co/active_storage/sfx/2212/2212-preview.mp3",
    groan: "https://assets.mixkit.co/active_storage/sfx/2212/2212-preview.mp3"
  },
  sigh: {
    title: "Heavy Sigh",
    emoji: "😮‍💨",
    laugh: "https://www.myinstants.com/media/sounds/annoyed-sigh.mp3",
    groan: "https://assets.mixkit.co/active_storage/sfx/2804/2804-preview.mp3"
  }
};

const bbqSounds = {
  sizzle: {
    title: "Grill Sizzle",
    emoji: "🥩",
    laugh: "https://assets.mixkit.co/active_storage/sfx/2400/2400-preview.mp3"
  },
  beer_pop: {
    title: "Beer Pop",
    emoji: "🍺",
    laugh: "https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3"
  },
  lawnmower: {
    title: "Lawnmower",
    emoji: "🚜",
    laugh: "https://assets.mixkit.co/active_storage/sfx/1381/1381-preview.mp3"
  },
  lighter: {
    title: "Lighter Click",
    emoji: "🔥",
    laugh: "https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3"
  }
};

let activeSoundBank = { ...classicSounds };
let customPads = {};
let currentMode = "laugh";
let currentTheme = "classic";
const loadedHowls = {};
let meterScore = 50;

// Stats Tracker (LocalStorage)
let stats = JSON.parse(localStorage.getItem("dad_stats")) || { jokes: 0, groans: 0, panics: 0 };

// ==========================================
// 3. DOM Elements
// ==========================================
const grid = document.getElementById("soundboard");
const modeToggle = document.getElementById("mode-toggle");
const themeToggle = document.getElementById("theme-toggle");
const recordBtn = document.getElementById("record-btn");
const shareBtn = document.getElementById("share-btn");
const panicBtn = document.getElementById("panic-btn");
const stopAllBtn = document.getElementById("stop-all-btn");
const jokeText = document.getElementById("joke-text");
const getJokeBtn = document.getElementById("get-joke-btn");
const ttsBtn = document.getElementById("tts-btn");
const downloadJokeBtn = document.getElementById("download-joke-btn");
const pitchSlider = document.getElementById("pitch-slider");
const pitchVal = document.getElementById("pitch-val");
const meterBar = document.getElementById("meter-bar");
const meterProgress = document.getElementById("meter-progress");
const meterScoreEl = document.getElementById("meter-score");
const resetStatsBtn = document.getElementById("reset-stats-btn");
const gradConfettiBtn = document.getElementById("grad-confetti-btn");

// Reaction Buttons
const reactEyeRoll = document.getElementById("react-eyeroll");
const reactFacepalm = document.getElementById("react-facepalm");
const reactConfetti = document.getElementById("react-confetti");

// ==========================================
// 4. Audio Initialization & Global Mute Controls
// ==========================================
function initAudio() {
  const combinedBank = { ...activeSoundBank, ...customPads };

  Object.keys(combinedBank).forEach(key => {
    if (loadedHowls[key]) loadedHowls[key].unload();

    const audioSrc = combinedBank[key][currentMode] || combinedBank[key].laugh;

    loadedHowls[key] = new Howl({
      src: [audioSrc],
      html5: true,
      rate: parseFloat(pitchSlider ? pitchSlider.value : 1.0),
      onplay: () => triggerPadUI(key, true),
      onend: () => triggerPadUI(key, false),
      onloaderror: () => console.warn(`Failed to load audio for pad: ${key}`)
    });
  });
}

function stopAllAudio() {
  if (typeof Howler !== "undefined") Howler.stop();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  
  Object.keys(loadedHowls).forEach(key => triggerPadUI(key, false));
}

// ==========================================
// 5. Play Sound & Meter Updates
// ==========================================
function playSound(key) {
  if (loadedHowls[key]) {
    loadedHowls[key].stop();
    loadedHowls[key].play();

    if (key === 'rimshot' || key === 'risitas') {
      updateMeter(25);
      triggerConfetti(90, 80);
    } else if (key === 'crickets' || key === 'sigh') {
      updateMeter(-15);
      updateStats("groans", 1);
    }
  }
}

function updateMeter(delta) {
  meterScore = Math.max(0, Math.min(100, meterScore + delta));
  if (meterBar) meterBar.style.width = `${meterScore}%`;
  if (meterProgress) meterProgress.setAttribute("aria-valuenow", meterScore);
  
  if (meterScoreEl) {
    if (meterScore >= 75) meterScoreEl.innerText = "Comedy Gold 🏆";
    else if (meterScore >= 40) meterScoreEl.innerText = "Decent Chuckle 🙂";
    else meterScoreEl.innerText = "Eye Roll 🙄";
  }
}

function triggerConfetti(particleCount = 100, spread = 70) {
  if (typeof confetti === 'function') {
    confetti({ particleCount, spread, origin: { y: 0.7 } });
  }
}

// ==========================================
// 6. Graduation Tribute Burst
// ==========================================
if (gradConfettiBtn) {
  gradConfettiBtn.addEventListener("click", () => {
    playSound("applause");
    if (typeof confetti === 'function') {
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
      setTimeout(() => confetti({ particleCount: 100, spread: 80, origin: { y: 0.3 } }), 250);
    }
  });
}

// ==========================================
// 7. Render Sound Pads (Accessibility Enabled)
// ==========================================
function renderPads() {
  if (!grid) return;
  grid.innerHTML = "";
  const combinedBank = { ...activeSoundBank, ...customPads };
  const allKeys = Object.keys(combinedBank);

  allKeys.forEach((key, index) => {
    const pad = document.createElement("div");
    pad.className = "pad";
    pad.id = `pad-${key}`;
    pad.setAttribute("role", "button");
    pad.setAttribute("tabindex", "0");

    const info = combinedBank[key] || { title: "Custom Clip", emoji: "🎙️" };
    const shortcutHint = index < 9 ? `Key ${index + 1}` : "";
    
    pad.setAttribute("aria-label", `${info.title}. ${shortcutHint ? 'Hotkey ' + shortcutHint : ''}`);

    pad.innerHTML = `
      <span>${info.emoji}</span>
      <p>${info.title}</p>
      ${shortcutHint ? `<small>[${shortcutHint}]</small>` : ""}
    `;

    pad.addEventListener("click", () => playSound(key));
    pad.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        playSound(key);
      }
    });

    grid.appendChild(pad);
  });
}

function triggerPadUI(key, isPlaying) {
  const el = document.getElementById(`pad-${key}`);
  if (el) {
    el.classList.toggle("playing", isPlaying);
    el.setAttribute("aria-pressed", isPlaying ? "true" : "false");
  }
}

// ==========================================
// 8. Text-To-Speech "Dad Voice", Jokes & Meme Export
// ==========================================
function speakJoke(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text.replace(/^"|"$/g, ""));
  const rateVal = parseFloat(pitchSlider ? pitchSlider.value : 1.0);
  utterance.rate = rateVal;
  utterance.pitch = Math.max(0.5, rateVal * 0.7);

  window.speechSynthesis.speak(utterance);
}

async function fetchDadJoke() {
  if (jokeText) jokeText.innerText = "Fetching a terrible joke...";
  try {
    const res = await fetch("https://icanhazdadjoke.com/", {
      headers: { Accept: "application/json" }
    });
    const data = await res.json();
    if (jokeText) jokeText.innerText = `"${data.joke}"`;
    updateStats("jokes", 1);
    speakJoke(data.joke);
  } catch (err) {
    if (jokeText) jokeText.innerText = '"Why do dads take an extra pair of socks golfing? In case they get a hole in one!"';
  }
}

if (getJokeBtn) getJokeBtn.addEventListener("click", fetchDadJoke);
if (ttsBtn) ttsBtn.addEventListener("click", () => speakJoke(jokeText ? jokeText.innerText : ""));

// Download Joke Card as Image Poster (Meme Export)
if (downloadJokeBtn) {
  downloadJokeBtn.addEventListener("click", async () => {
    const jokeCard = document.querySelector(".joke-card");
    if (!jokeCard) return;

    if (typeof html2canvas === "undefined") {
      alert("html2canvas library is not loaded. Check index.html!");
      return;
    }

    try {
      // Add temporary export class to apply meme styles and hide buttons
      jokeCard.classList.add("meme-export");

      const canvas = await html2canvas(jokeCard, {
        backgroundColor: "#1e1e24",
        scale: 2
      });

      jokeCard.classList.remove("meme-export");

      // Trigger standard PNG download
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `Dad_Joke_Meme_${Date.now()}.png`;
      link.click();
    } catch (err) {
      console.error("Failed to export meme poster:", err);
      alert("Failed to create poster. Please try again!");
    }
  });
}

// ==========================================
// 9. Reaction Bar Event Listeners
// ==========================================
if (reactEyeRoll) {
  reactEyeRoll.addEventListener("click", () => {
    updateMeter(-15);
    updateStats("groans", 1);
  });
}

if (reactFacepalm) {
  reactFacepalm.addEventListener("click", () => {
    updateMeter(-25);
    updateStats("groans", 1);
  });
}

if (reactConfetti) {
  reactConfetti.addEventListener("click", () => {
    updateMeter(20);
    triggerConfetti(70, 70);
  });
}

if (stopAllBtn) stopAllBtn.addEventListener("click", stopAllAudio);

// ==========================================
// 10. Stats Management (LocalStorage)
// ==========================================
function updateStats(type, delta) {
  stats[type] = (stats[type] || 0) + delta;
  localStorage.setItem("dad_stats", JSON.stringify(stats));
  renderStats();
}

function renderStats() {
  const statJokesEl = document.getElementById("stat-jokes");
  const statGroansEl = document.getElementById("stat-groans");
  const statPanicsEl = document.getElementById("stat-panics");

  if (statJokesEl) statJokesEl.innerText = stats.jokes;
  if (statGroansEl) statGroansEl.innerText = stats.groans;
  if (statPanicsEl) statPanicsEl.innerText = stats.panics;
}

if (resetStatsBtn) {
  resetStatsBtn.addEventListener("click", () => {
    stats = { jokes: 0, groans: 0, panics: 0 };
    localStorage.removeItem("dad_stats");
    renderStats();
  });
}

// ==========================================
// 11. Pitch & Speed Slider
// ==========================================
if (pitchSlider) {
  pitchSlider.addEventListener("input", (e) => {
    const rate = parseFloat(e.target.value);
    if (pitchVal) pitchVal.innerText = `${rate.toFixed(1)}x`;
    
    Object.keys(loadedHowls).forEach(key => {
      if (loadedHowls[key]) loadedHowls[key].rate(rate);
    });
  });
}

// ==========================================
// 12. Theme & Mode Toggles
// ==========================================
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "classic" ? "bbq" : "classic";
    document.body.classList.toggle("bbq-mode", currentTheme === "bbq");
    themeToggle.innerText = currentTheme === "classic" ? "Theme: 🍔 BBQ Mode" : "Theme: 🥁 Classic";

    activeSoundBank = currentTheme === "bbq" ? { ...bbqSounds } : { ...classicSounds };
    renderPads();
    initAudio();
  });
}

if (modeToggle) {
  modeToggle.addEventListener("click", () => {
    currentMode = currentMode === "laugh" ? "groan" : "laugh";
    modeToggle.innerText = currentMode === "laugh" ? "Mode: 🎭 Laugh Track" : "Mode: 😩 Groan Track";
    initAudio();
  });
}

// ==========================================
// 13. Panic Button
// ==========================================
if (panicBtn) {
  panicBtn.addEventListener("click", () => {
    const keys = Object.keys(loadedHowls);
    if (keys.length === 0) return;
    updateStats("panics", 1);

    [0, 300, 600].forEach((delay) => {
      setTimeout(() => {
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        playSound(randomKey);
      }, delay);
    });
  });
}

// ==========================================
// 14. Mic Recording & Persistent IndexedDB Storage
// ==========================================
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

if (recordBtn) {
  recordBtn.addEventListener("click", async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: "audio/mp3" });
          const audioUrl = URL.createObjectURL(audioBlob);

          const customTitle = prompt("Enter a name for your custom sound pad:", "My Groan") || "Custom Clip";
          const customEmoji = prompt("Enter an emoji for this pad:", "🎙️") || "🎙️";
          const customId = `custom_${Date.now()}`;

          const padRecord = {
            id: customId,
            title: customTitle,
            emoji: customEmoji,
            blob: audioBlob
          };

          await saveCustomPadToDB(padRecord);

          customPads[customId] = {
            title: customTitle,
            emoji: customEmoji,
            laugh: audioUrl,
            groan: audioUrl
          };

          renderPads();
          initAudio();
        };

        mediaRecorder.start();
        isRecording = true;
        recordBtn.classList.add("active");
        recordBtn.innerText = "🛑 Stop & Save Pad";
      } catch (err) {
        alert("Microphone access is required to record custom audio.");
      }
    } else {
      mediaRecorder.stop();
      isRecording = false;
      recordBtn.classList.remove("active");
      recordBtn.innerText = "🎙️ Record Pad";
    }
  });
}

if (shareBtn) {
  shareBtn.addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", currentMode);
    navigator.clipboard.writeText(url.href);
    alert("Shareable link copied to clipboard!");
  });
}

// ==========================================
// 15. Global Keyboard Hotkeys (1-9 & Escape)
// ==========================================
window.addEventListener("keydown", (event) => {
  if (["INPUT", "TEXTAREA", "BUTTON"].includes(event.target.tagName)) return;

  if (event.key === "Escape") {
    stopAllAudio();
    return;
  }

  const keyIndex = parseInt(event.key, 10);
  if (!isNaN(keyIndex) && keyIndex >= 1 && keyIndex <= 9) {
    const combinedBank = { ...activeSoundBank, ...customPads };
    const padKeys = Object.keys(combinedBank);
    const targetKey = padKeys[keyIndex - 1];
    if (targetKey) playSound(targetKey);
  }
});

// ==========================================
// 16. Initial Load & Startup Lifecycle
// ==========================================
window.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "groan") {
    currentMode = "groan";
    if (modeToggle) modeToggle.innerText = "Mode: 😩 Groan Track";
  }

  // Load persisted custom pads from IndexedDB
  const storedPads = await getAllCustomPadsFromDB();
  storedPads.forEach(pad => {
    const audioUrl = URL.createObjectURL(pad.blob);
    customPads[pad.id] = {
      title: pad.title,
      emoji: pad.emoji,
      laugh: audioUrl,
      groan: audioUrl
    };
  });

  renderStats();
  renderPads();
  initAudio();
});