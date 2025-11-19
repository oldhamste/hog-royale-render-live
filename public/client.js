// client.js
// Front-end overlay logic for Hog Royale

const socket = io();

const eventsListEl = document.getElementById('events-list');
const queueListEl = document.getElementById('queue-list');
const queueEmptyEl = document.getElementById('queue-empty');
const commandsListEl = document.getElementById('commands-list');
const mapInfoEl = document.getElementById('map-info');
const popupContainerEl = document.getElementById('popup-container');
const triggerTestBtn = document.getElementById('trigger-test');

// Keep simple client-side queue state (for display)
const queuedUsers = new Set();

// --- Load config on page load ---

async function loadConfig() {
    try {
        const res = await fetch('/config');
        const data = await res.json();

        // Commands list
        if (Array.isArray(data.commandsConfig?.commands)) {
            commandsListEl.innerHTML = '';
            data.commandsConfig.commands.forEach(cmd => {
                const li = document.createElement('li');

                const syntaxSpan = document.createElement('span');
                syntaxSpan.className = 'command-syntax';
                syntaxSpan.textContent = cmd.syntax;

                const descSpan = document.createElement('span');
                descSpan.className = 'command-desc';
                descSpan.textContent = cmd.description || '';

                li.appendChild(syntaxSpan);
                li.appendChild(descSpan);

                commandsListEl.appendChild(li);
            });
        }

        // Map info (just show current + total maps)
        if (Array.isArray(data.maps?.maps)) {
            const total = data.maps.maps.length;
            const names = data.maps.maps.map(m => m.name || m.id).join(' • ');
            mapInfoEl.textContent = `Rotation: ${total} maps – ${names}`;
        } else {
            mapInfoEl.textContent = 'No maps configured.';
        }

    } catch (err) {
        console.error('Failed to load /config', err);
        mapInfoEl.textContent = 'Error loading config.';
    }
}

loadConfig();

// --- Socket events ---

socket.on('hello', (payload) => {
    console.log('Socket hello:', payload);
});

socket.on('tiktok_event', (event) => {
    try {
        handleEvent(event);
    } catch (err) {
        console.error('Error handling tiktok_event on client:', err, event);
    }
});

// --- Event handling ---

function handleEvent(event) {
    addEventRow(event);

    if (event.kind === 'command') {
        handleCommandEvent(event);
    } else if (event.kind === 'gift') {
        handleGiftEvent(event);
    }
}

function addEventRow(event) {
    const row = document.createElement('div');
    row.className = 'event-row';

    const kindSpan = document.createElement('span');
    kindSpan.className = 'event-kind';

    if (event.kind === 'command') {
        kindSpan.classList.add('command');
        kindSpan.textContent = 'CMD';
    } else if (event.kind === 'gift') {
        kindSpan.classList.add('gift');
        kindSpan.textContent = 'GIFT';
    } else if (event.kind === 'chat') {
        kindSpan.classList.add('chat');
        kindSpan.textContent = 'CHAT';
    } else if (event.kind === 'ability') {
        kindSpan.classList.add('command');
        kindSpan.textContent = 'ABILITY';
    } else {
        kindSpan.textContent = (event.kind || 'RAW').toUpperCase();
    }

    const userSpan = document.createElement('span');
    userSpan.className = 'event-user';
    userSpan.textContent = event.user ? `${event.user}` : 'unknown';

    const msgSpan = document.createElement('span');
    msgSpan.className = 'event-message';

    // Friendly text for common events
    if (event.kind === 'command') {
        if (event.subType === 'queue_join') {
            msgSpan.textContent = event.message || `${event.user} joined the queue.`;
        } else if (event.subType === 'queue_leave') {
            msgSpan.textContent = event.message || `${event.user} left the queue.`;
        } else if (event.subType === 'points') {
            msgSpan.textContent = event.message || `${event.user} checked their points.`;
        } else if (event.subType === 'help') {
            msgSpan.textContent = event.message || `${event.user} requested help.`;
        } else if (event.subType === 'giftinfo') {
            msgSpan.textContent = event.message || `${event.user} requested gift info.`;
        } else if (event.subType === 'stats') {
            msgSpan.textContent = event.message || `${event.user} checked stats.`;
        } else if (event.subType === 'leaderboard') {
            msgSpan.textContent = event.message || `${event.user} checked leaderboard.`;
        } else if (event.subType === 'hog_set') {
            msgSpan.textContent = event.message || `${event.user} picked a hog class.`;
        } else {
            msgSpan.textContent = event.message || event.command || JSON.stringify(event);
        }
    } else if (event.kind === 'gift') {
        const base = `${event.gift || 'Gift'} → ${event.effect || ''}`.trim();
        const pointsText = (event.pointsAdded && event.pointsAdded > 0)
            ? ` +${event.pointsAdded} pts (total ${event.newTotalPoints || 0})`
            : '';
        msgSpan.textContent = base + pointsText;
    } else if (event.kind === 'ability') {
        msgSpan.textContent = event.message || `${event.user} used ${event.ability}`;
    } else if (event.kind === 'chat') {
        msgSpan.textContent = event.comment || '';
    } else {
        msgSpan.textContent = event.message || JSON.stringify(event);
    }

    row.appendChild(kindSpan);
    row.appendChild(userSpan);
    row.appendChild(msgSpan);

    eventsListEl.appendChild(row);
    eventsListEl.scrollTop = eventsListEl.scrollHeight;
}

