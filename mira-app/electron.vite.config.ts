import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { resolve, normalize, dirname } from 'node:path'
import tailwindcss from '@tailwindcss/vite'

import injectProcessEnvPlugin from 'rollup-plugin-inject-process-env'
import reactPlugin from '@vitejs/plugin-react'

import { settings } from './src/lib/electron-router-dom'
import { main, resources } from './package.json'

const [nodeModules, devFolder] = normalize(dirname(main)).split(/\/|\\/g)
const devPath = [nodeModules, devFolder].join('/')

// Common path aliases
const pathAliases = {
  'main': resolve(__dirname, 'src/main'),
  'preload': resolve(__dirname, 'src/preload'),
  'renderer': resolve(__dirname, 'src/renderer/src'),
  'shared': resolve(__dirname, 'src/shared'),
  'lib': resolve(__dirname, 'src/lib'),
  '~': resolve(__dirname),
}

export default defineConfig({
  main: {
    resolve: {
      alias: pathAliases,
    },
    plugins: [externalizeDepsPlugin()],

    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
        },

        output: {
          dir: resolve(devPath, 'main'),
          format: 'es',
        },
      },
    },
  },

  preload: {
    resolve: {
      alias: pathAliases,
    },
    plugins: [externalizeDepsPlugin()],

    build: {
      rollupOptions: {
        output: {
          dir: resolve(devPath, 'preload'),
        },
      },
    },
  },

  renderer: {
    resolve: {
      alias: pathAliases,
    },

    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.platform': JSON.stringify(process.platform),
    },

    server: {
      port: settings.port,
    },

    plugins: [
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
        },
      },
    },
  },
})
