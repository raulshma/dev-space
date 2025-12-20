import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { resolve, normalize, dirname } from 'node:path'
import tailwindcss from '@tailwindcss/vite'

import injectProcessEnvPlugin from 'rollup-plugin-inject-process-env'
import tsconfigPathsPlugin from 'vite-tsconfig-paths'
import reactPlugin from '@vitejs/plugin-react'

import { settings } from './src/lib/electron-router-dom'
import { main, resources } from './package.json'

const [nodeModules, devFolder] = normalize(dirname(main)).split(/\/|\\/g)
const devPath = [nodeModules, devFolder].join('/')

const tsconfigPaths = tsconfigPathsPlugin({
  projects: [resolve('tsconfig.json')],
})

const isProduction = process.env.NODE_ENV === 'production'

export default defineConfig({
  main: {
    plugins: [tsconfigPaths, externalizeDepsPlugin()],

    build: {
      // Enable minification in production
      minify: isProduction ? 'esbuild' : false,
      sourcemap: isProduction ? false : 'inline',

      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
        },

        output: {
          dir: resolve(devPath, 'main'),
          format: 'es',
        },

        // Tree shake unused exports
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
        },
      },
    },
  },

  preload: {
    plugins: [tsconfigPaths, externalizeDepsPlugin()],

    build: {
      minify: isProduction ? 'esbuild' : false,
      sourcemap: isProduction ? false : 'inline',

      rollupOptions: {
        output: {
          dir: resolve(devPath, 'preload'),
        },
      },
    },
  },

  renderer: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.platform': JSON.stringify(process.platform),
    },

    server: {
      port: settings.port,
      // Enable HMR for faster development
      hmr: true,
    },

    plugins: [
      tsconfigPaths,
      tailwindcss(),
      codeInspectorPlugin({
        bundler: 'vite',
        hotKeys: ['altKey'],
        hideConsole: true,
      }),
      reactPlugin(),
    ],

    publicDir: resolve(resources, 'public'),

    build: {
      outDir: resolve(devPath, 'renderer'),
      minify: isProduction ? 'esbuild' : false,
      sourcemap: isProduction ? false : 'inline',
      // Increase chunk size warning limit to reduce noise
      chunkSizeWarningLimit: 1000,

      rollupOptions: {
        plugins: [
          injectProcessEnvPlugin({
            NODE_ENV: 'production',
            platform: process.platform,
          }),
        ],

        input: {
          index: resolve('src/renderer/index.html'),
        },

        output: {
          dir: resolve(devPath, 'renderer'),
          // Split vendor chunks for better caching in production
          manualChunks: isProduction ? {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@tabler/icons-react', 'recharts', 'sonner'],
            'state-vendor': ['zustand', '@tanstack/react-query'],
            'monaco': ['monaco-editor', '@monaco-editor/react'],
            'terminal': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-webgl'],
          } : undefined,
        },

        // Better tree shaking
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
        },
      },
    },

    // Optimize dependencies for faster dev startup
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'zustand',
        '@tanstack/react-query',
      ],
      exclude: ['@lydell/node-pty'],
    },
  },
})
