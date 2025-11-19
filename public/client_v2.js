// client_v2.js – Hog Royale overlay client

const state = {
  queue: [],
  points: {}, // { user: number }
  events: [],
};

const els = {};

function $(id) {
  return document.getElementById(id);
}

function initDomRefs() {
  els.queueList = $("queue-list");
  els.queueCount = $("queue-count");
  els.pointsList = $("points-list");
  els.eventsLog = $("events-log");
  els.giftList = $("gift-list");
  els.bannerStack = $("banner-stack");
  els.connDot = $("connection-dot");
  els.connText = $("connection-text");
}

// Util: time
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ------------------------------------------------------
// Rendering – Queue
// ------------------------------------------------------
function renderQueue() {
  const list = els.queueList;
  list.innerHTML = "";

  state.queue.forEach((entry, idx) => {
    const li = document.createElement("li");
    li.className = "queue-item";

    const pos = document.createElement("div");
    pos.className = "queue-position";
    pos.textContent = idx + 1;

    const main = document.createElement("div");
    const userSpan = document.createElement("div");
    userSpan.className = "queue-user";
    userSpan.textContent = entry.user;

    const meta = document.createElement("div");
    meta.className = "queue-meta";
    const joinedSpan = document.createElement("span");
    joinedSpan.textContent = "Joined";

    const timeSpan = document.createElement("span");
    timeSpan.textContent = formatTime(entry.joinedAt || Date.now());

    meta.appendChild(joinedSpan);
    meta.appendChild(timeSpan);

    main.appendChild(userSpan);
    main.appendChild(meta);

    li.appendChild(pos);
    li.appendChild(main);
    list.appendChild(li);
  });

  els.queueCount.textContent = `${state.queue.length} waiting`;
}

// ------------------------------------------------------
// Rendering – Points leaderboard
// ------------------------------------------------------
function renderPoints() {
  const list = els.pointsList;
  list.innerHTML = "";

  const entries = Object.entries(state.points)
    .map(([user, pts]) => ({ user, pts }))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 10);

  entries.forEach((row, i) => {
    const li = document.createElement("li");
    li.className = "points-row";

    const left = document.createElement("div");
    left.className = "points-left";

    const avatar = document.createElement("div");
    avatar.className = "hog-avatar";
    avatar.textContent = i === 0 ? "👑" : "🐷";

    const userSpan = document.createElement("div");
    userSpan.className = "points-user";
    userSpan.textContent = row.user;

    left.appendChild(avatar);
    left.appendChild(userSpan);

    const value = document.createElement("div");
    value.className = "points-value";
    value.textContent = `${row.pts} pts`;

    li.appendChild(left);
    li.appendChild(value);
    list.appendChild(li);
  });

  if (entries.length === 0) {
    const li = document.createElement("li");
    li.className = "points-row";
    li.innerHTML =
      '<div class="points-left"><div class="hog-avatar">🐷</div><div class="points-user">No hogs yet</div></div><div class="points-value">0 pts</div>';
    list.appendChild(li);
  }
}

// ------------------------------------------------------
// Rendering – Events log
// ------------------------------------------------------
function pushEventLog(entry) {
  state.events.push(entry);
  if (state.events.length > 50) state.events.shift();
  renderEvents();
}

function renderEvents() {
  const list = els.eventsLog;
  list.innerHTML = "";

  state.events.slice(-25).forEach((e) => {
    const li = document.createElement("li");
    li.className = "event-item";

    const left = document.createElement("div");
    left.className = "event-left";

    const meta = document.createElement("span");
    meta.className = "event-meta";
    meta.textContent = `[${formatTime(e.ts)}] ${e.user || "System"}`;

    const msg = document.createElement("span");
    msg.textContent = ` ${e.message}`;

    left.appendChild(meta);
    left.appendChild(msg);

    const tag = document.createElement("span");
    tag.className = "event-type-tag event-type-" + (e.type || "info");
    tag.textContent = e.type || "info";

    li.appendChild(left);
    li.appendChild(tag);
    list.appendChild(li);
  });

  list.scrollTop = list.scrollHeight;
}

// ------------------------------------------------------
// Rendering – Gift feed
// ------------------------------------------------------
function pushGiftItem(payload) {
  const list = els.giftList;

  const li = document.createElement("li");
  li.className = "gift-item";

  const main = document.createElement("div");
  main.className = "gift-main";

  const left = document.createElement("div");
  left.innerHTML = `<span class="gift-user">${payload.user}</span> sent <span class="gift-name">${payload.gift}</span>`;

  const right = document.createElement("div");
  right.className = "gift-points";
  right.textContent = `+${payload.addedPoints} pts`;

  main.appendChild(left);
  main.appendChild(right);

  const meta = document.createElement("div");
  meta.className = "gift-meta";
  meta.textContent = `Total: ${payload.totalPoints} pts • ${payload.diamonds} diamonds`;

  li.appendChild(main);
  li.appendChild(meta);

  list.appendChild(li);

  // Limit length
  while (list.children.length > 15) {
    list.removeChild(list.firstChild);
  }

  list.scrollTop = list.scrollHeight;
}

