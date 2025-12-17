import { app } from 'electron'

import { makeAppWithSingleInstanceLock } from 'lib/electron-app/factories/app/instance'
import { makeAppSetup } from 'lib/electron-app/factories/app/setup'
import { loadReactDevtools } from 'lib/electron-app/utils'
import { ENVIRONMENT } from 'shared/constants'
import { waitFor } from 'shared/utils'
import { MainWindow } from './windows/main'

import { DatabaseService } from 'main/services/database'
import { PTYManager } from 'main/services/pty-manager'
import { GitService } from 'main/services/git-service'
import { KeychainService } from 'main/services/keychain-service'
import { AgentService } from 'main/services/agent-service'
import { IPCHandlers } from 'main/ipc/handlers'

// Initialize services
const db = new DatabaseService()
const ptyManager = new PTYManager()
const gitService = new GitService()
const keychainService = new KeychainService()
const agentService = new AgentService(keychainService)

// Initialize IPC handlers
const ipcHandlers = new IPCHandlers(
  db,
  ptyManager,
  gitService,
  keychainService,
  agentService
)

makeAppWithSingleInstanceLock(async () => {
  await app.whenReady()

  // Initialize database
  db.initialize()
  db.migrate()

  // Register IPC handlers
  ipcHandlers.registerHandlers()

  const window = await makeAppSetup(MainWindow)

  if (ENVIRONMENT.IS_DEV) {
    await loadReactDevtools()
    /* This trick is necessary to get the new
      React Developer Tools working at app initial load.
      Otherwise, it only works on manual reload.
    */
    window.webContents.once('devtools-opened', async () => {
      await waitFor(1000)
      window.webContents.reload()
    })
  }
})

// Cleanup on quit
app.on('before-quit', () => {
  db.close()
  ptyManager.killAll()
  gitService.stopAllRefreshes()
})
