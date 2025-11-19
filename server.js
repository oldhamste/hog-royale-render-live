// -----------------------------------------------------
// Hog Royale Render Live - FINAL SERVER.JS
// - Serves index_v2.html as main overlay
// - Serves static files from /public
// - Exposes /config for front-end
// - Receives TikTok events at /tiktok/event
// - Broadcasts events to overlay via Server-Sent Events (/events)
// -----------------------------------------------------

const express = require("express");
const path = require("path");
const http = require("http");

const app = express();
const server = http.createServer(app);

// Allow JSON body parsing
app.use(express.json());

// -----------------------------------------------------
// STATIC FILES (CSS, JS, images, etc.)
// -----------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

// -----------------------------------------------------
// MAIN PAGE – always serve the v2 overlay
// -----------------------------------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index_v2.html"));
});

// Optional shortcut: /v2 also loads the overlay
app.get("/v2", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index_v2.html"));
});

// -----------------------------------------------------
// CONFIG ENDPOINT – send all JSON config to the overlay
// GET /config
// -----------------------------------------------------
app.get("/config", (req, res) => {
  try {
    const maps = require("./config/maps.json");
    const hogClasses = require("./config/hog_classes.json");
    const commandsConfig = require("./config/commands_config.json");
    const giftPowerups = require("./config/gift_powerups.json");

    res.json({
      maps,
      hogClasses,
      commandsConfig,
      giftPowerups,
    });
  } catch (err) {
    console.error("Error loading config:", err);
    res.status(500).json({ error: "CONFIG_LOAD_FAILED" });
  }
});

// -----------------------------------------------------
// SERVER-SENT EVENTS (/events)
// Overlay connects with:
//   const es = new EventSource('/events');
// -----------------------------------------------------
const sseClients = new Set();

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // initial retry setting
  res.write("retry: 2000\n\n");

  sseClients.add(res);
  console.log("Overlay connected to /events. Total:", sseClients.size);

  req.on("close", () => {
    sseClients.delete(res);
    console.log("Overlay disconnected. Total:", sseClients.size);
  });
});

function broadcastEvent(eventType, payload) {
  const data = JSON.stringify({
    type: eventType,
    payload,
    ts: Date.now(),
  });

  for (const client of sseClients) {
    client.write(`event: ${eventType}\n`);
    client.write(`data: ${data}\n\n`);
  }
}

// -----------------------------------------------------
// TIKTOK CONNECTOR ENDPOINT
// Your local connector does:
//   POST https://hog-royale-render-live.onrender.com/tiktok/event
// with JSON: { type, user, command, message, ... }
// -----------------------------------------------------
app.post("/tiktok/event", (req, res) => {
  const event = req.body || {};
  console.log("Received TikTok event:", JSON.stringify(event));

  // push to all connected overlays
  broadcastEvent("tiktok", event);

  res.status(200).json({ ok: true });
});

// -----------------------------------------------------
// SIMPLE HEALTH CHECK (optional)
// -----------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// -----------------------------------------------------
// START SERVER
// -----------------------------------------------------
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Hog Royale Render Live server running on port", PORT);
});
