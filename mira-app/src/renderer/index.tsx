import ReactDom from 'react-dom/client'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query-client'
import { AppRoutes } from './routes'

import './globals.css'

// Hide the loading screen once React is ready
const hideLoader = () => {
  const loader = document.getElementById('app-loader')
  if (loader) {
    loader.classList.add('hidden')
    setTimeout(() => loader.remove(), 200)
  }
}

ReactDom.createRoot(document.querySelector('app') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  </React.StrictMode>
)

// Hide loader after initial render
hideLoader()
