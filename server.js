// server.js
// Hog Royale Render Live backend with SSE overlay

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------
// Middleware
// ------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------------------------
// In-memory game / overlay state
// ------------------------------------------------------

// Queue for !play players
let queue = []; // [ { user, joinedAt } ]

// Points for each user
let points = {}; // { username: number }

// Recent event log (last 50)
let recentEvents = []; // [ { ts, type, user, message } ]

// Active SSE clients
const clients = new Set();

// Helper: add event to recent log
function logEvent(type, user, message) {
  const entry = {
    ts: Date.now(),
    type,
    user,
    message,
  };
  recentEvents.push(entry);
  if (recentEvents.length > 50) {
    recentEvents.shift();
  }
  broadcast("event_log_update", { entry });
}

// ------------------------------------------------------
// SSE helpers
// ------------------------------------------------------
function broadcast(type, payload) {
  const data = JSON.stringify({ type, payload });

  for (const res of clients) {
    res.write(`data: ${data}\n\n`);
  }
}

// SSE stream for overlay
app.get("/events", (req, res) => {
  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders?.();

  // Send initial snapshot
  const snapshot = {
    queue,
    points,
    recentEvents,
  };

  res.write(`data: ${JSON.stringify({ type: "snapshot", payload: snapshot })}\n\n`);

  // Track client
  clients.add(res);

  req.on("close", () => {
    clients.delete(res);
    res.end();
  });
});

// ------------------------------------------------------
// Overlay page
// ------------------------------------------------------

// Root serves the v2 overlay
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index_v2.html"));
});

// Simple health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", queueSize: queue.length, clients: clients.size });
});

// ------------------------------------------------------
// TikTok event ingest
// This is what your connector.js POSTs to
// ------------------------------------------------------
app.post("/tiktok/event", (req, res) => {
  const body = req.body || {};
  const { type, user, text, gift, effect, diamonds, raw } = body;

  const username = (user || "unknown").toString();
  console.log("[TIKTOK EVENT]", JSON.stringify(body));

  // Ensure points entry exists
  if (!points[username]) points[username] = 0;

  if (type === "chat") {
    handleChat(username, text || "");
  } else if (type === "gift") {
    handleGift(username, gift || "Gift", effect || "", diamonds || 0, raw);
  } else {
    // Unknown / generic event
    logEvent("info", username, body.message || "Unknown TikTok event");
    broadcast("info", { user: username, message: body.message || "Unknown TikTok event" });
  }

  res.json({ ok: true });
});

// ------------------------------------------------------
// Chat command handler
// ------------------------------------------------------
function handleChat(user, text) {
  const message = text.trim();
  const lower = message.toLowerCase();

  // Always log basic chat
  logEvent("chat", user, message);
  broadcast("chat", { user, message });

  if (!lower.startsWith("!")) return;

  if (lower.startsWith("!play")) {
    // Add to queue if not already present
    if (!queue.find((p) => p.user.toLowerCase() === user.toLowerCase())) {
      queue.push({ user, joinedAt: Date.now() });

      logEvent("queue_join", user, `${user} joined the hog war queue`);
      broadcast("queue_join", {
        user,
        queuePosition: queue.length,
        message: `${user} joined the Hog Queue (#${queue.length})`,
      });
    } else {
      broadcast("queue_join", {
        user,
        queuePosition: queue.findIndex((p) => p.user.toLowerCase() === user.toLowerCase()) + 1,
        message: `${user} is already in the queue`,
      });
    }
  } else if (lower.startsWith("!points")) {
    const current = points[user] || 0;
    const msg = `${user} has ${current} Hog Points`;

    logEvent("points_check", user, msg);
    broadcast("points_check", { user, points: current, message: msg });
  } else if (lower.startsWith("!events")) {
    // Send last 10 events just so overlay can show a "history" popup
    const last10 = recentEvents.slice(-10);
    broadcast("events_list", { user, events: last10 });
    logEvent("events_list", user, `${user} requested recent events`);
  } else {
    // You can add more commands here later
  }
}

// ------------------------------------------------------
// Gift handler
// ------------------------------------------------------
function handleGift(user, giftName, effect, diamonds, raw) {
  // Simple points: diamond count * 5
  const value = Number.isFinite(diamonds) ? diamonds : 1;
  const addedPoints = value * 5;

  points[user] = (points[user] || 0) + addedPoints;

  const msg = `${user} sent ${giftName} (+${addedPoints} Hog Points)`;
  logEvent("gift", user, msg);

  broadcast("gift", {
    user,
    gift: giftName,
    effect,
    diamonds: value,
    addedPoints,
    totalPoints: points[user],
    message: msg,
  });
}

// ------------------------------------------------------
// Start server
// ------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Hog Royale Render Live listening on port ${PORT}`);
});
