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
      output: {
        /*
          jsPDF and jszip are pulled in only when a download is pressed, so they are the two chunks
          fetched long after the page was opened. A hashed name means every redeploy moves them and
          deletes the old file, and a tab left open from before the update then meets a 404 the moment
          somebody clicks Download — the whole community's export failing at once, for a reason nobody
          can see. Their own names, without a hash, stay where the old page points.

          Only these two. Everything else keeps `[hash]`, because those are loaded with the page that
          names them and cannot outlive a deploy in the first place. Vercel already serves /assets with
          `max-age=0, must-revalidate`, so an unhashed name is not a stale file waiting to be read.
        */
        manualChunks: (id) => {
          if (/[\\/]node_modules[\\/]jspdf[\\/]/.test(id)) return 'jspdf'
          if (/[\\/]node_modules[\\/]jszip[\\/]/.test(id)) return 'jszip'
          return null
        },
        chunkFileNames: (chunk) =>
          chunk.name === 'jspdf' || chunk.name === 'jszip'
            ? 'assets/[name].js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
})
