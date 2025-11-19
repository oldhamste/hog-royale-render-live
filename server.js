// server.js
// Hog Royale – backend for TikTok events + overlay

const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// --- Middleware ---
app.use(bodyParser.json());

// Serve static files from /public (so /index_v2.html, /style_v2.css, /client_v2.js all work)
app.use(express.static(path.join(__dirname, "public")));

// --- Load config JSON files ---
const maps = require("./config/maps.json");
const hogClasses = require("./config/hog_classes.json");
const commandsConfig = require("./config/commands_config.json");
const giftPowerups = require("./config/gift_powerups.json");

// Combined config endpoint used by the overlay
app.get("/config", (req, res) => {
  res.json({
    maps,
    hogClasses,
    commandsConfig,
    giftPowerups,
  });
});

// --- Root route: show the NEW overlay ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index_v2.html"));
});

// --- TikTok webhook from connector.js ---
app.post("/tiktok/event", (req, res) => {
  const event = req.body || {};
  console.log("Received /tiktok/event:", event);

  // Broadcast to all connected overlay clients
  io.emit("tiktok_event", event);

  res.json({ ok: true });
});

// --- Manual test route (used by "Trigger Test Event" button) ---
app.post("/test-event", (req, res) => {
  const demo = {
    kind: "gift",
    user: "DemoUser",
    gift: "Rose",
    effect: "Small explosion, pushback, +5 armour",
    pointsAdded: 5,
    message: "Demo test event from /test-event",
  };

  console.log("Emitting demo /test-event");
  io.emit("tiktok_event", demo);

  res.json({ ok: true });
});

// --- Socket.IO connections ---
io.on("connection", (socket) => {
  console.log("Overlay client connected:", socket.id);
  socket.emit("hello", { message: "connected to Hog Royale backend" });
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Hog Royale backend listening on port", PORT);
});
