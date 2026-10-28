import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// Read the installed MediaPipe version so the WASM files loaded from the CDN
// always match the npm package.
const mediapipePkg = JSON.parse(
  readFileSync(new URL('./node_modules/@mediapipe/tasks-vision/package.json', import.meta.url), 'utf8')
);

export default defineConfig({
  define: {
    __MEDIAPIPE_VERSION__: JSON.stringify(mediapipePkg.version),
  },
});
