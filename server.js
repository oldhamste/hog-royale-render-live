// server.js
// Hog Royale – TikTok event hub for Render

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ---------- CONFIG LOAD ----------

function loadJson(relPath) {
    const full = path.join(__dirname, relPath);
    return JSON.parse(fs.readFileSync(full, 'utf8'));
}

const mapsConfig         = loadJson('config/maps.json');
const hogClassesConfig   = loadJson('config/hog_classes.json');
const commandsConfig     = loadJson('config/commands_config.json');
const giftPowerupsConfig = loadJson('config/gift_powerups.json');

// ---------- STATE ----------

// simple in-memory player state (good enough for now)
const players = new Map(); // username -> PlayerState
const queue   = [];        // usernames waiting for next match

// you can expand this later for full match logic
let gameState = {
    matchNumber: 1,
    currentMapId: mapsConfig?.maps?.[0]?.id || 'map1',
    rotationSeconds: 600 // 10 min, not actively used yet
};

function getOrCreatePlayer(username) {
    if (!players.has(username)) {
        players.set(username, {
            name: username,
            points: 0,
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            hogClass: null,
            boostsUsed: 0,
            explosionsUsed: 0
        });
    }
    return players.get(username);
}

// ---------- EXPRESS SETUP ----------

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// health
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'hog-royale-render-live',
        players: players.size,
        queue: queue.length,
        matchNumber: gameState.matchNumber,
        currentMapId: gameState.currentMapId
    });
});

// send config to the browser dashboard
app.get('/config', (req, res) => {
    res.json({
        maps: mapsConfig,
        hogClasses: hogClassesConfig,
        commandsConfig,
        giftPowerups: giftPowerupsConfig
    });
});

