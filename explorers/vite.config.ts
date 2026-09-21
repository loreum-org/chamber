import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
  },
  define: {
    global: 'globalThis',
  },
  server: {
    headers: {
      // frame-ancestors is ignored in <meta>; send it as a response header.
      'Content-Security-Policy': "frame-ancestors 'none'",
    },
  },
  preview: {
    headers: {
      'Content-Security-Policy': "frame-ancestors 'none'",
    },
  },
})
