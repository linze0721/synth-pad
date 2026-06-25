import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/synth-pad/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        presets: 'presets.html',
      },
    },
  },
});