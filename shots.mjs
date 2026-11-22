// Dev-only screenshot driver for Ember Clash (not part of the shipped game).
// It talks to the game already served by `node serve.ts` and drives headless
// Chrome over its debugging protocol with Node's built-in WebSocket. For every
// entry of shots.json it opens the page, waits until the game signals
// window.__shotReady (the shot scene sets it after two rendered frames), then
// captures a 1280x720 JPEG into screenshots/. Any console error fails the run.
//
//   1. node serve.ts --port 8080          (in one shell)
//   2. /opt/meta-chromium/chrome --headless=new --remote-debugging-port=9222 \
//        --no-sandbox --disable-gpu --window-size=1280,720 about:blank   (another shell)
//   3. node shots.mjs [port]               (default port 8080)
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.argv[2] ?? 8080);
const shotList = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (event) => reject(new Error(`websocket error: ${event.message ?? 'unknown'}`)));
  });
}

async function main() {
  mkdirSync(join(here, 'screenshots'), { recursive: true });
  const targets = await fetchJson('http://127.0.0.1:9222/json/list');
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target on the debugging port 9222 — is headless Chrome running?');
  const ws = await openSocket(page.webSocketDebuggerUrl);

  let nextId = 0;
  const waiting = new Map();
  const pageErrors = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id !== undefined && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      pageErrors.push(`EXCEPTION ${d.text} ${d.exception?.description ?? ''}`);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push(`CONSOLE ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    }
  });

  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  // Page.loadEventFired tells us the new document has committed; without it a
  // readiness poll can still answer from the previous shot's page, whose
  // __shotReady is already true, and capture the wrong screen.
  let pageLoaded = false;
  const loadWaiters = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Page.loadEventFired') {
      pageLoaded = true;
      while (loadWaiters.length) loadWaiters.shift()();
    }
  });
  const waitForLoad = () => new Promise((resolve) => {
    if (pageLoaded) resolve();
    else loadWaiters.push(resolve);
  });

  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  for (const shot of shotList) {
    pageErrors.length = 0;
    pageLoaded = false;
    await call('Page.navigate', { url: `http://localhost:${port}/index.html${shot.query}` });
    await waitForLoad();
    let ready = false;
    for (let i = 0; i < 120 && !ready; i += 1) {
      await sleep(250);
      const result = await call('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
      ready = result.result?.value === true;
    }
    if (!ready) throw new Error(`shot ${shot.name}: the game never signalled ready`);
    const captured = await call('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    const outPath = join(here, 'screenshots', shot.name);
    writeFileSync(outPath, Buffer.from(captured.data, 'base64'));
    const size = statSync(outPath).size;
    console.log(`${shot.name}: ${size} bytes${pageErrors.length ? ` | ERRORS: ${pageErrors.join(' ; ')}` : ''}`);
    if (pageErrors.length) throw new Error(`shot ${shot.name} had page errors`);
    if (size > 262144) throw new Error(`shot ${shot.name} is over the 256 KiB screenshot cap`);
  }
  ws.close();
  console.log('all screenshots taken');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
