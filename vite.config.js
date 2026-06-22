import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'service-worker.js',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon-192.svg', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Viagem Colaborativa',
        short_name: 'Viagem',
        description: 'Planeje sua viagem de forma colaborativa com controle financeiro completo',
        theme_color: '#0EA5E9',
        background_color: '#FAF8F6',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  build: {
    // Remove logs de debug do bundle de producao (mantem console.error/warn)
    minify: 'terser',
    terserOptions: {
      compress: {
        pure_funcs: ['console.log', 'console.debug', 'console.info'],
      },
    },
  },
})