// TikTok events from connector.js land here
app.post('/tiktok/event', (req, res) => {
    const payload = req.body || {};
    try {
        handleTikTokPayload(payload);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error handling /tiktok/event', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// Manual test event (used by "Trigger Test Event" button)
app.post('/test-event', (req, res) => {
    const event = {
        kind: 'gift',
        user: 'DemoUser',
        gift: 'Rose',
        effect: 'Small explosion, pushback, +5 armour',
        pointsAdded: 5,
        newTotalPoints: 5,
        tag: 'small_explosion',
        source: 'test-button'
    };
    broadcastEvent(event);
    res.json({ ok: true });
});

// ---------- SOCKET.IO ----------

io.on('connection', (socket) => {
    console.log('Dashboard connected:', socket.id);
    socket.emit('hello', {
        message: 'Connected to Hog Royale event hub',
        matchNumber: gameState.matchNumber,
        currentMapId: gameState.currentMapId
    });
});

// Helper: emit to all dashboards
function broadcastEvent(event) {
    io.emit('tiktok_event', event);
}

// ---------- TIKTOK PAYLOAD HANDLING ----------

function handleTikTokPayload(payload) {
    const type = payload.type;

    if (type === 'chat') {
        handleChat(payload);
    } else if (type === 'command') {
        handleCommand(payload);
    } else if (type === 'gift') {
        handleGift(payload);
    } else {
        // Unknown – just forward raw
        broadcastEvent({
            kind: 'raw',
            raw: payload
        });
    }
}

// ---------- CHAT (NON-COMMAND) ----------

function handleChat(payload) {
    const user = payload.user || 'unknown';
    const comment = payload.comment || '';

    const event = {
        kind: 'chat',
        user,
        comment
    };

    broadcastEvent(event);
}

// ---------- COMMANDS ----------

function handleCommand(payload) {
    const user = payload.user || 'unknown';
    const cmdFull = payload.command || '';
    const args = payload.args || [];

    const cmd = cmdFull.replace(/^!/, '').toLowerCase(); // "!play" -> "play"

    const player = getOrCreatePlayer(user);

    // ----- queue join -----
    if (['play', 'join', 'queue'].includes(cmd)) {
        if (!queue.includes(user)) {
            queue.push(user);
        }
        const event = {
            kind: 'command',
            subType: 'queue_join',
            user,
            command: cmdFull,
            message: `${user} joined the next Hog Royale match. Queue size: ${queue.length}`,
            queueSize: queue.length,
            points: player.points
        };
        broadcastEvent(event);
        return;
    }

    // ----- queue leave -----
    if (['leave', 'quit', 'l'].includes(cmd)) {
        const index = queue.indexOf(user);
        if (index !== -1) {
            queue.splice(index, 1);
        }
        const event = {
            kind: 'command',
            subType: 'queue_leave',
            user,
            command: cmdFull,
            message: `${user} left the queue. Queue size: ${queue.length}`,
            queueSize: queue.length
        };
        broadcastEvent(event);
        return;
    }

    // ----- points -----
    if (['points', 'score', 'p'].includes(cmd)) {
        const event = {
            kind: 'command',
            subType: 'points',
            user,
            command: cmdFull,
            message: `${user} has ${player.points} Hog Points.`,
            points: player.points
        };
        broadcastEvent(event);
        return;
    }

    // ----- boost ability -----
    if (cmd === 'boost') {
        player.boostsUsed += 1;
        const event = {
            kind: 'ability',
            ability: 'boost',
            user,
            command: cmdFull,
            message: `${user} triggered a speed boost!`,
            points: player.points
        };
        broadcastEvent(event);
        return;
    }

    // ----- explosion ability -----
    if (['explode', 'boom'].includes(cmd)) {
        player.explosionsUsed += 1;
        const event = {
            kind: 'ability',
            ability: 'explode',
            user,
            command: cmdFull,
            message: `${user} triggered an explosion!`,
            points: player.points
        };
        broadcastEvent(event);
        return;
    }

    // ----- show hog class -----
    if (['hog', 'class'].includes(cmd)) {
        const clazz = player.hogClass || 'none';
        const event = {
            kind: 'command',
            subType: 'hog_info',
            user,
            command: cmdFull,
            message: `${user} is currently using hog class: ${clazz}.`,
            hogClass: clazz
        };
        broadcastEvent(event);
        return;
    }

    // ----- set hog class -----
    if (['sethog', 'pickhog'].includes(cmd)) {
        const requested = (args[0] || '').toLowerCase();
        if (!requested) {
            const event = {
                kind: 'command',
                subType: 'hog_set_fail',
                user,
                command: cmdFull,
                message: `${user}, you need to specify a hog class. Example: !sethog tank`
            };
            broadcastEvent(event);
            return;
        }

        const availableClasses = (hogClassesConfig?.classes || []).map(c => c.id.toLowerCase());
        const match = availableClasses.find(c => c === requested);

        if (!match) {
            const event = {
                kind: 'command',
                subType: 'hog_set_fail',
                user,
                command: cmdFull,
                message: `${user}, "${requested}" is not a valid hog class.`,
                availableClasses
            };
            broadcastEvent(event);
            return;
        }

        player.hogClass = match;

        const event = {
            kind: 'command',
            subType: 'hog_set',
            user,
            command: cmdFull,
            message: `${user} switched to hog class: ${match}.`,
            hogClass: match
        };
        broadcastEvent(event);
        return;
    }

    // ----- help / commands -----
    if (['help', 'commands'].includes(cmd)) {
        const cmds = (commandsConfig.commands || []).map(c => c.syntax);
        const event = {
            kind: 'command',
            subType: 'help',
            user,
            command: cmdFull,
            message: 'Available commands: ' + cmds.join(', '),
            commands: cmds
        };
        broadcastEvent(event);
        return;
    }

    // ----- gift info -----
    if (['giftinfo', 'gifts'].includes(cmd)) {
        const gifts = Object.keys(giftPowerupsConfig || {}).filter(k => k !== 'default');
        const info = gifts.map(name => {
            const g = giftPowerupsConfig[name];
            return `${name}: ${g.effectText} (+${g.points} pts)`;
        });
        const event = {
            kind: 'command',
            subType: 'giftinfo',
            user,
            command: cmdFull,
            message: 'Gift powers: ' + info.join(' | '),
            gifts: info
        };
        broadcastEvent(event);
        return;
    }

    // ----- stats -----
    if (['stats', 'profile'].includes(cmd)) {
        const event = {
            kind: 'command',
            subType: 'stats',
            user,
            command: cmdFull,
            message: `${user}'s stats – Points: ${player.points}, Games: ${player.gamesPlayed}, Wins: ${player.wins}, Losses: ${player.losses}`,
            stats: {
                points: player.points,
                gamesPlayed: player.gamesPlayed,
                wins: player.wins,
                losses: player.losses,
                hogClass: player.hogClass,
                boostsUsed: player.boostsUsed,
                explosionsUsed: player.explosionsUsed
            }
        };
        broadcastEvent(event);
        return;
    }

    // ----- leaderboard -----
    if (['top', 'leaderboard'].includes(cmd)) {
        const sorted = Array.from(players.values())
            .sort((a, b) => b.points - a.points)
            .slice(0, 5);

        const leaderboard = sorted.map((p, idx) => `${idx + 1}. ${p.name} – ${p.points} pts`);

        const event = {
            kind: 'command',
            subType: 'leaderboard',
            user,
            command: cmdFull,
            message: 'Top players:\n' + (leaderboard[0] ? leaderboard.join(' | ') : 'No players yet.'),
            leaderboard
        };
        broadcastEvent(event);
        return;
    }

    // ----- unknown command -----
    const event = {
        kind: 'command',
        subType: 'unknown',
        user,
        command: cmdFull,
        message: `${user} used unknown command: ${cmdFull}`
    };
    broadcastEvent(event);
}

// ---------- GIFTS ----------

function handleGift(payload) {
    const user = payload.user || 'unknown';
    const giftNameRaw = payload.gift || 'unknown_gift';

    // Normalise name (Rose / rose / ROSE)
    const giftKey = Object.keys(giftPowerupsConfig).find(
        k => k.toLowerCase() === giftNameRaw.toLowerCase()
    ) || 'default';

    const giftDef = giftPowerupsConfig[giftKey] || giftPowerupsConfig['default'] || {
        effectText: 'Mysterious power surge',
        points: 5,
        tag: 'generic'
    };

    const player = getOrCreatePlayer(user);
    player.points += giftDef.points || 0;

    const event = {
        kind: 'gift',
        user,
        gift: giftKey,
        effect: giftDef.effectText,
        pointsAdded: giftDef.points || 0,
        newTotalPoints: player.points,
        tag: giftDef.tag || 'generic'
    };

    broadcastEvent(event);
}

// ---------- START SERVER ----------

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Hog Royale Render live on port ${PORT}`);
});
