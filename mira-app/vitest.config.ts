import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  },
  resolve: {
    alias: {
      'main': resolve(__dirname, 'src/main'),
      'preload': resolve(__dirname, 'src/preload'),
      'renderer': resolve(__dirname, 'src/renderer/src'),
      'shared': resolve(__dirname, 'src/shared'),
      'lib': resolve(__dirname, 'src/lib'),
      '~': resolve(__dirname)
    }
  }
})
