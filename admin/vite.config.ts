import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../api/public/admin',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/admin-api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
