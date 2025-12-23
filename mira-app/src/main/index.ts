import { app, Menu } from 'electron'

import { makeAppWithSingleInstanceLock } from 'lib/electron-app/factories/app/instance'
import { makeAppSetup } from 'lib/electron-app/factories/app/setup'
import { ENVIRONMENT } from 'shared/constants'
import { MainWindow } from './windows/main'

// Disable default menu early for better startup performance
// https://github.com/electron/electron/blob/main/docs/tutorial/performance.md
Menu.setApplicationMenu(null)

// ============================================================================
// Service Type Imports (types only - no runtime cost)
// ============================================================================
import type { DatabaseService } from 'main/services/database'
import type { PTYManager } from 'main/services/pty-manager'
import type { GitService } from 'main/services/git-service'
import type { KeychainService } from 'main/services/keychain-service'
import type { AIService } from 'main/services/ai-service'
import type { ProviderRegistry } from 'main/services/ai/provider-registry'
import type { ModelRegistry } from 'main/services/ai/model-registry'
import type { RequestLogger } from 'main/services/ai/request-logger'
import type { AgentExecutorService } from 'main/services/agent-executor-service'
import type { AgentConfigService } from 'main/services/agent/agent-config-service'
import type { ProcessManager } from 'main/services/agent/process-manager'
import type { TaskQueue } from 'main/services/agent/task-queue'
import type { OutputBuffer } from 'main/services/agent/output-buffer'
import type { JulesService } from 'main/services/agent/jules-service'
import type { WorkingDirectoryService } from 'main/services/agent/working-directory-service'
import type { AgentServiceV2 } from 'main/services/agent-service-v2'
import type { AutoModeServiceV2 } from 'main/services/auto-mode-service-v2'
import type { FeatureLoader } from 'main/services/feature-loader'
import type { RunningProjectsService } from 'main/services/running-projects-service'
import type { IPCHandlers } from 'main/ipc/handlers'
import type { OpencodeSdkService } from 'main/services/agent/opencode-sdk-service'
import type { GlobalProcessService } from 'main/services/global-process-service'
import type { WorktreeService } from 'main/services/worktree-service'
import type { DependencyManager } from 'main/services/dependency-manager'
import type { SessionService } from 'main/services/session-service'
import type { BrowserWindow } from 'electron'
import type { ReviewService } from 'main/services/review-service'

// ============================================================================
// Service Instances (lazy-loaded)
// ============================================================================
let db: DatabaseService
let ptyManager: PTYManager
let gitService: GitService
let keychainService: KeychainService
let providerRegistry: ProviderRegistry
let modelRegistry: ModelRegistry
let requestLogger: RequestLogger
let aiService: AIService
let agentConfigService: AgentConfigService
let processManager: ProcessManager
let taskQueue: TaskQueue
let outputBuffer: OutputBuffer
let julesService: JulesService
let workingDirectoryService: WorkingDirectoryService
let agentExecutorService: AgentExecutorService
let agentServiceV2: AgentServiceV2
let featureLoader: FeatureLoader
let autoModeServiceV2: AutoModeServiceV2
let runningProjectsService: RunningProjectsService
let opencodeSdkService: OpencodeSdkService
let globalProcessService: GlobalProcessService
let worktreeService: WorktreeService
let dependencyManager: DependencyManager
let sessionService: SessionService
let ipcHandlers: IPCHandlers
let reviewService: ReviewService

/**
 * Initialize core services that are required immediately
 * These are loaded synchronously to enable basic app functionality
 */
async function initializeCoreServices(): Promise<void> {
  const startTime = performance.now()
  console.log('[Startup] Initializing core services...')

  // Import core services - these are needed immediately
  const [
    { DatabaseService: DbService },
    { PTYManager: PTYMgr },
    { GitService: GitSvc },
    { KeychainService: KeychainSvc },
  ] = await Promise.all([
    import('main/services/database'),
    import('main/services/pty-manager'),
    import('main/services/git-service'),
    import('main/services/keychain-service'),
  ])

  db = new DbService()
  ptyManager = new PTYMgr()
  gitService = new GitSvc()
  keychainService = new KeychainSvc()

  // Initialize database - required before other services
  db.initialize()

  // Initialize keychain in parallel (loads persisted API keys)
  const keychainPromise = keychainService.initialize().catch(error => {
    console.warn('[Startup] Failed to initialize keychain service:', error)
  })

  await keychainPromise

  const duration = performance.now() - startTime
  console.log(`[Startup] Core services initialized in ${duration.toFixed(2)}ms`)
}

/**
 * Initialize AI services
 * Loaded after core services are ready
 */
