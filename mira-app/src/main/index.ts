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
import { JulesService } from 'main/services/agent/jules-service'
import { WorkingDirectoryService } from 'main/services/agent/working-directory-service'

// V2 Services (Claude SDK integration)
import { AgentServiceV2 } from 'main/services/agent-service-v2'
import { AutoModeServiceV2 } from 'main/services/auto-mode-service-v2'
import { FeatureLoader } from 'main/services/feature-loader'

// Running Projects import
import { RunningProjectsService } from 'main/services/running-projects-service'

// Initialize core services
const db = new DatabaseService()
const ptyManager = new PTYManager()
const gitService = new GitService()
const keychainService = new KeychainService()

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
const julesService = new JulesService(agentConfigService)
const workingDirectoryService = new WorkingDirectoryService()

const agentExecutorService = new AgentExecutorService(
  db,
  processManager,
  taskQueue,
  outputBuffer,
  agentConfigService,
  gitService,
  julesService,
  workingDirectoryService
)

// Initialize V2 Services (Claude SDK integration)
const agentServiceV2 = new AgentServiceV2()
const featureLoader = new FeatureLoader()
const autoModeServiceV2 = new AutoModeServiceV2(featureLoader)

// Initialize Running Projects service
const runningProjectsService = new RunningProjectsService(ptyManager, db)

// Initialize IPC handlers with all services
const ipcHandlers = new IPCHandlers(
  db,
  ptyManager,
  gitService,
  keychainService,
  aiService,
  agentExecutorService,
  agentConfigService,
  julesService,
  requestLogger,
  runningProjectsService,
  agentServiceV2,
  autoModeServiceV2
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

  // Initialize Agent Executor service (recovers interrupted tasks)
  try {
    await agentExecutorService.initialize()
    console.log('Agent executor service initialized successfully')

    // Check if auto-resume is enabled and resume interrupted Claude Code tasks
    const autoResumeSetting = db.getSetting('tasks.autoResume')
    if (autoResumeSetting === 'true') {
      const resumedCount =
        await agentExecutorService.autoResumeInterruptedTasks()
      if (resumedCount > 0) {
        console.log(`Auto-resumed ${resumedCount} interrupted task(s)`)
      }
    }
  } catch (error) {
    console.warn('Failed to initialize agent executor service:', error)
  }

  // Register IPC handlers
  ipcHandlers.registerHandlers()

  const window = await makeAppSetup(MainWindow)

  // Set main window for running projects service (for IPC events)
  runningProjectsService.setMainWindow(window)

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

  // Stop all running projects
  try {
    await runningProjectsService.stopAll()
    console.log('Running projects stopped')
  } catch (error) {
    console.error('Error stopping running projects:', error)
  }

  // Kill all PTY processes
  ptyManager.killAll()

  // Stop git telemetry refreshes
  gitService.stopAllRefreshes()
})
