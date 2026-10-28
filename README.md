# SignBridge

SignBridge translates hand signs from your webcam into English text in real time.
You teach it your own signs in the browser, it recognizes them as words, and
Gemini turns those words into one natural English sentence.

Everything runs in the browser. There is no backend, and training data is stored in `localStorage`.

## Pipeline

```
 Webcam
   │
   ▼
 MediaPipe HandLandmarker ──► 21 hand landmarks (x, y, z)
   │
   ▼
 Feature normalization ─────► 63 numbers (wrist = origin, scaled by hand size,
   │                           left hands mirrored, rotation kept)
   ▼
 k-NN classifier (k = 5) ───► label + confidence, or "unknown"
   │
   ▼
 Stable-word detection ─────► word accepted after 12 confident frames in a row
   │
   ▼
 Gloss: ME WANT WATER
   │   (FINISH sign or Translate button)
   ▼
 Gemini ────────────────────► "I want water."
```

| Step | File |
| --- | --- |
| Webcam + hand tracking + drawing | `src/handTracker.js` |
| Feature normalization | `src/features.js` |
| k-NN classifier + training data | `src/classifier.js` |
| Stable-word detection | `src/wordDetector.js` |
| Gemini translation + fallback | `src/translator.js` |
| DOM updates | `src/ui.js` |
| App setup + main loop | `src/main.js` |
| All tunable values | `src/config.js` |

## Setup

You need Node.js 18 or newer and Chrome.

```bash
npm install
```

Create a `.env` file in the project root (copy `.env.example`) with a Gemini API key from
[Google AI Studio](https://aistudio.google.com/apikey):

```
VITE_GEMINI_API_KEY=your-key-here
```

Start the dev server:

```bash
npm run dev
```

Open the printed URL (usually http://localhost:5173) in Chrome and allow camera access.

Without an API key the app still works. It shows a basic sentence ("Me want water.") instead of a Gemini translation.

## How to train

1. Open the **Train** tab. The 11 default words are already listed with a hint for each.
2. Click **Record** next to a word. After the 3-2-1 countdown, hold the sign in front of the camera
   for 3 seconds. Move your hand slightly and vary the angle a little. Only frames where a hand is
   detected are saved, giving up to 30 samples per recording.
3. Record each word **1 or 2 times (about 30 to 60 samples)**, in slightly different positions
   (closer, further away, a bit to the left or right).
4. Watch the **Live test** readout at the top of the panel to check that each sign is recognized.
5. Add your own words with **Add word**. Labels are stored in UPPERCASE.

Use **Export data** to save your training as JSON and **Import data** to load it again,
for example on another browser or before a demo.

## How to translate

1. Open the **Translate** tab.
2. Sign a word and hold it still until the ring next to the live prediction fills up (about 0.4 s).
   The word is added to **Signed words**.
3. To sign the same word twice, lower your hand out of view in between.
4. Make a **fist (FINISH)** or click **Translate**. Gemini's sentence appears in the caption above the video.
5. Use the × on a chip, **Undo last word** or **Clear** to fix mistakes. The last 5 translations are kept in **History**.

## Tuning tips

All values are in `src/config.js`.

- **Too many "Unknown" predictions?** Raise `REJECT_FACTOR` (for example 3 or 4), or record more samples in more varied positions.
- **Random hand shapes get recognized as words?** Lower `REJECT_FACTOR` (for example 1.5).
- **Words are accepted too easily or too slowly?** Change `HOLD_FRAMES` (frames to hold) or `CONFIDENCE_THRESHOLD`.
- **Two signs get confused?** Record more samples of both, from slightly different angles. Signs that
  look alike from the camera (for example ME and YOU) benefit most from extra samples.
- **Different Gemini model?** Change `MODEL_NAME`.
- Train in the same lighting and camera position you'll use for the demo.

## Security note

The Gemini API key is bundled into the browser code, so anyone who can open the page can see it.
This app is meant for **local demos only**. Don't deploy it publicly with your key.
