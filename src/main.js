// SignBridge: app setup and the main loop.
// Webcam → hand landmarks → features → k-NN → stable words → Gemini → caption
import './style.css';
import { startCamera, createHandTracker, drawHand } from './handTracker.js';
import { extractFeatures } from './features.js';
import * as classifier from './classifier.js';
import { WordDetector } from './wordDetector.js';
import { translateGloss } from './translator.js';
import * as ui from './ui.js';
import {
  FINISH_LABEL,
  HISTORY_SIZE,
  COUNTDOWN_SECONDS,
  RECORD_DURATION_MS,
  RECORD_INTERVAL_MS,
} from './config.js';

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');

const state = {
  mode: 'translate',
  tracker: null,
  cameraReady: false,
  lastVideoTime: -1,
  latestFeatures: null, // features of the hand in the newest frame, or null
  holdState: { progress: 0, locked: false },
  words: [],
  history: [],
  translating: false,
  captionShown: false,
  recording: false,
};

const detector = new WordDetector();

// ---------- Startup ----------

async function init() {
  classifier.loadData();
  bindEvents();
  setMode('translate');
  ui.renderWords(state.words);
  ui.renderHistory(state.history);

  // Camera and model load in parallel; either can fail without crashing the app.
  const camera = startCamera(video)
    .then(() => {
      state.cameraReady = true;
      ui.fitStageToVideo(video, canvas);
    })
    .catch((err) => {
      ui.setStageMessage(err.message, true);
      throw err;
    });

  const tracker = createHandTracker()
    .then((t) => (state.tracker = t))
    .catch((err) => {
      console.warn('Hand tracker failed to load.', err);
      throw new Error('Could not load the hand tracking model. Check your internet connection and reload.');
    });
  tracker.catch(() => {}); // handled below; avoids an unhandled rejection if the camera fails first

  try {
    await camera;
    ui.setStageMessage('Loading hand tracking model…');
    await tracker;
    ui.setStageMessage(null);
    requestAnimationFrame(loop);
  } catch (err) {
    if (state.cameraReady) ui.setStageMessage(err.message, true);
  }
}

// ---------- Main loop (one pass per new video frame) ----------

function loop() {
  requestAnimationFrame(loop);
  if (video.readyState < 2 || video.currentTime === state.lastVideoTime) return;
  state.lastVideoTime = video.currentTime;

  // 1. Hand tracking
  let result;
  try {
    result = state.tracker.detectForVideo(video, performance.now());
  } catch (err) {
    console.warn('Hand detection failed on this frame.', err);
    return;
  }
  const landmarks = result.landmarks?.[0] || null;
  drawHand(ctx, landmarks);
  ui.setHandVisible(Boolean(landmarks));

  // 2. Features + 3. k-NN prediction
  let prediction = null;
  if (landmarks) {
    const handedness = result.handedness?.[0]?.[0]?.categoryName;
    state.latestFeatures = extractFeatures(landmarks, handedness);
    prediction = classifier.predict(state.latestFeatures);
  } else {
    state.latestFeatures = null;
  }

  if (state.mode === 'train') {
    ui.renderTestReadout(prediction);
    ui.setPipelineStep(landmarks ? 'tracking' : null);
    return;
  }

  // 4. Stable word detection
  state.holdState = detector.update(prediction);
  ui.renderPrediction(prediction, state.holdState);
  if (state.holdState.accepted) onWordAccepted(state.holdState.accepted);

  updatePipeline(Boolean(landmarks));
}

function updatePipeline(handVisible) {
  const holding = state.holdState.progress > 0 && !state.holdState.locked;
  let step = null;
  if (state.translating) step = 'translation';
  else if (holding) step = 'recognition';
  else if (handVisible) step = 'tracking';
  else if (state.captionShown) step = 'translation';
  ui.setPipelineStep(step);
}

function onWordAccepted(label) {
  if (label === FINISH_LABEL) {
    translate();
    return;
  }
  state.words.push(label);
  ui.renderWords(state.words);
}

// ---------- 5. Translation ----------

async function translate() {
  if (state.translating) return;
  if (state.words.length === 0) {
    ui.showToast('Sign some words first, then translate.');
    return;
  }

  const words = [...state.words];
  const gloss = words.join(' ');
  state.translating = true;
  ui.setTranslateBusy(true);
  ui.showTranslating(gloss);

  const { sentence, warning } = await translateGloss(words);

  state.translating = false;
  ui.setTranslateBusy(false);
  if (warning) ui.showToast(warning);

  // Ignore the result if the user switched to Train mode meanwhile.
  if (state.mode !== 'translate') return;

  ui.showCaption(sentence, gloss);
  state.captionShown = true;
  state.history = [{ sentence, gloss }, ...state.history].slice(0, HISTORY_SIZE);
  ui.renderHistory(state.history);

  // Start the next sentence with an empty word list.
  state.words = [];
  ui.renderWords(state.words);
}

