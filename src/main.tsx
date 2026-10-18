import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyPalette, getStoredPalette } from './lib/palette'

// 設定で選んだテーマカラーを、最初の描画より前に当てる（ちらつき防止）
applyPalette(getStoredPalette())

// PWA: Service Worker 登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {/* 開発環境では無視 */})
  })
}

// 開発中だけ /dev/ui で部品の確認用ページを開ける（本番のビルドには含まれない）
const UiGallery = import.meta.env.DEV ? lazy(() => import('./dev/UiGallery')) : null
const showGallery = UiGallery && window.location.pathname.startsWith('/dev/ui')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showGallery ? <Suspense fallback={null}><UiGallery /></Suspense> : <App />}
  </StrictMode>,
)
