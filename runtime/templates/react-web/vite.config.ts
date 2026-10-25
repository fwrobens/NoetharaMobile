import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const hmrHost = process.env.VITE_HMR_HOST;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    hmr: hmrHost ? { host: hmrHost, protocol: 'wss', clientPort: 443 } : undefined,
  },
});
