import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 상대 경로로 빌드해 하위 경로(예: /paybook/)에 올려도 그대로 열린다.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: '인연 페이북',
        short_name: '페이북',
        description: '경조사 지출과 참여 내역을 기록하고 통계로 확인하는 경조사 관리 매니저',
        lang: 'ko',
        start_url: '.',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1220',
        theme_color: '#0b1220',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // 앱 셸은 캐시하되 Supabase API 응답은 항상 네트워크에서 가져온다.
        navigateFallbackDenylist: [/^\/api/],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
