// Step 2 of the pipeline: turn 21 hand landmarks into a 63-number feature
// vector that doesn't depend on where the hand is or how big it looks.

export function extractFeatures(landmarks, handedness) {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];

  // Hand size: distance from the wrist to the middle-finger knuckle.
  const scale =
    Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y, middleMcp.z - wrist.z) || 1;

  // Mirror left hands so both hands give the same features.
  const flipX = handedness === 'Left' ? -1 : 1;

  // Wrist becomes the origin, then divide by hand size. Rotation is kept on
  // purpose: thumbs up and thumbs down must look different.
  const features = [];
  for (const point of landmarks) {
    features.push(
      ((point.x - wrist.x) / scale) * flipX,
      (point.y - wrist.y) / scale,
      (point.z - wrist.z) / scale
    );
  }
  return features;
}