async function initializeAIServices(): Promise<void> {
  const startTime = performance.now()
  console.log('[Startup] Initializing AI services...')

  // Import AI services in parallel
  const [
    { ProviderRegistry: ProvReg },
    { ModelRegistry: ModelReg },
    { RequestLogger: ReqLogger },
    { AIService: AISvc },
  ] = await Promise.all([
    import('main/services/ai/provider-registry'),
    import('main/services/ai/model-registry'),
    import('main/services/ai/request-logger'),
    import('main/services/ai-service'),
  ])

  providerRegistry = new ProvReg()
  modelRegistry = new ModelReg(db)
  requestLogger = new ReqLogger(db)
  aiService = new AISvc(
    providerRegistry,
    modelRegistry,
    requestLogger,
    keychainService
  )

  // Initialize services that depend on database
  modelRegistry.initialize()
  requestLogger.initialize()

  // Initialize AI service (loads API key from keychain and sets up provider)
  try {
    await aiService.initialize()
    console.log('[Startup] AI service initialized successfully')
  } catch (error) {
    console.warn('[Startup] Failed to initialize AI service:', error)
    // Continue without AI service - user can configure later
  }

  const duration = performance.now() - startTime
  console.log(`[Startup] AI services initialized in ${duration.toFixed(2)}ms`)
}

/**
 * Initialize Agent services
 * Loaded in parallel with AI services after core services
 */
async function initializeAgentServices(): Promise<void> {
  const startTime = performance.now()
  console.log('[Startup] Initializing Agent services...')

  // Import agent services in parallel
  const [
    { AgentConfigService: ConfigSvc },
    { ProcessManager: ProcMgr },
    { TaskQueue: TaskQ },
    { OutputBuffer: OutBuf },
    { JulesService: JulesSvc },
    { WorkingDirectoryService: WorkDirSvc },
    { AgentExecutorService: ExecSvc },
    { AgentServiceV2: AgentSvcV2 },
    { FeatureLoader: FeatLoader },
    { AutoModeServiceV2: AutoModeSvcV2 },
    { RunningProjectsService: RunProjSvc },
    { OpencodeSdkService: OpencodeSvc },
    { GlobalProcessService: GlobalProcSvc },
    { WorktreeService: WorktreeSvc },
    { DependencyManager: DepMgr },
    { SessionService: SessSvc },
    { ReviewService: ReviewSvc },
    { FileCopyService: FileCopySvc },
    { CleanupService: CleanupSvc },
    { ScriptsService: ReviewScriptsSvc },
  ] = await Promise.all([
    import('main/services/agent/agent-config-service'),
    import('main/services/agent/process-manager'),
    import('main/services/agent/task-queue'),
    import('main/services/agent/output-buffer'),
    import('main/services/agent/jules-service'),
    import('main/services/agent/working-directory-service'),
    import('main/services/agent-executor-service'),
    import('main/services/agent-service-v2'),
    import('main/services/feature-loader'),
    import('main/services/auto-mode-service-v2'),
    import('main/services/running-projects-service'),
    import('main/services/agent/opencode-sdk-service'),
    import('main/services/global-process-service'),
    import('main/services/worktree-service'),
    import('main/services/dependency-manager'),
    import('main/services/session-service'),
    import('main/services/review-service'),
    import('main/services/file-copy-service'),
    import('main/services/cleanup-service'),
    import('main/services/scripts-service'),
  ])

  agentConfigService = new ConfigSvc(db, keychainService)
  processManager = new ProcMgr()
  taskQueue = new TaskQ()
  outputBuffer = new OutBuf(db)
  julesService = new JulesSvc(agentConfigService)
  workingDirectoryService = new WorkDirSvc()

  agentExecutorService = new ExecSvc(
    db,
    processManager,
    taskQueue,
    outputBuffer,
    agentConfigService,
    gitService,
    julesService,
    workingDirectoryService,
    worktreeService
  )

  agentServiceV2 = new AgentSvcV2()
  featureLoader = new FeatLoader()
  autoModeServiceV2 = new AutoModeSvcV2(featureLoader)
  runningProjectsService = new RunProjSvc(ptyManager, db)
  opencodeSdkService = new OpencodeSvc()
  globalProcessService = new GlobalProcSvc()
  worktreeService = new WorktreeSvc(db, gitService)
  dependencyManager = new DepMgr(db)
  sessionService = new SessSvc(db)

  // Review workflow service (approve/discard + feedback restart)
  // Needs DB + PTY manager and supporting services.
  const fileCopyService = new FileCopySvc()
  const cleanupService = new CleanupSvc()
  const scriptsService = new ReviewScriptsSvc()
  reviewService = new ReviewSvc(
    db,
    fileCopyService,
    cleanupService,
    scriptsService,
    ptyManager
  )

  // Wire feedback -> agent restart (review iterations)
  reviewService.setRestartAgentCallback(async (taskId, feedback) => {
    await agentExecutorService.restartTaskWithFeedback(taskId, feedback)
  })

  const duration = performance.now() - startTime
  console.log(
    `[Startup] Agent services initialized in ${duration.toFixed(2)}ms`
  )
}

