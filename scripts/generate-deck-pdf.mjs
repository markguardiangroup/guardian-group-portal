import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { writeFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const CHROMIUM = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
const OUTPUT = '/home/runner/workspace/guardian-group-deck.pdf';
const URL = 'http://localhost:5000/portal-deck?exportKey=GUARDIAN_EXPORT_2026';

console.log('Launching Chromium…');
const browser = spawn(CHROMIUM, [
  '--headless',
  '--no-sandbox',
  '--disable-gpu',
  '--remote-debugging-port=9223',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--font-render-hinting=none',
  '--disable-web-security',
], { stdio: 'ignore' });

browser.on('error', (e) => { console.error('Browser error:', e); process.exit(1); });

// Wait for Chromium to start
await sleep(2500);

// Open a new tab and get its WS URL
let wsUrl;
for (let i = 0; i < 10; i++) {
  try {
    const r = await fetch('http://localhost:9223/json/new');
    const t = await r.json();
    wsUrl = t.webSocketDebuggerUrl;
    break;
  } catch {
    await sleep(500);
  }
}
if (!wsUrl) { console.error('Could not get WS URL'); browser.kill(); process.exit(1); }

console.log('Connecting to CDP…');
const ws = new WebSocket(wsUrl);
let msgId = 1;
const pending = new Map();
const events = new Map();

ws.on('message', (raw) => {
  const msg = JSON.parse(raw);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
  if (msg.method) {
    const handlers = events.get(msg.method) || [];
    handlers.forEach(h => h(msg.params));
  }
});

await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function once(event) {
  return new Promise(resolve => {
    const handlers = events.get(event) || [];
    events.set(event, [...handlers, resolve]);
  });
}

console.log('Enabling Page domain…');
await send('Page.enable');
await send('Runtime.enable');

console.log('Navigating to deck…');
const loadPromise = once('Page.loadEventFired');
await send('Page.navigate', { url: URL });
await Promise.race([loadPromise, sleep(15000)]);

// Wait for React to fully render — poll until the deck container exists
console.log('Waiting for React render…');
for (let i = 0; i < 20; i++) {
  await sleep(500);
  try {
    const r = await send('Runtime.evaluate', {
      expression: `document.querySelector('[data-testid="investor-deck"]') !== null`,
    });
    if (r.result.value === true) {
      console.log('React rendered after', (i + 1) * 500, 'ms');
      break;
    }
  } catch { /* keep polling */ }
}

// Extra settle time for fonts / SVGs / emoji
await sleep(2000);

console.log('Printing to PDF…');
const pdf = await send('Page.printToPDF', {
  landscape: true,
  printBackground: true,
  paperWidth: 11.69,   // A4 landscape inches
  paperHeight: 8.27,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  preferCSSPageSize: false,
});

const buf = Buffer.from(pdf.data, 'base64');
writeFileSync(OUTPUT, buf);
console.log(`✓ PDF saved — ${buf.length} bytes`);

ws.close();
browser.kill();
process.exit(0);
