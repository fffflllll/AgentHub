import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const javaApiPort = process.env.JAVA_API_PORT ?? '18080';
const javaApiTarget = process.env.VITE_DEV_API_TARGET ?? `http://localhost:${javaApiPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': javaApiTarget,
      '/ws': {
        target: javaApiTarget,
        ws: true,
      },
    },
  },
});
