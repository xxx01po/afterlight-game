import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// BASE_PATH lets the same build run at "/" (Vercel, local) and at "/afterlight-game/" (GitHub Pages).
// Two independent games share the repo: AFTERLIGHT (index.html) and «ПОСЛЕДНЯЯ СМЕНА» (smena/index.html).
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2020',
    // Rapier (WASM inlined, ~1.6 MB gzip) is loaded lazily while the menu is shown.
    chunkSizeWarningLimit: 4500,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        smena: fileURLToPath(new URL('./smena/index.html', import.meta.url)),
      },
      output: {
        manualChunks: (id: string) =>
          id.includes('node_modules/@dimforge') ? 'rapier' : id.includes('node_modules/three') ? 'three' : id.includes('node_modules') ? 'vendor' : undefined,
      },
    },
  },
});
