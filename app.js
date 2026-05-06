// ═══════════════════════════════════════════════════════
//  SPORTHUB — app.js
//  Firebase Auth + Firestore + Admin Dashboard
// ═══════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot,
  query, orderBy, limit, serverTimestamp, getDocs, where, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── FIREBASE CONFIG ───────────────────────────────────
// 🔧 Reemplaza estos valores con los de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDaTzlx_hjUDqtEwUCPELjF5BXjdaU-R6w",
  authDomain: "sporthub-1c5cd.firebaseapp.com",
  projectId: "sporthub-1c5cd",
  storageBucket: "sporthub-1c5cd.firebasestorage.app",
  messagingSenderId: "336712409305",
  appId: "1:336712409305:web:4348aec7a697009ce2dec8",
  measurementId: "G-RCD9R07M6K"
};

// ── EMAIL ADMIN (modifica a tu gusto) ─────────────────
const ADMIN_EMAIL = "admin@sporthub.com";

// ── INIT ──────────────────────────────────────────────
let db;
let isFirebaseConnected = false;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  isFirebaseConnected = true;
  console.log("✅ Firebase connected");
} catch (e) {
  console.warn("⚠️ Firebase not configured. Running in demo mode.");
}

// ── STATE ─────────────────────────────────────────────
let currentUser = null;
let demoUsers = [];
let activityData = new Array(12).fill(0);
let chartCtx = null;
let animFrame = null;

// ── DOM REFS ──────────────────────────────────────────
const loginOverlay   = document.getElementById("loginOverlay");
const adminDashboard = document.getElementById("adminDashboard");
const mainApp        = document.getElementById("mainApp");
const feedList       = document.getElementById("feedList");
const navUser        = document.getElementById("navUser");

// ════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════
window.addEventListener("DOMContentLoaded", () => {
  animateCounters();
  buildPlayerCards();
  buildSportsWheel();
  setupNavScroll();

  // Enter press on inputs
  ["inputName","inputSurname","inputEmail"].forEach(id => {
    document.getElementById(id).addEventListener("keydown", e => {
      if (e.key === "Enter") handleLogin();
    });
  });
});

