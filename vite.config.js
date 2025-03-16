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
    target: 'esnext', // To allow using top-level await, which is needed by RAPIER.js
    outDir: 'dist',
    assetsDir: 'assets'
  },
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@': './src', // Shortcut for importing from /src (e.g. '@/components')
      'models': './models', // For easier model imports
      'public': './public' // For public assets
    }
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d']
  },
  server: {
    host: true,
  }
});