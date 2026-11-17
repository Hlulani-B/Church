import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/*
  Two HTML entries, one build. The main SPA stays at /, and the QR landing lives at /qr — a
  phone scanning the leader's code opens that page directly, without any of the SPA's router or
  bundle. Vercel rewrites /qr to /qr/qr.html so a leader's URL can stay short.
*/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        qr: fileURLToPath(new URL('./qr/qr.html', import.meta.url)),
      },
    },
  },
})
