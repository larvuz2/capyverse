import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  base: './',
  plugins: [
    wasm(),
    topLevelAwait()
  ],
  build: {
    outDir: 'dist',
    target: 'esnext',
    // Ensure Rapier is properly handled
    rollupOptions: {
      output: {
        manualChunks: {
          rapier: ['@dimforge/rapier3d'],
        },
      },
    },
  },
  publicDir: 'public',
  root: './',
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d']
  }
});