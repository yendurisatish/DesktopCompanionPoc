// Desktop shell: transparent click-through overlay, tray, idle detection, and a localhost command API.
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, powerMonitor, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Run from source, settings and character clips live in this folder. A packaged app can't write
// inside itself, so it keeps them in the user's app-data folder (seeded with the bundled defaults).
const DATA_DIR = app.isPackaged ? app.getPath('userData') : __dirname;
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const CHARACTER_DIR = path.resolve(
  process.env.COMPANION_CHARACTER_DIR || (app.isPackaged ? path.join(DATA_DIR, 'character') : path.join(__dirname, 'assets', 'character')),
);
const SELFTEST = process.argv.includes('--selftest');

const DEFAULT_CONFIG = {
  userName: 'friend',
  hydration: { firstReminderMinutes: 1, intervalMinutes: 45, snoozeMinutes: 10, unansweredSnoozeSeconds: 90 },
  walk: { speed: 90, minPauseSeconds: 4, maxPauseSeconds: 14 },
  character: { builtin: 'cat', height: 150 },
  presence: 'reminders',
  autoSleepAfterIdleMinutes: 10,
  apiPort: 47811,
};

// Commands the renderer accepts from the tray and the HTTP API.
const API_COMMANDS = new Set(['setPosition', 'playMotion', 'setExpression', 'say', 'walkTo', 'hydrate', 'summon', 'sleep', 'wake']);

let config = DEFAULT_CONFIG;
let win = null;
let tray = null;
let visible = true; // user's Show/Hide choice
let present = false; // whether the character is currently on screen (renderer decides)
let currentDisplayId = null; // display the overlay window covers
let sleeping = false;
let autoSlept = false;

function ensureDataDir() {
  if (!app.isPackaged) return;
  fs.mkdirSync(CHARACTER_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) fs.copyFileSync(path.join(__dirname, 'config.json'), CONFIG_PATH);
  const example = path.join(CHARACTER_DIR, 'manifest.example.json');
  if (!fs.existsSync(example)) fs.copyFileSync(path.join(__dirname, 'assets', 'character', 'manifest.example.json'), example);
}

