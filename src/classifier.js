// Step 3 of the pipeline: k-nearest-neighbors sign classifier.
// Training data shape: { label: string, samples: number[][] }[]
import { K, REJECT_FACTOR, MIN_SAMPLES, STORAGE_KEY, DEFAULT_VOCABULARY } from './config.js';

const FEATURE_LENGTH = 63;

let data = [];
// Flattened samples from labels that have enough samples: { label, vector }[]
let points = [];
// Nearest-neighbor distance above which a prediction is "unknown".
let rejectDistance = Infinity;

// ---------- Data management ----------

export function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    data = isValidData(saved) ? saved : [];
  } catch {
    data = [];
  }
  addDefaultLabels();
  recompute();
}

export function getData() {
  return data;
}

export function hasTrainingData() {
  return points.length > 0;
}

export function addLabel(label) {
  if (data.some((entry) => entry.label === label)) return false;
  data.push({ label, samples: [] });
  save();
  return true;
}

export function addSamples(label, samples) {
  const entry = data.find((e) => e.label === label);
  if (!entry) return 0;
  entry.samples.push(...samples);
  save();
  return entry.samples.length;
}

export function deleteSamples(label) {
  const entry = data.find((e) => e.label === label);
  if (entry) entry.samples = [];
  save();
}

export function resetData() {
  data = [];
  addDefaultLabels();
  save();
}

export function exportData() {
  return JSON.stringify(data);
}

// Replaces all data with the imported JSON. Throws if the format is wrong.
export function importData(json) {
  const parsed = JSON.parse(json);
  if (!isValidData(parsed)) throw new Error('This file is not SignBridge training data.');
  data = parsed.map((entry) => ({ label: entry.label.toUpperCase(), samples: entry.samples }));
  addDefaultLabels();
  save();
}

function isValidData(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry?.label === 'string' &&
        Array.isArray(entry.samples) &&
        entry.samples.every((s) => Array.isArray(s) && s.length === FEATURE_LENGTH)
    )
  );
}

function addDefaultLabels() {
  for (const { label } of DEFAULT_VOCABULARY) {
    if (!data.some((entry) => entry.label === label)) data.push({ label, samples: [] });
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Could not save training data to localStorage.', err);
  }
  recompute();
}

// Rebuild the training set and the "unknown" threshold whenever data changes.
function recompute() {
  points = [];
  for (const { label, samples } of data) {
    if (samples.length < MIN_SAMPLES) continue;
    for (const vector of samples) points.push({ label, vector });
  }

  if (points.length < 2) {
    rejectDistance = Infinity;
    return;
  }

  // Average distance from each sample to its nearest other sample.
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    let nearest = Infinity;
    for (let j = 0; j < points.length; j++) {
      if (i !== j) nearest = Math.min(nearest, distance(points[i].vector, points[j].vector));
    }
    total += nearest;
  }
  rejectDistance = REJECT_FACTOR * (total / points.length);
}

// ---------- Prediction ----------

function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

// Returns { label, confidence }. label is "unknown" if the hand shape
// is too far from everything in the training data.
export function predict(features) {
  if (points.length === 0) return { label: 'unknown', confidence: 0 };

  const neighbors = points
    .map((p) => ({ label: p.label, dist: distance(features, p.vector) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, Math.min(K, points.length));

  if (neighbors[0].dist > rejectDistance) return { label: 'unknown', confidence: 0 };

  // Majority vote. Neighbors are sorted closest first, so ties go to the closer label.
  const votes = new Map();
  for (const { label } of neighbors) votes.set(label, (votes.get(label) || 0) + 1);

  let bestLabel = null;
  let bestVotes = 0;
  for (const [label, count] of votes) {
    if (count > bestVotes) {
      bestLabel = label;
      bestVotes = count;
    }
  }
  return { label: bestLabel, confidence: bestVotes / neighbors.length };
}
