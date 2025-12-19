import { BrowserWindow, shell, screen } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { app } from 'electron'

import { createWindow } from 'lib/electron-app/factories/windows/create'
import { ENVIRONMENT } from 'shared/constants'
import { displayName } from '~/package.json'
import type { WindowState } from 'shared/models'

const WINDOW_STATE_FILE = 'window-state.json'

function getWindowStatePath(): string {
  return join(app.getPath('userData'), WINDOW_STATE_FILE)
}

function loadWindowState(): WindowState | null {
  try {
    const statePath = getWindowStatePath()
    if (existsSync(statePath)) {
      const data = readFileSync(statePath, 'utf-8')
      return JSON.parse(data) as WindowState
    }
  } catch (error) {
    console.warn('Failed to load window state:', error)
  }
  return null
}

function saveWindowState(state: WindowState): void {
  try {
    const statePath = getWindowStatePath()
    const dir = app.getPath('userData')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(statePath, JSON.stringify(state, null, 2))
  } catch (error) {
    console.warn('Failed to save window state:', error)
  }
}

function isWindowStateValid(state: WindowState): boolean {
  const displays = screen.getAllDisplays()
  // Check if window position is within any display bounds
  return displays.some(display => {
    const { x, y, width, height } = display.bounds
    const stateX = state.x ?? 0
    const stateY = state.y ?? 0
    return (
      stateX >= x - 100 &&
      stateX < x + width &&
      stateY >= y - 100 &&
      stateY < y + height
    )
  })
}

export async function MainWindow() {
  const savedState = loadWindowState()
  const defaultWidth = 1200
  const defaultHeight = 800

  // Determine initial window options
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    title: displayName,
    width: savedState?.width ?? defaultWidth,
    height: savedState?.height ?? defaultHeight,
    show: false,
    movable: true,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  }

  // Only set position if we have valid saved state
  if (savedState && isWindowStateValid(savedState)) {
    if (savedState.x !== undefined) windowOptions.x = savedState.x
    if (savedState.y !== undefined) windowOptions.y = savedState.y
  } else {
    windowOptions.center = true
  }

  const window = createWindow({
    id: 'main',
    ...windowOptions,
  })

  // Restore maximized state after window is ready
  if (savedState?.isMaximized) {
    window.maximize()
  }

  // Save window state on resize/move (debounced)
  let saveTimeout: NodeJS.Timeout | null = null
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      if (!window.isDestroyed()) {
        const bounds = window.getBounds()
        saveWindowState({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          isMaximized: window.isMaximized(),
        })
      }
    }, 500)
  }

  window.on('resize', debouncedSave)
  window.on('move', debouncedSave)
  window.on('maximize', debouncedSave)
  window.on('unmaximize', debouncedSave)

  window.webContents.on('did-finish-load', () => {
    if (ENVIRONMENT.IS_DEV) {
      window.webContents.openDevTools({ mode: 'detach' })
    }

    window.show()
  })

  window.webContents.setWindowOpenHandler(details => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  window.on('close', () => {
    // Save final state before closing
    if (!window.isDestroyed()) {
      const bounds = window.getBounds()
      saveWindowState({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: window.isMaximized(),
      })
    }

    for (const win of BrowserWindow.getAllWindows()) {
      win.destroy()
    }
  })

  return window
}
