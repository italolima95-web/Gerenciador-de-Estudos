import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:4318' },
    watch: { ignored: ['**/release/**', '**/dist-server/**', '**/.data/**'] },
  },
  build: { chunkSizeWarningLimit: 1500 },
});
