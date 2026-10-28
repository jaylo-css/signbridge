// Step 4 of the pipeline: turn noisy per-frame predictions into words.
import { CONFIDENCE_THRESHOLD, HOLD_FRAMES } from './config.js';

export class WordDetector {
  constructor() {
    this.reset();
  }

  reset() {
    this.candidate = null; // label currently being held
    this.count = 0; // frames in a row the candidate was predicted
    this.lastAccepted = null; // blocks "HELLO HELLO HELLO"
  }

  // Feed one frame's prediction (or null when no hand is visible).
  // Returns { accepted, progress, locked }:
  //   accepted – the label accepted on this frame, or null
  //   progress – 0..1 hold progress for the ring
  //   locked   – true while the hand still holds the last accepted word
  update(prediction) {
    // Hand left the frame: start fresh, the same word may be signed again.
    if (!prediction) {
      this.reset();
      return { accepted: null, progress: 0, locked: false };
    }

    const { label, confidence } = prediction;
    if (label === 'unknown' || confidence < CONFIDENCE_THRESHOLD) {
      this.candidate = null;
      this.count = 0;
      return { accepted: null, progress: 0, locked: false };
    }

    // Still holding the word we just accepted: don't count it again.
    if (label === this.lastAccepted) {
      this.candidate = null;
      this.count = 0;
      return { accepted: null, progress: 1, locked: true };
    }

    if (label !== this.candidate) {
      this.candidate = label;
      this.count = 0;
    }
    this.count++;

    if (this.count >= HOLD_FRAMES) {
      this.lastAccepted = label;
      this.candidate = null;
      this.count = 0;
      return { accepted: label, progress: 1, locked: true };
    }
    return { accepted: null, progress: this.count / HOLD_FRAMES, locked: false };
  }
}
