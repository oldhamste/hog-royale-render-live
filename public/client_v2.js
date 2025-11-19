// Hog Royale Overlay v2 client
// - Connects to /events (SSE) for TikTok events
// - Fetches /config for preview + gift effects
// - Shows banners for !play, !points, and gifts
// - Keeps a simple local queue + log

// ----------------------------------------------
// DOM refs
// ----------------------------------------------
const queueBannerEl = document.getElementById("queue-banner");
const queueBannerTextEl = document.getElementById("queue-banner-text");

const pointsBannerEl = document.getElementById("points-banner");
const pointsBannerTextEl = document.getElementById("points-banner-text");

const giftBannerEl = document.getElementById("gift-banner");
const giftBannerTextEl = document.getElementById("gift-banner-text");

const queueListEl = document.getElementById("queue-list");
const eventsLogEl = document.getElementById("events-log");
const configPreviewEl = document.getElementById("config-preview");

const connDotEl = document.getElementById("conn-status-dot");
const connTextEl = document.getElementById("conn-status-text");

// ----------------------------------------------
// Local state
// ----------------------------------------------
let queue = [];
let viewerPoints = {};
let giftConfig = {};
let queueBannerTimer = null;
let pointsBannerTimer = null;
let giftBannerTimer = null;

// ----------------------------------------------
// Helpers
// ----------------------------------------------
function normaliseUser(payload) {
  return (
    payload.user ||
    payload.username ||
    payload.nickname ||
    payload.uniqueId ||
    "unknown"
  );
}

function getTextOrCommand(payload) {
  return (
    payload.command ||
    payload.message ||
    payload.comment ||
    payload.text ||
    ""
  );
}

function getGiftName(payload) {
  return (
    payload.giftName ||
    payload.gift ||
    payload.giftId ||
    payload.giftType ||
    ""
  );
}

function addEventLogLine(type, user, detail) {
  const line = document.createElement("div");
  line.className = "event-line";
  line.innerHTML = `<span class="event-type">[${type}]</span> <span class="event-user">${user}</span> <span class="event-detail">→ ${detail}</span>`;
  eventsLogEl.appendChild(line);

  // keep last ~40 lines
  const max = 40;
  while (eventsLogEl.children.length > max) {
    eventsLogEl.removeChild(eventsLogEl.firstChild);
  }

  eventsLogEl.scrollTop = eventsLogEl.scrollHeight;
}

function updateQueueList() {
  queueListEl.innerHTML = "";
  queue.forEach((u, idx) => {
    const li = document.createElement("li");
    li.className = "queue-item";
    li.innerHTML = `<span class="queue-pos">#${idx + 1}</span><span class="queue-name">${u}</span>`;
    queueListEl.appendChild(li);
  });
}

function ensureViewerPoints(user) {
  if (!viewerPoints[user]) viewerPoints[user] = 0;
  return viewerPoints[user];
}

function adjustPoints(user, delta) {
  ensureViewerPoints(user);
  viewerPoints[user] += delta;
  if (viewerPoints[user] < 0) viewerPoints[user] = 0;
  return viewerPoints[user];
}

// Show/hide banners with auto-timeout
function showBanner(el, textEl, text, ms, timerRefName) {
  textEl.textContent = text;

  // clear existing timer
  if (timerRefName && window[timerRefName]) {
    clearTimeout(window[timerRefName]);
    window[timerRefName] = null;
  }

  el.classList.remove("hidden");
  el.classList.add("show");

  if (timerRefName) {
    window[timerRefName] = setTimeout(() => {
      el.classList.remove("show");
      // small delay before hiding to allow fade
      setTimeout(() => el.classList.add("hidden"), 250);
    }, ms);
  }
}

// ----------------------------------------------
// Handling specific events
// ----------------------------------------------
function handlePlayCommand(user) {
  if (!queue.includes(user)) {
    queue.push(user);
    updateQueueList();
  }
  const text = `${user.toUpperCase()} JOINED THE QUEUE`;
  showBanner(
    queueBannerEl,
    queueBannerTextEl,
    text,
    3000,
    "queueBannerTimer"
  );
}