// ════════════════════════════════════════════════════════
//  LOGIN HANDLER
// ════════════════════════════════════════════════════════
window.handleLogin = async function () {
  const name    = document.getElementById("inputName").value.trim();
  const surname = document.getElementById("inputSurname").value.trim();
  const email   = document.getElementById("inputEmail").value.trim().toLowerCase();
  const btn     = document.getElementById("loginBtn");

  if (!name || !surname || !email) {
    shakeModal();
    showFieldErrors(name, surname, email);
    return;
  }
  if (!isValidEmail(email)) {
    shakeModal();
    highlightField("inputEmail");
    return;
  }

  // Loading state
  btn.innerHTML = `<span class="btn-text">CONECTANDO...</span><div class="spin"></div>`;
  btn.disabled = true;

  const userData = { name, surname, email, timestamp: new Date().toISOString() };

  // Save to Firebase or demo array
  if (isFirebaseConnected) {
    try {
      await addDoc(collection(db, "users"), {
        ...userData,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Firestore write failed:", err);
    }
  } else {
    demoUsers.unshift({ ...userData, id: Date.now() });
  }

  currentUser = userData;

  // Small delay for UX feel
  await sleep(600);

  // Reset button
  btn.innerHTML = `<span class="btn-text">ENTRAR AL JUEGO</span><span class="btn-arrow">→</span><div class="btn-ripple"></div>`;
  btn.disabled = false;

  // Admin or normal user
  if (email === ADMIN_EMAIL) {
    showAdminDashboard();
  } else {
    showMainApp();
  }
};

window.logout = function () {
  currentUser = null;
  loginOverlay.classList.remove("hidden");
  adminDashboard.classList.add("hidden");
  mainApp.classList.add("hidden");
  document.getElementById("inputEmail").value = "";
  document.getElementById("inputName").value = "";
  document.getElementById("inputSurname").value = "";
  const btn = document.getElementById("loginBtn");
  btn.innerHTML = `<span class="btn-text">ENTRAR AL JUEGO</span><span class="btn-arrow">→</span><div class="btn-ripple"></div>`;
  btn.disabled = false;
};

// ════════════════════════════════════════════════════════
//  SHOW MAIN APP
// ════════════════════════════════════════════════════════
function showMainApp() {
  loginOverlay.classList.add("hidden");
  mainApp.classList.remove("hidden");
  navUser.textContent = `👤 ${currentUser.email}`;
  mainApp.scrollTop = 0;
}

// ════════════════════════════════════════════════════════
//  SHOW ADMIN DASHBOARD
// ════════════════════════════════════════════════════════
function showAdminDashboard() {
  loginOverlay.classList.add("hidden");
  adminDashboard.classList.remove("hidden");

  setupChart();
  buildSportBars();

  if (isFirebaseConnected) {
    // KPIs will be set by Firebase listeners
    feedList.innerHTML = "<div class='feed-empty'>Cargando usuarios...</div>";
    listenFirebase();
  } else {
    updateKPIs(demoUsers.length);
    startDemoMode();
  }
}

// ════════════════════════════════════════════════════════
//  FIREBASE REALTIME LISTENER
// ════════════════════════════════════════════════════════
let initialLoadDone = false;

function listenFirebase() {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(100));

  onSnapshot(q, (snapshot) => {
    const total = snapshot.size;
    document.getElementById("kpiTotal").textContent = total;
    document.getElementById("adminLiveCount").textContent = total;

    if (!initialLoadDone) {
      // Primera carga: mostrar TODOS los usuarios existentes
      initialLoadDone = true;
      feedList.innerHTML = "";

      if (snapshot.empty) {
        feedList.innerHTML = "<div class='feed-empty'>Sin registros aún...</div>";
      } else {
        snapshot.docs.forEach(doc => {
          const d = doc.data();
          const time = d.createdAt
            ? formatTime(d.createdAt.toDate())
            : (d.timestamp ? formatTime(new Date(d.timestamp)) : "—");
          appendFeedItem(d.name, d.surname, d.email, time, false);
        });
      }
      bumpActivityChart();
    } else {
      // Actualizaciones en tiempo real: solo los nuevos
      snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
          const d = change.doc.data();
          appendFeedItem(d.name, d.surname, d.email, "Ahora", true);
          bumpActivityChart();
        }
      });
    }
  });

  // Contador de hoy
  const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
  const todayQuery = query(
    collection(db, "users"),
    where("createdAt", ">=", Timestamp.fromDate(startOfDay))
  );
  onSnapshot(todayQuery, snap => {
    document.getElementById("kpiToday").textContent = snap.size;
    animateNumber(document.getElementById("kpiActive"), Math.floor(snap.size * .4));
  });
}

// ════════════════════════════════════════════════════════
//  DEMO MODE (without Firebase)
// ════════════════════════════════════════════════════════
const DEMO_NAMES = [
  ["Carlos","García"],["María","López"],["Alejandro","Martínez"],
  ["Lucía","Fernández"],["Daniel","Sánchez"],["Ana","González"],
  ["Pablo","Rodríguez"],["Laura","Pérez"],["Sergio","Jiménez"],
  ["Isabel","Navarro"],["Marcos","Ruiz"],["Elena","Torres"],
  ["Javier","Moreno"],["Claudia","Herrera"],["Andrés","Ramos"],
];
const DEMO_DOMAINS = ["gmail.com","hotmail.com","outlook.com","yahoo.es","icloud.com"];

let demoInterval;
let demoIdx = 0;
let kpiCount = 0;

