import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// React Native source previewed on the web through react-native-web.
// The same src/ code runs in Expo: only this file and src/main.tsx are web-specific.
const extensions = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'];
const hmrHost = process.env.VITE_HMR_HOST;

export default defineConfig({
  plugins: [react()],
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    global: 'globalThis',
  },
  resolve: {
    alias: {
      'react-native': fileURLToPath(new URL('./web/react-native.js', import.meta.url)),
      '@react-native/assets-registry/registry': fileURLToPath(new URL('./web/assets-registry.js', import.meta.url)),
    },
    extensions,
  },
  optimizeDeps: {
    esbuildOptions: { resolveExtensions: extensions, loader: { '.js': 'jsx' } },
  },
  server: {
    host: '127.0.0.1',
    hmr: hmrHost ? { host: hmrHost, protocol: 'wss', clientPort: 443 } : undefined,
  },
});
