import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', port: 5173, allowedHosts: true,
    proxy: { '/api': { target: process.env.API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true, secure: true } },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
});