function startDemoMode() {
  // Seed with existing demoUsers
  demoUsers.forEach((u, i) => {
    setTimeout(() => {
      appendFeedItem(u.name, u.surname, u.email, formatTime(new Date(u.timestamp)));
      kpiCount++;
      updateKPIs(kpiCount);
    }, i * 200);
  });

  kpiCount = demoUsers.length;

  // Simulate new signups
  demoInterval = setInterval(() => {
    const person = DEMO_NAMES[demoIdx % DEMO_NAMES.length];
    const domain = DEMO_DOMAINS[Math.floor(Math.random() * DEMO_DOMAINS.length)];
    const email  = `${person[0].toLowerCase()}.${person[1].toLowerCase()}${Math.floor(Math.random()*99)}@${domain}`;

    appendFeedItem(person[0], person[1], email, "Ahora");
    kpiCount++;
    updateKPIs(kpiCount);
    bumpActivityChart();
    demoIdx++;
  }, 3500 + Math.random() * 4000);
}

// ════════════════════════════════════════════════════════
//  FEED
// ════════════════════════════════════════════════════════
function appendFeedItem(name, surname, email, time, isNew = false) {
  const empty = feedList.querySelector(".feed-empty");
  if (empty) empty.remove();

  const initial = (name[0] || "?").toUpperCase();
  const colors  = ["#FF5500","#E04A00","#ff7733","#cc4400"];
  const color   = colors[Math.floor(Math.random() * colors.length)];

  const item = document.createElement("div");
  item.className = "feed-item" + (isNew ? " feed-item--new" : "");
  item.innerHTML = `
    <div class="feed-avatar" style="background:${color}">${initial}</div>
    <div class="feed-info">
      <div class="feed-name">${name} ${surname}</div>
      <div class="feed-email">${email}</div>
    </div>
    <div class="feed-time">${isNew ? "🟢 Ahora" : time}</div>
  `;
  feedList.prepend(item);

  const items = feedList.querySelectorAll(".feed-item");
  if (items.length > 100) items[items.length - 1].remove();
}

// ════════════════════════════════════════════════════════
//  KPIs
// ════════════════════════════════════════════════════════
function updateKPIs(total) {
  animateNumber(document.getElementById("kpiTotal"), total);
  animateNumber(document.getElementById("kpiToday"), Math.floor(total * .3));
  animateNumber(document.getElementById("kpiActive"), Math.floor(total * .12));
}

function animateNumber(el, target) {
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const diff  = target - start;
  if (diff === 0) return;
  let i = 0;
  const steps = 20;
  const t = setInterval(() => {
    i++;
    el.textContent = Math.round(start + diff * (i / steps));
    if (i >= steps) clearInterval(t);
  }, 20);
}

// ════════════════════════════════════════════════════════
//  ACTIVITY CHART (Canvas)
// ════════════════════════════════════════════════════════
function setupChart() {
  const canvas = document.getElementById("activityChart");
  if (!canvas) return;
  chartCtx = canvas.getContext("2d");
  // Seed with random data
  activityData = Array.from({length: 12}, () => Math.floor(Math.random() * 60 + 10));
  drawChart();
}