function saveConfigValue(key, value) {
  config[key] = value;
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    raw[key] = value;
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(raw, null, 2)}
`);
  } catch (err) {
    console.warn(`Could not save ${key} to config.json: ${err.message}`);
  }
}

function loadConfig() {
  try {
    const user = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const merged = { ...DEFAULT_CONFIG, ...user };
    for (const section of ['hydration', 'walk', 'character']) {
      merged[section] = { ...DEFAULT_CONFIG[section], ...user[section] };
    }
    return merged;
  } catch (err) {
    console.warn(`config.json unreadable, using defaults: ${err.message}`);
    return DEFAULT_CONFIG;
  }
}

function loadCharacterManifest() {
  const manifestPath = path.join(CHARACTER_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest.clips || !manifest.clips.idle) throw new Error('manifest needs at least an "idle" clip');
    return manifest;
  } catch (err) {
    console.warn(`Ignoring character manifest, using placeholder: ${err.message}`);
    return null;
  }
}

function resolveCharacterFile(name) {
  const full = path.resolve(CHARACTER_DIR, String(name));
  if (!full.startsWith(CHARACTER_DIR + path.sep)) throw new Error(`"${name}" is outside the character folder`);
  return full;
}

function sendCommand(cmd, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send('command', { cmd, args });
}

function createWindow() {
  const display = activeDisplay();
  currentDisplayId = display.id;
  const { workArea } = display;
  win = new BrowserWindow({
    ...workArea,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  });
  // Clicks pass through to the desktop until the renderer reports the pointer is over the character.
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.on('console-message', ({ level, message }) => {
    if (SELFTEST || level === 'warning' || level === 'error') console.log(`[renderer] ${message}`);
  });

  // Keep covering the same display when displays change (or the primary one if ours was unplugged).
  const fitToWorkArea = () => {
    const display = screen.getAllDisplays().find((d) => d.id === currentDisplayId) || screen.getPrimaryDisplay();
    moveToDisplay(display);
  };
  screen.on('display-metrics-changed', fitToWorkArea);
  screen.on('display-added', fitToWorkArea);
  screen.on('display-removed', fitToWorkArea);
}

// ---------- Multi-monitor ----------
// The overlay covers one display at a time: the one holding the window the user is working in
// (the foreground window). Falls back to the mouse pointer when that can't be determined.

let activeDisplayOverride = null; // set by the self-test
let foregroundWindowCenter = null; // () => DIP point | 'ours' | null; Windows only

// Two read-only user32 calls via koffi (an FFI library): which window has focus, and where it is.
function initForegroundWindowLookup() {
  if (process.platform !== 'win32') return;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
    const GetForegroundWindow = user32.func('void *GetForegroundWindow()');
    const GetWindowRect = user32.func('bool GetWindowRect(void *hWnd, _Out_ RECT *rect)');
    const IsIconic = user32.func('bool IsIconic(void *hWnd)');
    const GetWindowThreadProcessId = user32.func('uint32 GetWindowThreadProcessId(void *hWnd, _Out_ uint32 *pid)');
    foregroundWindowCenter = () => {
      const hwnd = GetForegroundWindow();
      if (!hwnd || IsIconic(hwnd)) return null;
      const pid = [0];
      GetWindowThreadProcessId(hwnd, pid);
      if (pid[0] === process.pid) return 'ours'; // the cat itself, or its tray menu
      const r = {};
      if (!GetWindowRect(hwnd, r)) return null;
      const center = screen.screenToDipPoint({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });
      // The desktop background spans every display; it says nothing about which one is in use.
      const area = screen.getDisplayNearestPoint(center).bounds;
      if (r.right - r.left > area.width * 1.5 * screen.getDisplayNearestPoint(center).scaleFactor) return null;
      return center;
    };
  } catch (err) {
    console.warn(`Active-window lookup unavailable, following the mouse instead: ${err.message}`);
  }
}

function activeDisplay() {
  if (activeDisplayOverride) return activeDisplayOverride;
  const center = foregroundWindowCenter && foregroundWindowCenter();
  if (center === 'ours') {
    const current = screen.getAllDisplays().find((d) => d.id === currentDisplayId);
    if (current) return current;
  }
  return screen.getDisplayNearestPoint(center && center !== 'ours' ? center : screen.getCursorScreenPoint());
}

function moveToDisplay(display) {
  if (!win || win.isDestroyed()) return;
  currentDisplayId = display.id;
  // Moving between displays with different scaling can land slightly off; a second setBounds settles it.
  for (let i = 0; i < 2; i++) {
    const b = win.getBounds();
    const w = display.workArea;
    if (b.x === w.x && b.y === w.y && b.width === w.width && b.height === w.height) break;
    win.setBounds(w);
  }
}

// "Call it over": come to the display the user is on, even if already showing on another one.
function summon() {
  if (present && activeDisplay().id !== currentDisplayId) sendCommand('relocate');
  else sendCommand('summon');
}

// When the user has been working on another display for a few seconds, ask the renderer to walk the
// character over there (it walks off this screen and enters on the other).
function startDisplayFollower() {
  let strikes = 0;
  setInterval(() => {
    if (!present || !visible || activeDisplay().id === currentDisplayId) {
      strikes = 0;
      return;
    }
    strikes++;
    if (strikes % 10 === 3) sendCommand('relocate');
  }, 1000);
}

function loginItemOptions() {
  // In development the login item has to launch electron.exe with this folder as the app.
  if (!app.isPackaged) return { path: process.execPath, args: [__dirname] };
  // The portable build runs from a temp copy; point the login item at the real .exe.
  return process.env.PORTABLE_EXECUTABLE_FILE ? { path: process.env.PORTABLE_EXECUTABLE_FILE } : {};
}

// The window is only shown while the character is on screen and the user hasn't hidden it.
function applyWindowVisibility() {
  if (!win || win.isDestroyed()) return;
  if (visible && present) win.showInactive();
  else win.hide();
}

function toggleVisible() {
  visible = !visible;
  applyWindowVisibility();
  sendCommand('visibility', visible);
  rebuildTrayMenu();
}

function rebuildTrayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Call it over now', click: summon },
    {
      label: 'Only show up for reminders',
      type: 'checkbox',
      checked: config.presence !== 'always',
      click: (item) => {
        const value = item.checked ? 'reminders' : 'always';
        saveConfigValue('presence', value);
        sendCommand('setPresence', value);
      },
    },
    { label: visible ? 'Hide (hold reminders)' : 'Show', click: toggleVisible },
    { label: 'Sleep', type: 'checkbox', checked: sleeping, click: (item) => sendCommand(item.checked ? 'sleep' : 'wake') },
    { label: 'Remind me to drink water now', click: () => sendCommand('hydrate') },
    { type: 'separator' },
    { label: 'Open settings (config.json)', click: () => shell.openPath(CONFIG_PATH) },
    { label: 'Open character folder', click: () => shell.openPath(CHARACTER_DIR) },
    { label: 'Reload character && settings', click: () => win.reload() },
    {
      label: 'Launch at startup',
      type: 'checkbox',
      checked: app.getLoginItemSettings(loginItemOptions()).openAtLogin,
      click: (item) => app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png')));
  tray.setToolTip('Desktop Companion');
  tray.on('click', summon);
  rebuildTrayMenu();
}

// Sleep after the user has been away for a while; wake when they come back (only if we put it to sleep).
function startIdleMonitor() {
  setInterval(() => {
    const limitSeconds = config.autoSleepAfterIdleMinutes * 60;
    if (!limitSeconds) return;
    const idle = powerMonitor.getSystemIdleTime();
    if (!sleeping && idle >= limitSeconds) {
      autoSlept = true;
      sendCommand('sleep');
    } else if (autoSlept && sleeping && idle < 5) {
      sendCommand('wake');
    }
  }, 5000);
}

// Local API so other processes (a future agent service, scripts, curl) can drive the avatar.
// Screen coordinates are converted to overlay coordinates here.
function startApi(port) {
  const server = http.createServer((req, res) => {
    const reply = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.headers.origin) return reply(403, { error: 'browser requests are not allowed' });
    if (req.method === 'GET' && req.url === '/health') return reply(200, { ok: true });
    if (req.method !== 'POST' || req.url !== '/command') return reply(404, { error: 'use POST /command' });

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100_000) req.destroy();
    });
    req.on('end', () => {
      let msg;
      try {
        msg = JSON.parse(body);
      } catch {
        return reply(400, { error: 'invalid JSON' });
      }
      const { cmd, args = [] } = msg;
      if (!API_COMMANDS.has(cmd) || !Array.isArray(args)) {
        return reply(400, { error: `cmd must be one of: ${[...API_COMMANDS].join(', ')}` });
      }
      const bounds = win.getBounds();
      if (cmd === 'setPosition') sendCommand(cmd, args[0] - bounds.x, args[1] - bounds.y);
      else if (cmd === 'walkTo') sendCommand(cmd, args[0] - bounds.x);
      else if (cmd === 'summon') summon();
      else sendCommand(cmd, ...args);
      reply(202, { ok: true });
    });
  });
  server.on('error', (err) => console.warn(`Command API disabled: ${err.message}`));
  server.listen(port, '127.0.0.1', () => console.log(`Command API on http://127.0.0.1:${port}`));
}