// ---------- Mode switching ----------

function setMode(mode) {
  if (state.recording) return;
  state.mode = mode;
  detector.reset();
  state.captionShown = false;
  ui.setMode(mode);
  ui.setEmptyState(!classifier.hasTrainingData());
  ui.renderVocabulary(classifier.getData(), state.recording);
  ui.showResetConfirm(false);
  ui.setPipelineStep(null);
}

// ---------- Training ----------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function recordSamples(label) {
  if (state.recording) return;
  if (!state.cameraReady || !state.tracker) {
    ui.showToast('The camera and hand tracker need to be running to record.');
    return;
  }

  state.recording = true;
  ui.setTabsDisabled(true);
  ui.renderVocabulary(classifier.getData(), true);
  ui.setRecordStatus(`Get ready to sign ${label}…`, 0);

  for (let n = COUNTDOWN_SECONDS; n > 0; n--) {
    ui.showCountdown(n);
    await sleep(1000);
  }
  ui.showCountdown(null);

  // Capture one sample per interval, only from frames where a hand is visible.
  const samples = [];
  const ticks = Math.round(RECORD_DURATION_MS / RECORD_INTERVAL_MS);
  for (let i = 0; i < ticks; i++) {
    if (state.latestFeatures) samples.push([...state.latestFeatures]);
    ui.setRecordStatus('Recording… move your hand slightly and vary the angle', (i + 1) / ticks);
    await sleep(RECORD_INTERVAL_MS);
  }

  const total = classifier.addSamples(label, samples);
  state.recording = false;
  ui.setTabsDisabled(false);
  ui.renderVocabulary(classifier.getData(), false);
  ui.setRecordStatus(
    samples.length > 0
      ? `Saved ${samples.length} new samples. ${label} now has ${total} samples.`
      : 'No hand was detected, so nothing was saved. Try again with your hand in view.',
    1
  );
}

function addWord(rawText) {
  const label = rawText.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!label) return false;
  if (label === 'UNKNOWN') {
    ui.showToast('"UNKNOWN" is reserved. Pick another word.');
    return false;
  }
  if (!classifier.addLabel(label)) {
    ui.showToast(`${label} is already in the vocabulary.`);
    return false;
  }
  ui.renderVocabulary(classifier.getData(), state.recording);
  return true;
}

function downloadData() {
  const blob = new Blob([classifier.exportData()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'signbridge-data.json';
  link.click();
  URL.revokeObjectURL(url);
}

async function uploadData(file) {
  try {
    classifier.importData(await file.text());
    ui.renderVocabulary(classifier.getData(), state.recording);
    ui.showToast('Training data imported.');
  } catch (err) {
    ui.showToast(err instanceof SyntaxError ? 'That file is not valid JSON.' : err.message);
  }
}

// ---------- Event wiring ----------

function bindEvents() {
  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  }
  document.getElementById('go-train').addEventListener('click', () => setMode('train'));

  // Translate panel
  document.getElementById('translate-btn').addEventListener('click', translate);
  document.getElementById('undo-btn').addEventListener('click', () => {
    state.words.pop();
    ui.renderWords(state.words);
  });
  document.getElementById('clear-btn').addEventListener('click', () => {
    state.words = [];
    state.captionShown = false;
    ui.renderWords(state.words);
    ui.hideCaption();
  });
  document.getElementById('chips').addEventListener('click', (event) => {
    const index = event.target.dataset.index;
    if (index === undefined) return;
    state.words.splice(Number(index), 1);
    ui.renderWords(state.words);
  });

  // Train panel
  document.getElementById('vocab').addEventListener('click', (event) => {
    const { action, label } = event.target.dataset;
    if (action === 'record') recordSamples(label);
    if (action === 'delete') {
      classifier.deleteSamples(label);
      ui.renderVocabulary(classifier.getData(), state.recording);
    }
  });

  document.getElementById('add-word-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('add-word-input');
    if (addWord(input.value)) input.value = '';
  });

  const importInput = document.getElementById('import-input');
  document.getElementById('export-btn').addEventListener('click', downloadData);
  document.getElementById('import-btn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', () => {
    if (importInput.files[0]) uploadData(importInput.files[0]);
    importInput.value = '';
  });

  document.getElementById('reset-btn').addEventListener('click', () => ui.showResetConfirm(true));
  document.getElementById('reset-no').addEventListener('click', () => ui.showResetConfirm(false));
  document.getElementById('reset-yes').addEventListener('click', () => {
    classifier.resetData();
    ui.showResetConfirm(false);
    ui.setRecordStatus(null);
    ui.renderVocabulary(classifier.getData(), state.recording);
    ui.showToast('All training data was reset.');
  });
}

init();
