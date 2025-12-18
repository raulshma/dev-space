import { app } from 'electron'
import { join } from 'node:path'

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

// AI Service imports
import { AIService } from 'main/services/ai-service'
import { ProviderRegistry } from 'main/services/ai/provider-registry'
import { ModelRegistry } from 'main/services/ai/model-registry'
import { RequestLogger } from 'main/services/ai/request-logger'

// Agent Executor imports
import { AgentExecutorService } from 'main/services/agent-executor-service'
import { AgentConfigService } from 'main/services/agent/agent-config-service'
import { ProcessManager } from 'main/services/agent/process-manager'
import { TaskQueue } from 'main/services/agent/task-queue'
import { OutputBuffer } from 'main/services/agent/output-buffer'

// Initialize core services
const db = new DatabaseService()
const ptyManager = new PTYManager()
const gitService = new GitService()
const keychainService = new KeychainService()
const agentService = new AgentService(keychainService)

// Initialize AI services
const providerRegistry = new ProviderRegistry()
const modelRegistry = new ModelRegistry(db)
const requestLogger = new RequestLogger(db)
const aiService = new AIService(
  providerRegistry,
  modelRegistry,
  requestLogger,
  keychainService
)

// Initialize Agent Executor services
const agentConfigService = new AgentConfigService(db, keychainService)
const processManager = new ProcessManager()
const taskQueue = new TaskQueue()
const outputBuffer = new OutputBuffer(db)

// Get the base path for agent scripts (workspace root)
const agentScriptsBasePath = ENVIRONMENT.IS_DEV
  ? join(__dirname, '..', '..', '..')
  : join(app.getAppPath(), '..')

const agentExecutorService = new AgentExecutorService(
  db,
  processManager,
  taskQueue,
  outputBuffer,
  agentConfigService,
  gitService,
  agentScriptsBasePath
)

// Initialize IPC handlers with all services
const ipcHandlers = new IPCHandlers(
  db,
  ptyManager,
  gitService,
  keychainService,
  agentService,
  aiService,
  agentExecutorService,
  agentConfigService,
  requestLogger
)

makeAppWithSingleInstanceLock(async () => {
  await app.whenReady()

  // Initialize database
  db.initialize()
  db.migrate()

  // Initialize keychain service (loads persisted API keys)
  try {
    await keychainService.initialize()
    console.log('Keychain service initialized successfully')
  } catch (error) {
    console.warn('Failed to initialize keychain service:', error)
  }

  // Initialize services that depend on database
  modelRegistry.initialize()
  requestLogger.initialize()

  // Initialize AI service (loads API key from keychain and sets up provider)
  // Requirements: 1.1
  try {
    await aiService.initialize()
    console.log('AI service initialized successfully')
  } catch (error) {
    console.warn('Failed to initialize AI service:', error)
    // Continue without AI service - user can configure later
  }

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
// Requirements: 8.5 - Gracefully terminate agents and persist task state
app.on('before-quit', async () => {
  console.log('Application shutting down...')

  // Gracefully shutdown agent executor (stops running tasks, persists state)
  try {
    await agentExecutorService.shutdown()
    console.log('Agent executor shutdown complete')
  } catch (error) {
    console.error('Error during agent executor shutdown:', error)
  }

  // Stop request logger cleanup timer
  requestLogger.stopPeriodicCleanup()

  // Close database
  db.close()

  // Kill all PTY processes
  ptyManager.killAll()

  // Stop git telemetry refreshes
  gitService.stopAllRefreshes()
})
