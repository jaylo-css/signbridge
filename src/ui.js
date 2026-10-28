// All DOM updates live here so main.js can focus on the pipeline.
import { MIN_SAMPLES, FINISH_LABEL, DEFAULT_VOCABULARY } from './config.js';

const $ = (id) => document.getElementById(id);

const RING_CIRCUMFERENCE = 2 * Math.PI * 19;
const hints = Object.fromEntries(DEFAULT_VOCABULARY.map((v) => [v.label, v.hint]));

// Small helper to build elements without innerHTML (labels are user input).
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- Video stage ----------

// Make the stage and canvas match the camera's real size and aspect ratio.
export function fitStageToVideo(video, canvas) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  $('stage').style.setProperty('--ar', video.videoWidth / video.videoHeight);
}

export function setStageMessage(text, isError = false) {
  const node = $('stage-message');
  node.textContent = text || '';
  node.classList.toggle('hidden', !text);
  node.classList.toggle('error', isError);
}

export function setHandVisible(visible) {
  $('hand-status').classList.toggle('hidden', visible);
}

export function showCountdown(value) {
  const node = $('countdown');
  node.classList.toggle('hidden', value === null);
  if (value === null) return;
  node.textContent = value;
  restartAnimation(node);
}

export function showTranslating(gloss) {
  $('caption').classList.remove('hidden');
  $('caption').classList.add('translating');
  $('caption-text').textContent = 'Translating…';
  $('caption-gloss').textContent = gloss;
}

export function showCaption(sentence, gloss) {
  const caption = $('caption');
  caption.classList.remove('hidden', 'translating');
  $('caption-text').textContent = sentence;
  $('caption-gloss').textContent = gloss;
  restartAnimation(caption);
}

export function hideCaption() {
  $('caption').classList.add('hidden');
}

function restartAnimation(node) {
  node.classList.remove('animate');
  void node.offsetWidth; // force reflow so the CSS animation plays again
  node.classList.add('animate');
}

// ---------- Pipeline indicator ----------

let activeStep = null;
export function setPipelineStep(step) {
  if (step === activeStep) return;
  activeStep = step;
  for (const node of document.querySelectorAll('.pipeline .step')) {
    node.classList.toggle('active', node.dataset.step === step);
  }
}

// ---------- Mode ----------

export function setMode(mode) {
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  }
  $('translate-panel').hidden = mode !== 'translate';
  $('train-panel').hidden = mode !== 'train';
  hideCaption();
}

export function setEmptyState(isEmpty) {
  $('empty-state').classList.toggle('hidden', !isEmpty);
  $('translate-content').classList.toggle('hidden', isEmpty);
}

// ---------- Translate panel ----------

function predictionText(prediction) {
  if (!prediction) return '—';
  return prediction.label === 'unknown' ? 'Unknown' : prediction.label;
}

export function renderPrediction(prediction, holdState) {
  const label = $('prediction-label');
  label.textContent = predictionText(prediction);
  label.classList.toggle('muted', !prediction || prediction.label === 'unknown');

  const confidence = prediction ? prediction.confidence : 0;
  $('confidence-fill').style.width = `${Math.round(confidence * 100)}%`;
  $('confidence-value').textContent = `${Math.round(confidence * 100)}%`;

  $('ring-fill').style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - holdState.progress);
  $('ring').classList.toggle('locked', holdState.locked);
}

export function renderWords(words) {
  const chips = $('chips');
  chips.replaceChildren();
  if (words.length === 0) {
    chips.append(el('span', 'placeholder', 'Hold a sign to add a word. Make a fist (FINISH) to translate.'));
    return;
  }
  words.forEach((word, index) => {
    const chip = el('span', 'chip', word);
    const remove = el('button', 'chip-remove', '×');
    remove.dataset.index = index;
    remove.setAttribute('aria-label', `Remove ${word}`);
    chip.append(remove);
    chips.append(chip);
  });
}

export function renderHistory(history) {
  const list = $('history');
  list.replaceChildren();
  if (history.length === 0) {
    list.append(el('li', 'placeholder', 'Translations will appear here.'));
    return;
  }
  for (const item of history) {
    const row = el('li');
    row.append(el('div', 'history-sentence', item.sentence), el('div', 'history-gloss', item.gloss));
    list.append(row);
  }
}

export function setTranslateBusy(busy) {
  $('translate-btn').disabled = busy;
  $('translate-btn').textContent = busy ? 'Translating…' : 'Translate';
}

// ---------- Train panel ----------

export function renderTestReadout(prediction) {
  const label = $('test-label');
  label.textContent = predictionText(prediction);
  label.classList.toggle('muted', !prediction || prediction.label === 'unknown');
  $('test-confidence').textContent =
    prediction && prediction.label !== 'unknown' ? `${Math.round(prediction.confidence * 100)}%` : '';
}

export function renderVocabulary(data, recording) {
  const list = $('vocab');
  list.replaceChildren();
  for (const { label, samples } of data) {
    const row = el('li', 'vocab-row');

    const info = el('div', 'vocab-info');
    const word = el('div', 'vocab-word', label);
    if (label === FINISH_LABEL) word.append(el('span', 'badge', 'translates'));
    info.append(word);
    if (hints[label]) info.append(el('div', 'vocab-hint', hints[label]));

    const count = el('div', 'vocab-count', String(samples.length));
    count.classList.toggle('ready', samples.length >= MIN_SAMPLES);
    count.title = `${samples.length} samples (needs at least ${MIN_SAMPLES})`;

    const actions = el('div', 'vocab-actions');
    const record = el('button', 'btn small primary', 'Record');
    record.dataset.action = 'record';
    record.dataset.label = label;
    record.disabled = recording;
    const remove = el('button', 'btn small', 'Delete samples');
    remove.dataset.action = 'delete';
    remove.dataset.label = label;
    remove.disabled = recording || samples.length === 0;
    actions.append(record, remove);

    row.append(info, count, actions);
    list.append(row);
  }
}

export function setRecordStatus(message, progress) {
  const status = $('record-status');
  status.classList.toggle('hidden', message === null);
  if (message === null) return;
  $('record-message').textContent = message;
  $('record-fill').style.width = `${Math.round(progress * 100)}%`;
}

export function setTabsDisabled(disabled) {
  for (const tab of document.querySelectorAll('.tab')) tab.disabled = disabled;
}

export function showResetConfirm(visible) {
  $('reset-confirm').classList.toggle('hidden', !visible);
  $('reset-btn').classList.toggle('hidden', visible);
}

// ---------- Toast ----------

let toastTimer = null;
export function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 4000);
}
