import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_RELAY_HOST || 'localhost:4535'

  // If user provided http/https prefix, use it, otherwise assume https for remote hosts
  let targetUrl = target;
  if (!target.startsWith('http')) {
    targetUrl = target.includes('localhost') ? `http://${target}` : `http://${target}`;
  }

  return {
    plugins: [react()],
    define: {
      'process.env': {}
    },
    server: {
      proxy: {
        '/api': {
          target: targetUrl,
          changeOrigin: true,
          secure: false, // Ignore self-signed certificates
        },
        '/apps': {
          target: targetUrl,
          changeOrigin: true,
          secure: false,
        },
        '/netlink.css': {
          target: targetUrl,
          changeOrigin: true,
          secure: false,
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
