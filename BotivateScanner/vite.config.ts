import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/scanner/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