function handlePointsCommand(user) {
  const total = ensureViewerPoints(user);
  const text = `[${user}] You have ${total} Hog Points`;
  showBanner(
    pointsBannerEl,
    pointsBannerTextEl,
    text,
    3500,
    "pointsBannerTimer"
  );
}

function handleGiftEvent(user, payload) {
  const giftName = getGiftName(payload) || "Mystery Gift";

  // Try find gift in config for nice label/points
  const key = String(giftName).toLowerCase();
  const conf = giftConfig[key] || {};
  const effect = conf.effect || conf.description || "Boost activated";
  const points = typeof conf.points === "number" ? conf.points : 5;

  const newTotal = adjustPoints(user, points);

  const text = `${giftName.toUpperCase()} → ${effect}, +${points} points (Total ${newTotal})`;
  showBanner(giftBannerEl, giftBannerTextEl, text, 4500, "giftBannerTimer");
}

// ----------------------------------------------
// Main TikTok event handler
// ----------------------------------------------
function handleTikTokPayload(payload) {
  const user = normaliseUser(payload);
  const baseType = payload.type || payload.eventType || "chat";
  const text = getTextOrCommand(payload);
  const giftName = getGiftName(payload);

  // Log what we saw
  const detail =
    baseType === "gift"
      ? `${giftName || "gift"}`
      : text || JSON.stringify(payload);
  addEventLogLine(baseType, user, detail);

  // Command detection from text / command field
  const lower = (text || "").toLowerCase();
  const cmd =
    (payload.command && String(payload.command).toLowerCase()) ||
    (lower.startsWith("!") ? lower.split(" ")[0] : "");

  if (cmd === "!play") {
    handlePlayCommand(user);
  } else if (cmd === "!points") {
    handlePointsCommand(user);
  }

  // Gift handling (either from explicit type or if we see giftName)
  if (baseType === "gift" || giftName) {
    handleGiftEvent(user, payload);
  }
}

// ----------------------------------------------
// Server-Sent Events hookup
// ----------------------------------------------
function setupEventStream() {
  const es = new EventSource("/events");

  es.addEventListener("open", () => {
    connDotEl.classList.remove("offline");
    connDotEl.classList.add("online");
    connTextEl.textContent = "Connected ✓";
  });

  es.addEventListener("error", () => {
    connDotEl.classList.remove("online");
    connDotEl.classList.add("offline");
    connTextEl.textContent = "Reconnecting…";
  });

  // Our server sends events with name "tiktok"
  es.addEventListener("tiktok", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data && data.payload) {
        handleTikTokPayload(data.payload);
      }
    } catch (err) {
      console.error("Error parsing SSE data:", err, event.data);
    }
  });
}

// ----------------------------------------------
// Config fetch
// ----------------------------------------------
async function loadConfigPreview() {
  try {
    const res = await fetch("/config");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cfg = await res.json();

    // store gift config in a simple lookup (keyed by lowercased gift name)
    if (cfg.giftPowerups && Array.isArray(cfg.giftPowerups)) {
      const map = {};
      for (const g of cfg.giftPowerups) {
        const name = (g.name || g.id || "").toLowerCase();
        if (!name) continue;
        map[name] = g;
      }
      giftConfig = map;
    }

    const preview = {
      mapsCount: cfg.maps?.maps?.length ?? 0,
      hogClassesCount: cfg.hogClasses?.classes?.length ?? 0,
      commandsCount: cfg.commandsConfig?.commands?.length ?? 0,
      giftPowerupsCount: cfg.giftPowerups?.length ?? 0,
    };

    configPreviewEl.textContent = JSON.stringify(preview, null, 2);
  } catch (err) {
    console.error("Failed to load /config:", err);
    configPreviewEl.textContent = "Failed to load config.";
  }
}

// ----------------------------------------------
// Init
// ----------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  setupEventStream();
  loadConfigPreview();
});