// ------------------------------------------------------
// Banners
// ------------------------------------------------------
function showBanner(kind, payload) {
  // kind: "play" | "points" | "gift"
  const stack = els.bannerStack;
  const banner = document.createElement("div");
  banner.className = "banner";

  if (kind === "play") banner.classList.add("banner-type-play");
  if (kind === "points") banner.classList.add("banner-type-points");
  if (kind === "gift") banner.classList.add("banner-type-gift");

  const left = document.createElement("div");
  left.className = "banner-left";

  const icon = document.createElement("div");
  icon.className = "banner-icon";

  if (kind === "play") icon.textContent = "🎮";
  else if (kind === "points") icon.textContent = "📊";
  else if (kind === "gift") icon.textContent = "🎁";
  else icon.textContent = "🐷";

  const textBox = document.createElement("div");

  const userSpan = document.createElement("div");
  userSpan.className = "banner-user";
  userSpan.textContent = payload.user || "Hog";

  const textSpan = document.createElement("div");
  textSpan.className = "banner-text";
  textSpan.textContent = payload.message || "";

  textBox.appendChild(userSpan);
  textBox.appendChild(textSpan);

  left.appendChild(icon);
  left.appendChild(textBox);

  banner.appendChild(left);
  stack.innerHTML = "";
  stack.appendChild(banner);

  // Auto fade out
  setTimeout(() => {
    banner.style.animation = "banner-fade-out 0.4s ease-in forwards";
    setTimeout(() => {
      if (banner.parentElement === stack) {
        stack.removeChild(banner);
      }
    }, 450);
  }, 2800);
}

// ------------------------------------------------------
// SSE connection
// ------------------------------------------------------
function setConnectionState(online) {
  if (!els.connDot || !els.connText) return;
  els.connDot.classList.toggle("online", online);
  els.connDot.classList.toggle("offline", !online);
  els.connText.textContent = online ? "Connected" : "Disconnected";
}

function handleSnapshot(payload) {
  state.queue = Array.isArray(payload.queue) ? payload.queue : [];
  state.points = payload.points || {};
  state.events = payload.recentEvents || [];

  renderQueue();
  renderPoints();
  renderEvents();
}

function handleEventMessage(msg) {
  const { type, payload } = msg;

  if (type === "snapshot") {
    handleSnapshot(payload);
    return;
  }

  if (type === "queue_join") {
    // Update queue: append if not already there
    if (!state.queue.find((p) => p.user.toLowerCase() === payload.user.toLowerCase())) {
      state.queue.push({ user: payload.user, joinedAt: Date.now() });
    }
    renderQueue();
    showBanner("play", payload);
    pushEventLog({
      ts: Date.now(),
      type: "queue_join",
      user: payload.user,
      message: payload.message,
    });
  } else if (type === "points_check") {
    state.points[payload.user] = payload.points;
    renderPoints();
    showBanner("points", payload);
    pushEventLog({
      ts: Date.now(),
      type: "points_check",
      user: payload.user,
      message: payload.message,
    });
  } else if (type === "gift") {
    state.points[payload.user] = payload.totalPoints;
    renderPoints();
    showBanner("gift", payload);
    pushGiftItem(payload);
    pushEventLog({
      ts: Date.now(),
      type: "gift",
      user: payload.user,
      message: payload.message,
    });
  } else if (type === "event_log_update") {
    if (payload.entry) {
      pushEventLog(payload.entry);
    }
  } else if (type === "events_list") {
    // Replace events for !events command
    if (Array.isArray(payload.events)) {
      state.events = payload.events;
      renderEvents();
    }
  } else if (type === "chat") {
    // Just log simple chat
    pushEventLog({
      ts: Date.now(),
      type: "chat",
      user: payload.user,
      message: payload.message,
    });
  } else if (type === "info") {
    pushEventLog({
      ts: Date.now(),
      type: "info",
      user: payload.user,
      message: payload.message,
    });
  }
}

// ------------------------------------------------------
// Init
// ------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  initDomRefs();

  const es = new EventSource("/events");

  es.onopen = () => {
    setConnectionState(true);
  };

  es.onerror = () => {
    setConnectionState(false);
  };

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleEventMessage(data);
    } catch (err) {
      console.error("Bad SSE payload", err, event.data);
    }
  };
});
