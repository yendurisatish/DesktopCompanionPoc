# Desktop Companion: M0 spike

A Scottish Fold cat (or a person, or your own character) that walks onto your screen to remind you to drink water. By default it only shows up when it has something to remind you about, then walks off again. Switch it to stay on the desktop all the time from the tray.

## Use it on another laptop

Build once on this machine:

```
npm run dist
```

This creates two files in `dist`. Copy either one to the other laptop. That laptop doesn't need Node or anything else installed.

| File | What it is |
|---|---|
| `DesktopCompanion-<version>-portable.exe` | Just double-click it to run, no install. |
| `DesktopCompanion-<version>-setup.exe` | Installs for the current user, with a Start menu entry and an uninstaller. |

The builds aren't code-signed, so the first time Windows SmartScreen says "Windows protected your PC". Click **More info**, then **Run anyway**.

On that laptop, settings live in `%APPDATA%Desktop Companionconfig.json` and custom character clips go in `%APPDATA%Desktop Companioncharacter`. The tray menu's **Open settings** and **Open character folder** take you there. Change `userName` if someone else is using it.

## Run it

```
npm install
npm start
```

You can also run `npm run selftest`. It drives the main flows, saves screenshots to `%TEMP%\companion-selftest`, prints the results and exits.

The first hydration reminder comes after 1 minute (`config.json` → `hydration.firstReminderMinutes`), then every 45 minutes. You can also trigger it from the tray: **Remind me to drink water now**.

## Using it

- **Click** the character for a reaction. Click three times quickly and it gets annoyed.
- **Drag** it anywhere. When you let go, it falls back to the bottom of the screen.
- **Tray icon:** a left-click calls the character over for a short visit. The right-click menu has:
  - **Only show up for reminders**: uncheck it to keep the character on the desktop all the time.
  - **Hide (hold reminders)**: hides it completely. Reminders wait until you choose Show.
  - Sleep, Remind me now, Settings, Character folder, Reload, Launch at startup and Quit.
- When the computer has been idle for 10 minutes, the character falls asleep, and it wakes when you return. Clicking a sleeping character also wakes it.
- Clicks anywhere else go straight through to the windows underneath.
- **Multiple monitors:** the character appears on the screen holding the window you're working in (the focused window). If you work in a window on another screen for a few seconds, it walks over there. Moving the mouse alone doesn't move it. This uses two read-only Windows calls through the `koffi` package; if those aren't available it follows the mouse pointer instead.

## Settings: `config.json`

| Key | Meaning |
|---|---|
| `userName` | Name used in the speech bubbles |
| `presence` | `"reminders"` (walks in only for reminders or when called) or `"always"` (lives on the desktop) |
| `hydration.*` | First reminder, interval, snooze, and how long to wait before an unanswered reminder snoozes itself |
| `walk.speed` | Walking speed in pixels per second; pauses between walks are random within min/max |
| `character.builtin` | `"cat"` (Scottish Fold) or `"person"`. Used when there are no clips in `assets/character/`. |
| `character.height` | On-screen height in pixels. 150 suits the cat, 260 the person. |
| `autoSleepAfterIdleMinutes` | Set to 0 to disable auto-sleep |
| `apiPort` | Port for the local command API |

Choose **Reload character & settings** in the tray after editing.

## Your own likeness

See **[CHARACTER.md](CHARACTER.md)**. In short: generate a stylized image of yourself, turn it into short green-screen clips, convert them with `npm run make-clip`, and list them in `assets/character/manifest.json`.

## Command API (spec §16: SetPosition / PlayMotion / SetExpression)

The app listens on `http://127.0.0.1:47811` (localhost only). This is the seam where a later agent or LLM service plugs in.

```powershell
$api = 'http://127.0.0.1:47811/command'
Invoke-RestMethod $api -Method Post -ContentType 'application/json' -Body '{"cmd":"setPosition","args":[800,900]}'
Invoke-RestMethod $api -Method Post -ContentType 'application/json' -Body '{"cmd":"playMotion","args":["celebrate"]}'
Invoke-RestMethod $api -Method Post -ContentType 'application/json' -Body '{"cmd":"setExpression","args":["thinking", 5]}'
Invoke-RestMethod $api -Method Post -ContentType 'application/json' -Body '{"cmd":"say","args":["Build passed!", 4]}'
```

| Command | Args | Notes |
|---|---|---|
| `setPosition` | `x, y` | Screen coordinates of the character's feet. It holds there for 5 s, then falls to the ground. |
| `playMotion` | `name` | `idle`, `walk`, `sit`, `groom`, `hold_bottle`, `drink`, `celebrate`, `wave`, `sleep`, `dangle` (`sit`/`groom` are cat-only) |
| `setExpression` | `name, seconds?` | `neutral`, `happy`, `surprised`, `annoyed`, `sad`, `sleepy`, `thinking`. Decays back after `seconds` (default 4). |
| `say` | `text, seconds?` | Shows a speech bubble |
| `walkTo` | `x` | Screen x coordinate |
| `hydrate`, `summon`, `sleep`, `wake` | none | `summon` calls the character over for a short visit |

## Layout

```
main.js                   desktop shell: overlay window, click-through, tray, idle detection, API, selftest
preload.js                IPC bridge
renderer/app.js           behavior engine: wander, hydration, reactions, drag, sleep, emotion decay
renderer/avatar-*.js      avatars: shared drawn base, cat, person, and your video clips
renderer/cat.css          cat poses and animations
tools/make-clip.js        green-screen video or image to transparent WebM
assets/character/         your clips + manifest.json
```

## Known limits of this spike

- Primary monitor only.
- It doesn't yet step aside for full-screen apps or presentations. Hide it from the tray for now.
- The hydration history lives in browser storage, and there's no SQLite yet.
- With video clips, expressions are baked into the clips. Only the placeholder shows all 7 expressions.