function drawChart() {
  if (!chartCtx) return;
  const canvas = chartCtx.canvas;
  const w = canvas.offsetWidth || 400;
  const h = canvas.offsetHeight || 180;
  canvas.width = w;
  canvas.height = h;

  const max = Math.max(...activityData, 1);
  const barW = (w - 40) / activityData.length;
  const padB = 24;
  chartCtx.clearRect(0, 0, w, h);

  // Grid lines
  chartCtx.strokeStyle = "rgba(255,255,255,.05)";
  chartCtx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padB + ((h - padB) - ((h - padB) * i / 4));
    chartCtx.beginPath();
    chartCtx.moveTo(20, y);
    chartCtx.lineTo(w - 20, y);
    chartCtx.stroke();
  }

  // Gradient fill
  const grad = chartCtx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(255,85,0,.35)");
  grad.addColorStop(1, "rgba(255,85,0,0)");

  chartCtx.beginPath();
  chartCtx.moveTo(20 + barW * .5, h - padB);

  activityData.forEach((val, i) => {
    const x = 20 + barW * (i + .5);
    const y = padB + (h - padB) * (1 - val / max);
    if (i === 0) chartCtx.lineTo(x, y);
    else {
      const px = 20 + barW * (i - .5);
      const py = padB + (h - padB) * (1 - activityData[i-1] / max);
      const cx = (px + x) / 2;
      chartCtx.bezierCurveTo(cx, py, cx, y, x, y);
    }
  });

  const lastX = 20 + barW * (activityData.length - .5);
  chartCtx.lineTo(lastX, h - padB);
  chartCtx.closePath();
  chartCtx.fillStyle = grad;
  chartCtx.fill();

  // Line
  chartCtx.beginPath();
  activityData.forEach((val, i) => {
    const x = 20 + barW * (i + .5);
    const y = padB + (h - padB) * (1 - val / max);
    if (i === 0) chartCtx.moveTo(x, y);
    else {
      const px = 20 + barW * (i - .5);
      const py = padB + (h - padB) * (1 - activityData[i-1] / max);
      const cx = (px + x) / 2;
      chartCtx.bezierCurveTo(cx, py, cx, y, x, y);
    }
  });
  chartCtx.strokeStyle = "#FF5500";
  chartCtx.lineWidth = 2;
  chartCtx.stroke();

  // Dots
  activityData.forEach((val, i) => {
    const x = 20 + barW * (i + .5);
    const y = padB + (h - padB) * (1 - val / max);
    chartCtx.beginPath();
    chartCtx.arc(x, y, 3, 0, Math.PI * 2);
    chartCtx.fillStyle = "#FF5500";
    chartCtx.fill();
  });

  // Time labels
  const labels = ["50m","45m","40m","35m","30m","25m","20m","15m","10m","5m","2m","Ahora"];
  chartCtx.fillStyle = "rgba(255,255,255,.3)";
  chartCtx.font = "10px 'Space Mono', monospace";
  chartCtx.textAlign = "center";
  activityData.forEach((_, i) => {
    const x = 20 + barW * (i + .5);
    chartCtx.fillText(labels[i], x, h - 6);
  });
}

function bumpActivityChart() {
  activityData.shift();
  activityData.push(activityData[activityData.length - 1] + Math.floor(Math.random() * 8 - 2));
  drawChart();
  // Animate refresh
  setInterval(drawChart, 5000);
}

// ════════════════════════════════════════════════════════
//  SPORT BARS
// ════════════════════════════════════════════════════════
const SPORTS_DATA = [
  { name: "🎾 Tenis",   pct: 88 },
  { name: "🏓 Pádel",   pct: 95 },
  { name: "⚽ Fútbol",  pct: 76 },
  { name: "🏀 Basket",  pct: 62 },
  { name: "🏐 Vóley",   pct: 44 },
];

function buildSportBars() {
  const container = document.getElementById("sportBars");
  if (!container) return;
  container.innerHTML = "";
  SPORTS_DATA.forEach(s => {
    const item = document.createElement("div");
    item.className = "sport-bar-item";
    item.innerHTML = `
      <div class="sport-bar-label">
        <span>${s.name}</span>
        <span>${s.pct}%</span>
      </div>
      <div class="sport-bar-track">
        <div class="sport-bar-fill" data-pct="${s.pct}"></div>
      </div>
    `;
    container.appendChild(item);
  });

  // Animate bars
  setTimeout(() => {
    document.querySelectorAll(".sport-bar-fill").forEach(el => {
      el.style.width = el.dataset.pct + "%";
    });
  }, 300);
}

// ════════════════════════════════════════════════════════
//  PHONE MOCKUP — Player Cards
// ════════════════════════════════════════════════════════
const MOCK_PLAYERS = [
  { name: "Carlos R.", sport: "Tenis · Niv. 7", dist: "0.4 km", emoji: "🎾", color: "#FF5500" },
  { name: "María L.",  sport: "Pádel · Niv. 5", dist: "0.9 km", emoji: "🏓", color: "#ff6a00" },
  { name: "Javier M.", sport: "Fútbol · Niv. 6", dist: "1.2 km", emoji: "⚽", color: "#0088ff" },
  { name: "Ana G.",    sport: "Basket · Niv. 4", dist: "1.8 km", emoji: "🏀", color: "#ff00aa" },
];

