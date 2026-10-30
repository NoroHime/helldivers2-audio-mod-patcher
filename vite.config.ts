import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves from /<repo>/ unless a custom domain is used.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/helldivers2-audio-mod-patcher/' : '/',
});