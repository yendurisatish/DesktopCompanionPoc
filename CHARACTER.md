# Putting your own likeness in the companion

The app plays your character as short **transparent video clips**, one per motion. Until you add clips it uses the built-in placeholder character. To switch, put the clips in `assets/character/` with a `manifest.json` and choose **Reload character & settings** from the tray menu.

Only `idle` is required. Any motion without its own clip falls back to `idle`, so you can start with one or two clips and add more over time.

| Motion | When it plays | Loop? | Priority |
|---|---|---|---|
| `idle` | Standing around, breathing, blinking | loop | **required** |
| `walk` | Walking in place, side view, facing right | loop | high |
| `hold_bottle` | Holding up a water bottle and smiling (the reminder pose) | loop | high |
| `celebrate` | Happy reaction after you answer "Yes" | once | medium |
| `drink` | Drinking from the bottle | once | medium |
| `wave` | Waving hello (on startup and some clicks) | once | low |
| `sleep` | Dozing, head nodding | loop | low |
| `dangle` | Being picked up: legs dangling, surprised | loop | low |

## Step 1: Make a stylized character image

Start from a clear, well-lit, **full-body** photo of yourself, front-facing, with arms relaxed.

Use an image model that accepts a reference photo (ChatGPT/GPT image, Gemini, Midjourney with a character reference, and so on). Ask it for something like:

> A 3D animated-film style character of the person in this photo, full body, standing, front view, neutral friendly expression, same hairstyle, beard and outfit, white sneakers, **on a solid pure green (#00FF00) background**, even studio lighting, no shadows on the background.

Generate a few, pick the one that looks most like you, and keep it as your **master image**. Every clip below starts from it, so the character stays consistent.

## Step 2: Turn the image into motion clips

Use an image-to-video model (Kling, Veo, Runway, Hailuo, and so on) with the master image as the first frame. These rules matter more than the exact tool:

- **Static camera, solid green background, full body visible in every frame.**
- **Walk in place.** The app moves the character across the screen itself. Your walk clip should be a treadmill-style walk, side view, facing right. The app mirrors it when the character walks left.
- Keep clips short (2–5 s) and ask for seamless loops for the loop motions.

Example prompts:

- **idle**: "The character stands still in place, breathing gently, blinks, small natural weight shift. Static camera, solid green background, seamless loop."
- **walk**: "Side view, the character walks in place facing right, like on a treadmill, natural arm swing. Static camera, solid green background, seamless loop."
- **hold_bottle**: "The character raises a clear water bottle to chest height and smiles at the viewer. Static camera, solid green background."
- **celebrate**: "The character drinks from the water bottle, then gives a happy little cheer. Static camera, solid green background."

## Step 3: Convert each clip to a transparent WebM

```
npm run make-clip -- path\to\walk.mp4 walk
npm run make-clip -- path\to\idle.mp4 idle --start 0.5 --duration 3
```

This keys out the green, cleans up green edges, scales to 600 px tall and writes `assets/character/<name>.webm`.

Options:
- `--start` / `--duration`: trim to a clean loop.
- `--similarity 0.35`: use this if green fringes remain.
- `--key none`: the input already has a transparent background (for example, it came from a background-removal tool and was exported as ProRes 4444 or WebM).

Don't have a video yet? A still image works as an `idle` clip, and the character will slide around as a cut-out:

```
npm run make-clip -- path\to\master.png idle
```

## Step 4: Write the manifest

Copy `assets/character/manifest.example.json` to `assets/character/manifest.json` and delete the clips you don't have yet:

```json
{
  "facing": "right",
  "height": 260,
  "clips": {
    "idle": { "src": "idle.webm" },
    "walk": { "src": "walk.webm" },
    "hold_bottle": { "src": "hold_bottle.webm" }
  }
}
```

- `facing`: the direction your clips face. The app mirrors them to face the other way.
- `height`: on-screen height in pixels (overrides `config.json`).
- `loop`: override the default looping for a clip.

Then choose **Reload character & settings** from the tray menu. If a clip fails to load, the app falls back to the placeholder and logs the reason in the terminal.

## Notes

- With clips, the face is baked into the video, so `setExpression` has no visible effect yet. The placeholder shows all 7 expressions. Per-expression clips, or a rigged avatar, are the next step if you want continuous emotion.
- Clicks pass through any transparent pixels of the clip, so a clean key matters. Leftover green specks become clickable.
- This is your own likeness, so you're fine to use it. If you ever ship this publicly with someone else's face, you need their permission.
