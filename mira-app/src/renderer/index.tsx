import ReactDom from 'react-dom/client'
import React, { Suspense, lazy } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query-client'

// Lazy load the main routes for faster initial paint
const AppRoutes = lazy(() =>
  import('./routes').then(m => ({ default: m.AppRoutes }))
)

import './globals.css'

// Fallback component while routes load
function LoadingFallback() {
  return null // The app-loader handles the visual feedback
}

// Hide the loading screen once React is ready
const hideLoader = () => {
  const loader = document.getElementById('app-loader')
  if (loader) {
    loader.classList.add('hidden')
    setTimeout(() => loader.remove(), 200)
  }
}

// Create root and render immediately
const root = ReactDom.createRoot(document.querySelector('app') as HTMLElement)

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<LoadingFallback />}>
        <AppRoutes />
      </Suspense>
    </QueryClientProvider>
  </React.StrictMode>
)

// Hide loader after initial render using requestIdleCallback for better perceived performance
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => hideLoader(), { timeout: 500 })
} else {
  // Fallback for older browsers
  setTimeout(hideLoader, 0)
}
