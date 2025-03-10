import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default {
  base: './',
  build: {
    outDir: 'dist'
  },
  publicDir: 'public',
  root: './',
  plugins: [
    wasm(),
    topLevelAwait()
  ],
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d']
  }
} 