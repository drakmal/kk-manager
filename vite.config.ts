import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

// Served from drakmal.com/kk-manager/ (GitHub Pages project site).
export default defineConfig({
  base: '/kk-manager/',
  plugins: [preact()],
});
