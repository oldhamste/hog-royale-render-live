const statusEl = document.getElementById('status');
const configEl = document.getElementById('config');
const eventsEl = document.getElementById('events');
const testBtn = document.getElementById('test-btn');

const socket = io();

socket.on('connect', () => {
  statusEl.textContent = 'Connected ✔';
});

socket.on('disconnect', () => {
  statusEl.textContent = 'Disconnected ✖';
});

socket.on('config', (data) => {
  configEl.textContent = JSON.stringify(data, null, 2);
});

socket.on('tiktok_event', (event) => {
  const li = document.createElement('li');
  li.innerHTML = `
    <span class="type">[${event.type || 'unknown'}]</span>
    <span class="user">${event.user || 'unknown'}</span>
    – ${event.gift || event.command || ''} ${event.effect ? '→ ' + event.effect : ''}
  `;
  eventsEl.prepend(li);
});

testBtn.addEventListener('click', async () => {
  await fetch('/test-event');
});