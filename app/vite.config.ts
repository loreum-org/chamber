import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@\/contracts\/(.+)$/,
        replacement: `${path.resolve(__dirname, './contracts')}/$1`,
      },
      {
        find: /^@\/contracts$/,
        replacement: path.resolve(__dirname, './contracts'),
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
  },
  define: {
    global: 'globalThis',
  },
})
