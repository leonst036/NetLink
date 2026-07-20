import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_RELAY_HOST || 'localhost:4535'
  const isSecureTarget = target.includes('443') || target.includes('https') || !target.includes('localhost') // Best effort guess if it should be https
  
  // If user provided http/https prefix, use it, otherwise assume https for remote hosts
  let targetUrl = target;
  if (!target.startsWith('http')) {
      targetUrl = target.includes('localhost') ? `http://${target}` : `https://${target}`;
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: targetUrl,
          changeOrigin: true,
          secure: false, // Ignore self-signed certificates
        },
        '/health': {
          target: targetUrl,
          changeOrigin: true,
          secure: false, // Ignore self-signed certificates
        }
      }
    }
  }
})