/**
 * Initialize Agent Executor (requires agent services to be ready)
 */
async function initializeAgentExecutor(): Promise<void> {
  const startTime = performance.now()

  try {
    await agentExecutorService.initialize()
    console.log('[Startup] Agent executor service initialized successfully')

    // Check if auto-resume is enabled and resume interrupted Claude Code tasks
    const autoResumeSetting = db.getSetting('tasks.autoResume')
    if (autoResumeSetting === 'true') {
      const resumedCount =
        await agentExecutorService.autoResumeInterruptedTasks()
      if (resumedCount > 0) {
        console.log(
          `[Startup] Auto-resumed ${resumedCount} interrupted task(s)`
        )
      }
    }
  } catch (error) {
    console.warn(
      '[Startup] Failed to initialize agent executor service:',
      error
    )
  }

  const duration = performance.now() - startTime
  console.log(
    `[Startup] Agent executor initialized in ${duration.toFixed(2)}ms`
  )
}

/**
 * Initialize IPC handlers
 */
async function initializeIPCHandlers(): Promise<void> {
  const startTime = performance.now()
  console.log('[Startup] Initializing IPC handlers...')

  const { IPCHandlers } = await import('main/ipc/handlers')

  ipcHandlers = new IPCHandlers(
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
    autoModeServiceV2,
    globalProcessService,
    worktreeService,
    dependencyManager,
    sessionService,
    opencodeSdkService,
    reviewService
  )

  ipcHandlers.registerHandlers()

  const duration = performance.now() - startTime
  console.log(`[Startup] IPC handlers initialized in ${duration.toFixed(2)}ms`)
}

/**
 * Load React DevTools in development mode
 * Deferred to after window is visible for better perceived startup
 */
async function loadDevTools(window: BrowserWindow): Promise<void> {
  if (!ENVIRONMENT.IS_DEV) return

  // Defer devtools loading to after window is visible
  setTimeout(async () => {
    try {
      const { loadReactDevtools } = await import('lib/electron-app/utils')
      await loadReactDevtools()
      console.log('[DevTools] React Developer Tools loaded')
    } catch (error) {
      console.warn('[DevTools] Failed to load React Developer Tools:', error)
    }
  }, 100)
}

// ============================================================================
// Main Application Entry Point
// ============================================================================

makeAppWithSingleInstanceLock(async () => {
  const appStartTime = performance.now()
  console.log('[Startup] Application starting...')

  await app.whenReady()
  const readyTime = performance.now()
  console.log(
    `[Startup] App ready in ${(readyTime - appStartTime).toFixed(2)}ms`
  )

  // Initialize core services first (required for everything else)
  await initializeCoreServices()

  // Initialize AI and Agent services in parallel
  await Promise.all([initializeAIServices(), initializeAgentServices()])

  // Initialize agent executor (depends on agent services)
  await initializeAgentExecutor()

  // Initialize IPC handlers
  await initializeIPCHandlers()

  // Create and show window
  const window = await makeAppSetup(MainWindow)

  // Set main window for running projects service (for IPC events)
  runningProjectsService.setMainWindow(window)

  // Load dev tools deferred (doesn't block startup)
  loadDevTools(window)

  const totalTime = performance.now() - appStartTime
  console.log(
    `[Startup] Application fully initialized in ${totalTime.toFixed(2)}ms`
  )
})

// ============================================================================
// Cleanup on Quit
// ============================================================================

app.on('before-quit', async () => {
  console.log('[Shutdown] Application shutting down...')

  // Gracefully shutdown agent executor (stops running tasks, persists state)
  if (agentExecutorService) {
    try {
      await agentExecutorService.shutdown()
      console.log('[Shutdown] Agent executor shutdown complete')
    } catch (error) {
      console.error('[Shutdown] Error during agent executor shutdown:', error)
    }
  }

  // Stop request logger cleanup timer
  if (requestLogger) {
    requestLogger.stopPeriodicCleanup()
  }

  // Close database
  if (db) {
    db.close()
  }

  // Stop all running projects
  if (runningProjectsService) {
    try {
      await runningProjectsService.stopAll()
      console.log('[Shutdown] Running projects stopped')
    } catch (error) {
      console.error('[Shutdown] Error stopping running projects:', error)
    }
  }

  // Kill all PTY processes
  if (ptyManager) {
    ptyManager.killAll()
  }

  // Stop git telemetry refreshes
  if (gitService) {
    gitService.stopAllRefreshes()
  }
})
