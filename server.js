const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

function loadJson(relPath) {
  const full = path.join(__dirname, 'config', relPath);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

const maps = loadJson('maps.json');
const hogClasses = loadJson('hog_classes.json');
const commandsConfig = loadJson('commands_config.json');
const giftPowerups = loadJson('gift_powerups.json');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'hog-royale-live' });
});

app.get('/test-event', (req, res) => {
  const demoEvent = {
    type: 'gift',
    user: 'DemoUser',
    gift: 'Rose',
    effect: 'Small explosion, pushback, +5 armour'
  };
  io.emit('tiktok_event', demoEvent);
  res.json({ sent: demoEvent });
});

app.use(express.json());
app.post('/tiktok/event', (req, res) => {
  const event = req.body || {};
  io.emit('tiktok_event', event);
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.emit('config', {
    maps,
    hogClasses,
    commandsConfig,
    giftPowerups
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Hog Royale live server running on port', PORT);
});