// `npm run selftest`: drives the renderer through the core flows, saves screenshots, prints results, exits.
async function runSelfTest() {
  const outArg = process.argv.find((a) => a.startsWith('--selftest-out='));
  const outDir = outArg ? outArg.slice('--selftest-out='.length) : path.join(app.getPath('temp'), 'companion-selftest');
  fs.mkdirSync(outDir, { recursive: true });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const snap = async (name) => {
    const box = (await js('companion.debug()')).box;
    const x = Math.max(0, Math.round(box.x - 140));
    const y = Math.max(0, Math.round(box.y - 170));
    const img = await win.webContents.capturePage({ x, y, width: Math.round(box.width + 280), height: Math.round(box.y + box.height - y + 6) });
    fs.writeFileSync(path.join(outDir, `${name}.png`), img.toPNG());
  };

  const results = { outDir };
  try {
    while (!(await js('Boolean(window.companion && window.companion.ready)').catch(() => false))) await wait(100);
    await wait(500);
    results.initial = await js('companion.debug()');
    await js('companion.setPosition(500, innerHeight - 4)');
    for (const expr of ['neutral', 'happy', 'surprised', 'annoyed', 'sad', 'sleepy', 'thinking']) {
      await js(`companion.setExpression('${expr}')`);
      await wait(250);
      await snap(`expr-${expr}`);
    }
    for (const motion of ['walk', 'sit', 'groom', 'sleep', 'dangle']) {
      await js(`companion.setExpression("neutral"); companion.playMotion("${motion}"); null`); // don't wait for one-shots to finish
      await wait(400);
      await snap(`motion-${motion}`);
    }
    await js('companion.playMotion("idle")');
    await js('companion.hydrate()');
    await wait(1200);
    results.reminderBubble = (await js('companion.debug()')).bubble;
    await snap('reminder');
    results.hitBody = await js('(() => { const b = companion.debug().box; return companion.hitTest(b.x + b.width / 2, b.y + b.height * 0.55); })()');
    results.hitEmptyCorner = await js('(() => { const b = companion.debug().box; return companion.hitTest(b.x + 2, b.y + 2); })()');    await js('document.querySelector("#bubble button.primary").click()');
    await wait(500);
    results.afterYes = (await js('companion.debug()')).bubble;
    await snap('drink');
    await wait(1600);
    await snap('celebrate');

    // Reminders-only presence: walks off and hides, comes back for a reminder, leaves after.
    const until = async (expr, ms) => {
      for (const end = Date.now() + ms; Date.now() < end; await wait(200)) if (await js(expr)) return true;
      return false;
    };
    await wait(3000);
    await js('companion.setPresence("reminders")');
    results.leftScreen = await until('companion.debug().away', 20000);
    await js('companion.hydrate()');
    results.cameBackForReminder = await until('companion.debug().bubble !== null && companion.debug().mode === "reminder"', 20000);
    await snap('reminder-return');
    await js('document.querySelector("#bubble button.primary").click()');
    results.leftAfterAnswer = await until('companion.debug().away', 25000);

    // Multi-monitor: pretend each display in turn is the one being worked on and check the
    // character walks in there. Also record what the real active-window lookup reports.
    results.activeWindowLookup = foregroundWindowCenter ? 'available' : 'unavailable (mouse fallback)';
    results.activeDisplayNow = activeDisplay().id;
    results.displays = [];
    for (const display of screen.getAllDisplays()) {
      const { width, height } = display.workArea;
      activeDisplayOverride = display;
      summon();
      const arrived = await until(`!companion.debug().away && companion.debug().motion !== 'walk' && innerWidth === ${width} && innerHeight === ${height}`, 30000);
      await wait(2500);
      await snap(`display-${display.id}`);
      results.displays.push({ id: display.id, workArea: display.workArea, arrived, windowBounds: win.getBounds() });
    }
    activeDisplayOverride = null;
    results.final = await js('companion.debug()');
  } catch (err) {
    results.error = err.stack || String(err);
  }
  console.log(`SELFTEST ${JSON.stringify(results, null, 2)}`);
  app.exit(results.error ? 1 : 0);
}

