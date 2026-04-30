import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'next/server': path.resolve(__dirname, 'node_modules/next/dist/server/web/exports/index.js'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
