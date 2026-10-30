import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import localSpeechPlugin from './scripts/localSpeechPlugin.mjs';
import localPetAccountPlugin from './scripts/localPetAccountPlugin.mjs';

export default defineConfig({
  plugins: [react(), localSpeechPlugin(), localPetAccountPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/three/') || id.includes('\\three\\')) return 'three';
          if (id.includes('@supabase')) return 'supabase';
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
