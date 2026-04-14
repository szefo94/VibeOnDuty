import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/VibeOnDuty/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'fps3d.html',
    },
  },
});
