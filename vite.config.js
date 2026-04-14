import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/VibeOnDuty/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
});
