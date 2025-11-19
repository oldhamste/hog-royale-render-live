// -----------------------------------------------------
// Hog Royale Render Live - FINAL FIXED SERVER.JS
// -----------------------------------------------------

const express = require("express");
const path = require("path");
const app = express();

// Allow JSON
app.use(express.json());

// -----------------------------------------------------
// STATIC FILES (public folder)
// -----------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

// -----------------------------------------------------
// MAIN PAGE — ALWAYS LOAD index_v2.html
// -----------------------------------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index_v2.html"));
});

// Optional: allow /v2 to load it also
app.get("/v2", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index_v2.html"));
});

// -----------------------------------------------------
// EVENT RECEIVER FOR TIKTOK CONNECTOR
// TikTok Connector POSTs here like:
// POST https://hog-royale-render-live.onrender.com/tiktok/event
// -----------------------------------------------------
app.post("/tiktok/event", (req, res) => {
  console.log("Received TikTok Event:", req.body);

  // Broadcast to client overlay using Server-Sent Events?
  // Or if your front-end fetches this event, we store it somewhere

  // For now: simple OK return to connector
  res.status(200).send({ ok: true });
});

// -----------------------------------------------------
// START SERVER
// -----------------------------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Hog Royale Render Live server running on port:", PORT);
});