function buildPlayerCards() {
  const container = document.getElementById("playerCards");
  if (!container) return;
  MOCK_PLAYERS.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "player-card-mini";
    card.style.animationDelay = `${i * 0.1 + 0.5}s`;
    card.innerHTML = `
      <div class="pc-avatar" style="background:${p.color}22;border:1px solid ${p.color}44">${p.emoji}</div>
      <div class="pc-info">
        <div class="pc-name">${p.name}</div>
        <div class="pc-sport">${p.sport}</div>
      </div>
      <div class="pc-dist">${p.dist}</div>
    `;
    container.appendChild(card);
  });
}

// ════════════════════════════════════════════════════════
//  SPORTS WHEEL
// ════════════════════════════════════════════════════════
const ALL_SPORTS = [
  { emoji: "🎾", name: "Tenis" },
  { emoji: "🏓", name: "Pádel" },
  { emoji: "⚽", name: "Fútbol" },
  { emoji: "🏀", name: "Basket" },
  { emoji: "🏐", name: "Vóley" },
  { emoji: "🏸", name: "Bádminton" },
  { emoji: "🥊", name: "Boxeo" },
  { emoji: "🏊", name: "Natación" },
  { emoji: "🚴", name: "Ciclismo" },
  { emoji: "🏃", name: "Running" },
  { emoji: "🏋️", name: "CrossFit" },
  { emoji: "🤸", name: "Gimnasia" },
  { emoji: "🏇", name: "Escalada" },
  { emoji: "🎿", name: "Esquí" },
  { emoji: "🏄", name: "Surf" },
  { emoji: "🎯", name: "Tiro con arco" },
  { emoji: "🤺", name: "Esgrima" },
  { emoji: "🏑", name: "Hockey" },
  { emoji: "🏒", name: "Hockey hielo" },
  { emoji: "🥋", name: "Artes marciales" },
];

function buildSportsWheel() {
  const container = document.getElementById("sportsWheel");
  if (!container) return;
  ALL_SPORTS.forEach((s, i) => {
    const chip = document.createElement("div");
    chip.className = "sport-chip";
    chip.style.animationDelay = `${i * 0.05}s`;
    chip.innerHTML = `<span>${s.emoji}</span><span>${s.name}</span>`;
    container.appendChild(chip);
  });
}

// ════════════════════════════════════════════════════════
//  COUNTER ANIMATION (login stats)
// ════════════════════════════════════════════════════════
function animateCounters() {
  document.querySelectorAll(".stat-n").forEach(el => {
    const target = parseInt(el.dataset.target);
    let current = 0;
    const step = target / 60;
    const t = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = Math.floor(current).toLocaleString("es-ES");
      if (current >= target) clearInterval(t);
    }, 20);
  });
}

// ════════════════════════════════════════════════════════
//  NAV SCROLL
// ════════════════════════════════════════════════════════
function setupNavScroll() {
  const nav = document.getElementById("mainNav");
  if (!nav) return;
  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 40);
  });
}

// ════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════
function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function shakeModal() {
  const m = document.getElementById("loginModal");
  m.style.animation = "shake .4s";
  m.addEventListener("animationend", () => m.style.animation = "", { once: true });
}

function highlightField(id) {
  const el = document.getElementById(id);
  el.style.borderColor = "#ff4444";
  el.style.boxShadow = "0 0 0 3px rgba(255,68,68,.15)";
  setTimeout(() => {
    el.style.borderColor = "";
    el.style.boxShadow = "";
  }, 2000);
}

function showFieldErrors(name, surname, email) {
  if (!name)    highlightField("inputName");
  if (!surname) highlightField("inputSurname");
  if (!email)   highlightField("inputEmail");
}

function formatTime(date) {
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// Add shake keyframe
const style = document.createElement("style");
style.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%    {transform:translateX(-8px)}
    40%    {transform:translateX(8px)}
    60%    {transform:translateX(-5px)}
    80%    {transform:translateX(5px)}
  }
  .spin {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spinAnim .7s linear infinite;
  }
  @keyframes spinAnim { to { transform: rotate(360deg); } }
`;
document.head.appendChild(style);
