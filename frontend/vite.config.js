import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const mapsKey = env.VITE_GMAPS_API_KEY || ''
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
    },
    // Inline the Maps key into the index.html bootstrap script. Both the
    // inline loader script and any frontend code can read it as a global
    // identifier substituted at build time.
    define: {
      __VITE_GMAPS_KEY__: JSON.stringify(mapsKey),
    },
  }
})