ipcMain.handle('get-init', () => {
  config = loadConfig();
  // The self-test needs the character on screen the whole time.
  if (SELFTEST) config.presence = 'always';
  return { config, character: loadCharacterManifest() };
});
// Before the character walks on screen, move the overlay to the display the user is on.
ipcMain.handle('move-to-active-display', () => {
  moveToDisplay(activeDisplay());
  return win.getContentBounds();
});
ipcMain.on('set-present', (_event, value) => {
  present = Boolean(value);
  applyWindowVisibility();
});
ipcMain.handle('read-character-file', (_event, name) => fs.promises.readFile(resolveCharacterFile(name)));
ipcMain.on('set-ignore-mouse', (_event, ignore) => win && win.setIgnoreMouseEvents(Boolean(ignore), { forward: true }));
ipcMain.on('state', (_event, state) => {
  sleeping = Boolean(state.sleeping);
  if (!sleeping) autoSlept = false;
  if (tray) rebuildTrayMenu();
});

// Keep self-test runs (and their hydration log) out of the real profile.
if (SELFTEST) app.setPath('userData', path.join(app.getPath('temp'), 'companion-selftest-profile'));

if (!SELFTEST && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    ensureDataDir();
    initForegroundWindowLookup();
    config = loadConfig();
    createWindow();
    if (SELFTEST) {
      runSelfTest();
      return;
    }
    createTray();
    startIdleMonitor();
    startDisplayFollower();
    startApi(config.apiPort);
  });
}
