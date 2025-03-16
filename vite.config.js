import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext', // To allow using top-level await, which is needed by RAPIER.js
    outDir: 'dist',
    assetsDir: 'assets'
  },
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@': '/src', // Shortcut for importing from /src (e.g. '@/components')
      'models': '/models', // For easier model imports
      'public': '/public' // For public assets
    }
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d']
  },
  server: {
    host: true,
  }
});