// --- Command-specific behaviour (queue, points, info) ---

function handleCommandEvent(event) {
    const user = event.user || 'unknown';
    const subType = event.subType;

    if (subType === 'queue_join') {
        queuedUsers.add(user);
        refreshQueueUI();
        showPopup(`${user.toUpperCase()} JOINED THE QUEUE`, event.message || '', 'queue');
    }

    if (subType === 'queue_leave') {
        queuedUsers.delete(user);
        refreshQueueUI();
    }

    if (subType === 'points') {
        const pts = event.points ?? 0;
        showPopup(`[${user}] You have ${pts} Hog Points`, '', 'points');
    }

    if (event.kind === 'ability') {
        // If you route abilities as separate kind, we could also popup here.
    }

    if (subType === 'leaderboard') {
        // Optionally show leaderboard popup later.
    }
}

// --- Gift behaviour (big popup) ---

function handleGiftEvent(event) {
    const user = event.user || 'unknown';
    const gift = (event.gift || '').toUpperCase();
    const effect = event.effect || '';
    const pts = event.pointsAdded ?? 0;

    const line = `${user} – ${gift} → ${effect}${pts ? ` +${pts} pts` : ''}`;
    showPopup(line, '', 'gift');
}

// --- Queue UI ---

function refreshQueueUI() {
    queueListEl.innerHTML = '';

    if (queuedUsers.size === 0) {
        queueEmptyEl.style.display = 'block';
        return;
    }

    queueEmptyEl.style.display = 'none';

    Array.from(queuedUsers).forEach((user) => {
        const li = document.createElement('li');
        li.className = 'tag';
        li.textContent = user;
        queueListEl.appendChild(li);
    });
}

// --- Popups (top-right corner) ---

function showPopup(titleText, bodyText, type = 'generic') {
    const popup = document.createElement('div');
    popup.className = 'popup';

    if (type === 'queue') popup.classList.add('queue');
    if (type === 'points') popup.classList.add('points');
    if (type === 'gift') popup.classList.add('gift');

    const titleEl = document.createElement('div');
    titleEl.className = 'popup-title';
    titleEl.textContent =
        type === 'queue'
            ? 'QUEUE'
            : type === 'points'
            ? 'POINTS'
            : type === 'gift'
            ? 'GIFT POWER'
            : 'EVENT';

    const bodyEl = document.createElement('div');
    bodyEl.className = 'popup-body';
    bodyEl.textContent = bodyText && bodyText.trim() ? bodyText : titleText;

    // If we have both, push the strong bit into body and title stays generic
    if (bodyText && bodyText.trim()) {
        bodyEl.textContent = bodyText;
        titleEl.textContent = titleText;
    }

    popup.appendChild(titleEl);
    popup.appendChild(bodyEl);

    popupContainerEl.appendChild(popup);

    // Remove after animation
    setTimeout(() => {
        popup.remove();
    }, 4800);
}

// --- Test button ---

if (triggerTestBtn) {
    triggerTestBtn.addEventListener('click', async () => {
        try {
            await fetch('/test-event', { method: 'POST' });
        } catch (err) {
            console.error('Failed to trigger test event:', err);
        }
    });
}
