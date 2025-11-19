// client_v2.js
// Front-end overlay logic for Hog Royale

const socket = io();

const eventsListEl = document.getElementById('events-list');
const queueListEl = document.getElementById('queue-list');
const queueEmptyEl = document.getElementById('queue-empty');
const commandsListEl = document.getElementById('commands-list');
const mapInfoEl = document.getElementById('map-info');
const popupContainerEl = document.getElementById('popup-container');
const triggerTestBtn = document.getElementById('trigger-test');

const queuedUsers = new Set();

// Load config on startup
async function loadConfig() {
    try {
        const res = await fetch('/config');
        const data = await res.json();

        // Commands
        commandsListEl.innerHTML = "";
        if (data.commandsConfig?.commands) {
            data.commandsConfig.commands.forEach(cmd => {
                const li = document.createElement('li');

                const syntax = document.createElement('span');
                syntax.className = "command-syntax";
                syntax.textContent = cmd.syntax;

                const desc = document.createElement('span');
                desc.textContent = cmd.description || "";

                li.appendChild(syntax);
                li.appendChild(desc);
                commandsListEl.appendChild(li);
            });
        }

        // Maps
        if (data.maps?.maps) {
            const names = data.maps.maps.map(m => m.name).join(" • ");
            mapInfoEl.textContent = `${data.maps.maps.length} maps: ${names}`;
        }

    } catch {
        mapInfoEl.textContent = "Error loading config";
    }
}

loadConfig();

socket.on('tiktok_event', (event) => {
    addEventRow(event);

    if (event.kind === "command") handleCommand(event);
    if (event.kind === "gift") handleGift(event);
});

function addEventRow(event) {
    const row = document.createElement('div');
    row.className = 'event-row';

    const kind = document.createElement('span');
    kind.className = 'event-kind ' + event.kind;
    kind.textContent = event.kind.toUpperCase();

    const user = document.createElement('span');
    user.className = 'event-user';
    user.textContent = event.user || "unknown";

    const msg = document.createElement('span');
    msg.className = 'event-message';
    msg.textContent = event.message || event.comment || JSON.stringify(event);

    row.appendChild(kind);
    row.appendChild(user);
    row.appendChild(msg);

    eventsListEl.appendChild(row);
    eventsListEl.scrollTop = eventsListEl.scrollHeight;
}

function handleCommand(event) {
    const user = event.user;

    if (event.subType === "queue_join") {
        queuedUsers.add(user);
        refreshQueue();
        popup(`${user} JOINED THE QUEUE`, "queue");
    }

    if (event.subType === "queue_leave") {
        queuedUsers.delete(user);
        refreshQueue();
    }

    if (event.subType === "points") {
        popup(`[${user}] You have ${event.points} Hog Points`, "points");
    }
}

function handleGift(event) {
    popup(`${event.user} → ${event.gift.toUpperCase()} (+${event.pointsAdded} pts)`, "gift");
}

function refreshQueue() {
    queueListEl.innerHTML = "";

    if (queuedUsers.size === 0) {
        queueEmptyEl.style.display = "block";
        return;
    }

    queueEmptyEl.style.display = "none";

    for (let user of queuedUsers) {
        const li = document.createElement('li');
        li.className = "tag";
        li.textContent = user;
        queueListEl.appendChild(li);
    }
}

// Popup function
function popup(text, type) {
    const box = document.createElement('div');
    box.className = `popup ${type}`;

    const title = document.createElement('div');
    title.className = "popup-title";
    title.textContent =
        type === "queue" ? "QUEUE" :
        type === "points" ? "POINTS" :
        type === "gift" ? "GIFT POWER" :
        "EVENT";

    const body = document.createElement('div');
    body.className = "popup-body";
    body.textContent = text;

    box.appendChild(title);
    box.appendChild(body);
    popupContainerEl.appendChild(box);

    setTimeout(() => box.remove(), 4500);
}

// Trigger test event
if (triggerTestBtn) {
    triggerTestBtn.onclick = () => {
        fetch("/test-event", { method: "POST" });
    };
}
