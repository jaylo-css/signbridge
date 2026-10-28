// All tunable values for SignBridge live here.

// Gemini model used to turn sign gloss into an English sentence.
// (gemini-2.5-flash is no longer available to new API keys.)
export const MODEL_NAME = 'gemini-flash-lite-latest';

// Give up on Gemini after this many ms and use the basic fallback sentence.
export const TRANSLATE_TIMEOUT_MS = 10000;

// k-NN classifier: how many nearest training samples vote on each prediction.
export const K = 5;

// "Unknown" rejection: if the nearest training sample is further away than
// REJECT_FACTOR × (average nearest-neighbor distance inside the training data),
// the hand shape is treated as "unknown". Raise it if you see "unknown" too
// often; lower it if random hand shapes get recognized as words.
export const REJECT_FACTOR = 2.0;

// Labels with fewer samples than this are ignored when predicting.
export const MIN_SAMPLES = 5;

// A word is accepted when the same label is predicted with at least this
// confidence (share of the K neighbors that agree)...
export const CONFIDENCE_THRESHOLD = 0.8;

// ...for this many video frames in a row (12 frames ≈ 0.4 s at 30 fps).
export const HOLD_FRAMES = 12;

// Recording: countdown length, then one sample every RECORD_INTERVAL_MS
// for RECORD_DURATION_MS (3000 / 100 = 30 samples).
export const COUNTDOWN_SECONDS = 3;
export const RECORD_DURATION_MS = 3000;
export const RECORD_INTERVAL_MS = 100;

// How many past translations to keep in the History list.
export const HISTORY_SIZE = 5;

// The sign that triggers translation instead of being added as a word.
export const FINISH_LABEL = 'FINISH';

// localStorage key for the training data.
export const STORAGE_KEY = 'signbridge-data';

// MediaPipe hand tracking assets. __MEDIAPIPE_VERSION__ is filled in by
// vite.config.js from the installed npm package.
export const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${__MEDIAPIPE_VERSION__}/wasm`;
export const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Words pre-filled in the vocabulary (labels only, no samples), with a hint
// shown in Train mode.
export const DEFAULT_VOCABULARY = [
  { label: 'HELLO', hint: 'Open palm facing the camera, fingers together' },
  { label: 'ME', hint: 'Index finger pointing straight up' },
  { label: 'YOU', hint: 'Index finger pointing sideways' },
  { label: 'WANT', hint: '"Claw" hand, all fingers bent' },
  { label: 'WATER', hint: 'Three fingers up (index, middle, ring), "W" shape' },
  { label: 'GOOD', hint: 'OK sign (thumb and index touching in a circle)' },
  { label: 'YES', hint: 'Thumbs up' },
  { label: 'NO', hint: 'Thumbs down' },
  { label: 'PEACE', hint: 'V sign' },
  { label: 'I LOVE YOU', hint: 'Thumb, index and pinky extended' },
  { label: 'FINISH', hint: 'Closed fist (triggers translation)' },
];
