// Step 1 of the pipeline: webcam + MediaPipe HandLandmarker.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_URL, HAND_MODEL_URL } from './config.js';

// Start the webcam. Throws an Error with a user-friendly message on failure.
export async function startCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot access a camera. Open the app on http://localhost in Chrome.');
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      throw new Error('Camera access was denied. Allow the camera in the address bar, then reload the page.');
    }
    if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
      throw new Error('No camera found. Connect a webcam and reload the page.');
    }
    if (err.name === 'NotReadableError') {
      throw new Error('The camera is being used by another app. Close it and reload the page.');
    }
    throw new Error(`Could not start the camera (${err.name || err.message}).`);
  }

  video.srcObject = stream;
  await new Promise((resolve) => {
    if (video.readyState >= 1) resolve();
    else video.addEventListener('loadedmetadata', resolve, { once: true });
  });
  await video.play();
}

// Load the hand landmark model. Tries the GPU first, then falls back to CPU.
export async function createHandTracker() {
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numHands: 1,
  });

  try {
    return await HandLandmarker.createFromOptions(vision, options('GPU'));
  } catch (err) {
    console.warn('GPU hand tracking unavailable, using CPU.', err);
    return await HandLandmarker.createFromOptions(vision, options('CPU'));
  }
}

// Draw the 21 landmarks and their connections with thin glowing lines.
// The canvas is mirrored with CSS just like the video, so raw coordinates line up.
export function drawHand(ctx, landmarks) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, width / 420);
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.95)';
  ctx.shadowColor = 'rgba(45, 212, 191, 0.9)';
  ctx.shadowBlur = 12;

  ctx.beginPath();
  for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
    ctx.moveTo(landmarks[start].x * width, landmarks[start].y * height);
    ctx.lineTo(landmarks[end].x * width, landmarks[end].y * height);
  }
  ctx.stroke();

  const radius = Math.max(2, width / 260);
  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 8;
  for (const point of landmarks) {
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
