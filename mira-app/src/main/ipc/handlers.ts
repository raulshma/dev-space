import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from 'shared/ipc-types'
import type {
  ProjectListRequest,
  ProjectGetRequest,
  ProjectCreateRequest,
  ProjectUpdateRequest,
  ProjectDeleteRequest,
  TagListRequest,
  TagCreateRequest,
  TagAddToProjectRequest,
  TagRemoveFromProjectRequest,
  GitTelemetryRequest,
  GitStartRefreshRequest,
  GitStopRefreshRequest,
  GitFileDiffRequest,
  PTYCreateRequest,
  PTYWriteRequest,
  PTYResizeRequest,
  PTYKillRequest,
  PTYPinRequest,
  PTYUnpinRequest,
  KeychainGetRequest,
  KeychainSetRequest,
  KeychainDeleteRequest,
  KeychainHasRequest,
  SessionSaveRequest,
  SessionRestoreRequest,
  CommandListRequest,
  CommandCreateRequest,
  BlueprintListRequest,
  BlueprintCreateRequest,
  BlueprintCaptureRequest,
  BlueprintApplyRequest,
  SettingGetRequest,
  SettingSetRequest,
  ShortcutListRequest,
  ShortcutSetRequest,
  ShellOpenExternalRequest,
  ShellOpenPathRequest,
  DialogOpenDirectoryRequest,
  // New AI Service types
  AIGenerateTextRequest,
  AIStreamTextRequest,
  AIGetModelsRequest,
  AISetDefaultModelRequest,
  AISetActionModelRequest,
  AIGetConversationRequest,
  AIClearConversationRequest,
  AIGetRequestLogsRequest,
  AIGetRequestLogRequest,
  // Agent Executor types
  AgentTaskCreateRequest,
  AgentTaskGetRequest,
  AgentTaskListRequest,
  AgentTaskUpdateRequest,
  AgentTaskDeleteRequest,
  AgentTaskStartRequest,
  AgentTaskPauseRequest,
  AgentTaskResumeRequest,
  AgentTaskRestartRequest,
  AgentTaskStopRequest,
  AgentTaskGetOutputRequest,
  // Agent Config types
  AgentConfigGetRequest,
  AgentConfigSetRequest,
  AgentConfigValidateRequest,
  AgentConfigIsConfiguredRequest,
} from 'shared/ipc-types'
import type { DatabaseService } from 'main/services/database'
import type { PTYManager } from 'main/services/pty-manager'
import type { GitService } from 'main/services/git-service'
import type { KeychainService } from 'main/services/keychain-service'
import { BlueprintService } from 'main/services/blueprint-service'
import { FilesService } from 'main/services/files-service'
import type { AIService } from 'main/services/ai-service'
import type { AgentExecutorService } from 'main/services/agent-executor-service'
import type { AgentConfigService } from 'main/services/agent/agent-config-service'
import type { JulesService } from 'main/services/agent/jules-service'
import type { RequestLogger } from 'main/services/ai/request-logger'
import { ScriptsService } from 'main/services/scripts-service'
import type {
  ScriptsGetRequest,
  FilesListRequest,
  FilesListShallowRequest,
  FilesReadRequest,
  FilesWriteRequest,
  CLIDetectRequest,
  CLIDetectAllRequest,
  CLIGetRecommendedRequest,
  CLIVerifyPathRequest,
  CLIClearCacheRequest,
  CLIType,
  // Running Projects types
  RunningProjectStartRequest,
  RunningProjectStopRequest,
  RunningProjectRestartRequest,
  RunningProjectListRequest,
  RunningProjectGetLogsRequest,
  RunningProjectSetDevCommandRequest,
  RunningProjectGetDevCommandRequest,
} from 'shared/ipc-types'
import { getCLIDetectorService } from 'main/services/cli-detector-service'
import type { RunningProjectsService } from 'main/services/running-projects-service'
import { getDevToolsService } from 'main/services/devtools-service'
import type {
  DevToolsPortListRequest,
  DevToolsPortKillRequest,
  DevToolsTaskListRequest,
  DevToolsTaskKillRequest,
  // Running Tasks types
  RunningTasksStopRequest,
  // Planning types
  TaskApprovePlanRequest,
  TaskRejectPlanRequest,
  // Worktree types
  WorktreeCreateRequest,
  WorktreeDeleteRequest,
  WorktreeListRequest,
  WorktreeGetForTaskRequest,
  // Dependency types
  TaskSetDependenciesRequest,
  TaskGetDependenciesRequest,
  TaskGetBlockingStatusRequest,
  // Agent Session types
  AgentSessionCreateRequest,
  AgentSessionGetRequest,
  AgentSessionListRequest,
  AgentSessionUpdateRequest,
  AgentSessionArchiveRequest,
  AgentSessionDeleteRequest,
  AgentSessionAddMessageRequest,
  AgentSessionGetMessagesRequest,
  AgentSessionGetLastRequest,
  AgentSessionSetLastRequest,
} from 'shared/ipc-types'
import type { GlobalProcessService } from 'main/services/global-process-service'
import type { WorktreeService } from 'main/services/worktree-service'
import type { DependencyManager } from 'main/services/dependency-manager'
import type { SessionService } from 'main/services/session-service'
import type { AgentServiceV2 } from 'main/services/agent-service-v2'
import type { AutoModeServiceV2 } from 'main/services/auto-mode-service-v2'
import type { OpencodeSdkService } from 'main/services/agent/opencode-sdk-service'
import type {
  AgentV2SessionCreateRequest,
  AgentV2SessionGetRequest,
  AgentV2SessionListRequest,
  AgentV2SessionUpdateRequest,
  AgentV2SessionArchiveRequest,
  AgentV2SessionDeleteRequest,
  AgentV2SessionClearRequest,
  AgentV2SendMessageRequest,
  AgentV2GetMessagesRequest,
  AgentV2StopExecutionRequest,
  AgentV2IsExecutingRequest,
  AutoModeV2StartRequest,
  AutoModeV2StopRequest,
  AutoModeV2GetStateRequest,
  AutoModeV2UpdateConfigRequest,
  AutoModeV2GetQueueRequest,
  AutoModeV2EnqueueFeatureRequest,
  AutoModeV2DequeueFeatureRequest,
  AutoModeV2ExecuteFeatureRequest,
  AutoModeV2StopFeatureRequest,
  AutoModeV2ApprovePlanRequest,
  AutoModeV2RejectPlanRequest,
  ThemeListRequest,
  ThemeGetRequest,
  ThemeCreateRequest,
  ThemeUpdateRequest,
  ThemeDeleteRequest,
  // OpenCode types
  OpencodeExecuteRequest,
  OpencodeStopRequest,
  OpencodeGetSessionsRequest,
  OpencodeGetMessagesRequest,
  OpencodeDeleteSessionRequest,
  OpencodeBackupConfigRequest,
  OpencodeRestoreConfigRequest,
  OpencodeWriteConfigRequest,
} from 'shared/ipc-types'

/**
 * IPC Handlers for Mira Developer Hub
 *
 * Sets up all IPC communication between main and renderer processes.
 * Validates requests and wires them to appropriate services.
 *
 * Requirements: 18.1, 18.2, 18.3
 */

export class IPCHandlers {
  private db: DatabaseService
  private ptyManager: PTYManager
  private gitService: GitService
  private keychainService: KeychainService
  private blueprintService: BlueprintService
  private filesService: FilesService
  private scriptsService: ScriptsService
  private aiService?: AIService
  private agentExecutorService?: AgentExecutorService
  private agentConfigService?: AgentConfigService
  private julesService?: JulesService
  private requestLogger?: RequestLogger
  private runningProjectsService?: RunningProjectsService
  private globalProcessService?: GlobalProcessService
  private worktreeService?: WorktreeService
  private dependencyManager?: DependencyManager
  private sessionService?: SessionService
  private agentServiceV2?: AgentServiceV2
  private autoModeServiceV2?: AutoModeServiceV2
  private opencodeSdkService?: OpencodeSdkService

  constructor(
    db: DatabaseService,
    ptyManager: PTYManager,
    gitService: GitService,
    keychainService: KeychainService,
    aiService?: AIService,
    agentExecutorService?: AgentExecutorService,
    agentConfigService?: AgentConfigService,
    julesService?: JulesService,
    requestLogger?: RequestLogger,
    runningProjectsService?: RunningProjectsService,
    agentServiceV2?: AgentServiceV2,
    autoModeServiceV2?: AutoModeServiceV2,
    globalProcessService?: GlobalProcessService,
    worktreeService?: WorktreeService,
    dependencyManager?: DependencyManager,
    sessionService?: SessionService,
    opencodeSdkService?: OpencodeSdkService
  ) {
    this.db = db
    this.ptyManager = ptyManager
    this.gitService = gitService
    this.keychainService = keychainService
    this.blueprintService = new BlueprintService()
    this.filesService = new FilesService()
    this.scriptsService = new ScriptsService()
    this.aiService = aiService
    this.agentExecutorService = agentExecutorService
    this.agentConfigService = agentConfigService
    this.julesService = julesService
    this.requestLogger = requestLogger
    this.runningProjectsService = runningProjectsService
    this.globalProcessService = globalProcessService
    this.worktreeService = worktreeService
    this.dependencyManager = dependencyManager
    this.sessionService = sessionService
    this.agentServiceV2 = agentServiceV2
    this.autoModeServiceV2 = autoModeServiceV2
    this.opencodeSdkService = opencodeSdkService
  }

  /**
   * Register all IPC handlers
   */
  registerHandlers(): void {
    this.registerFilesHandlers()
    this.registerProjectHandlers()
    this.registerTagHandlers()
    this.registerGitHandlers()
    this.registerPTYHandlers()
    this.registerKeychainHandlers()
    this.registerSessionHandlers()
    this.registerCommandHandlers()
    this.registerBlueprintHandlers()
    this.registerSettingsHandlers()
    this.registerShortcutHandlers()
    this.registerShellHandlers()
    this.registerThemeHandlers()
    this.registerScriptsHandlers()
    this.registerDialogHandlers()
    // New AI service handlers
    this.registerAIServiceHandlers()
    this.registerAgentExecutorHandlers()
    this.registerAgentConfigHandlers()
    this.registerJulesHandlers()
    this.registerJulesEventForwarding()
    this.registerCLIDetectorHandlers()
    this.registerRunningProjectsHandlers()
    this.registerDevToolsHandlers()
    // Agent enhancement handlers
    this.registerRunningTasksHandlers()
    this.registerPlanningHandlers()
    this.registerWorktreeHandlers()
    this.registerDependencyHandlers()
    this.registerAgentSessionHandlers()
    // V2 service handlers (Claude SDK integration)
    this.registerAgentServiceV2Handlers()
    this.registerAutoModeServiceV2Handlers()
    // OpenCode SDK handlers
    this.registerOpencodeHandlers()
  }

  /**
   * Set up event forwarding for Jules status updates
   */
  private registerJulesEventForwarding(): void {
    if (!this.agentExecutorService) return

    // Forward Jules status updates to all renderer windows
    this.agentExecutorService.on(
      'julesStatusUpdate',
      (
        taskId: string,
        status: import('shared/notification-types').JulesSessionStatus
      ) => {
        const windows = BrowserWindow.getAllWindows()
        for (const window of windows) {
          window.webContents.send(IPC_CHANNELS.JULES_STATUS_UPDATE, {
            taskId,
            status,
          })
        }
      }
    )
  }

  /**
   * File system operation handlers
   */
  private registerFilesHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.FILES_LIST,
      async (_event, request: FilesListRequest) => {
        try {
          const files = await this.filesService.listDirectory(
            request.path,
            request.maxDepth ?? 3
          )
          return { files }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.FILES_LIST_SHALLOW,
      async (_event, request: FilesListShallowRequest) => {
        try {
          const files = await this.filesService.listDirectoryShallow(
            request.path
          )
          return { files }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.FILES_READ,
      async (_event, request: FilesReadRequest) => {
        try {
          const result = await this.filesService.readFileContent(
            request.path,
            request.maxSize
          )
          return result
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.FILES_WRITE,
      async (_event, request: FilesWriteRequest) => {
        try {
          const result = await this.filesService.writeFileContent(
            request.path,
            request.content
          )
          return result
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Project operation handlers
   */
  private registerProjectHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.PROJECT_LIST,
      async (_event, request: ProjectListRequest) => {
        try {
          const projects = this.db.getProjects(request.filter)
          return {
            projects,
            totalCount: projects.length,
          }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.PROJECT_GET,
      async (_event, request: ProjectGetRequest) => {
        try {
          const project = this.db.getProject(request.id)
          return { project }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.PROJECT_CREATE,
      async (_event, request: ProjectCreateRequest) => {
        try {
          const project = this.db.createProject(request.data)
          return { project }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.PROJECT_UPDATE,
      async (_event, request: ProjectUpdateRequest) => {
        try {
          const project = this.db.updateProject(request.id, request.data)
          return { project }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.PROJECT_DELETE,
      async (_event, request: ProjectDeleteRequest) => {
        try {
          this.db.deleteProject(request.id)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Tag operation handlers
   */
  private registerTagHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.TAG_LIST,
      async (_event, _request: TagListRequest) => {
        try {
          const tags = this.db.getTags()
          return { tags }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.TAG_CREATE,
      async (_event, request: TagCreateRequest) => {
        try {
          const tag = this.db.createTag(request.data)
          return { tag }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.TAG_ADD_TO_PROJECT,
      async (_event, request: TagAddToProjectRequest) => {
        try {
          this.db.addTagToProject(request.projectId, request.tagId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.TAG_REMOVE_FROM_PROJECT,
      async (_event, request: TagRemoveFromProjectRequest) => {
        try {
          this.db.removeTagFromProject(request.projectId, request.tagId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Git operation handlers
   */
  private registerGitHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.GIT_TELEMETRY,
      async (_event, request: GitTelemetryRequest) => {
        try {
          const telemetry = await this.gitService.getTelemetry(
            request.projectPath
          )
          return { telemetry }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.GIT_START_REFRESH,
      async (_event, request: GitStartRefreshRequest) => {
        try {
          // Get project to find its path
          const project = this.db.getProject(request.projectId)
          if (!project) {
            throw new Error(`Project ${request.projectId} not found`)
          }

          this.gitService.startBackgroundRefresh(
            request.projectId,
            project.path,
            request.interval
          )
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.GIT_STOP_REFRESH,
      async (_event, request: GitStopRefreshRequest) => {
        try {
          this.gitService.stopBackgroundRefresh(request.projectId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.GIT_FILE_DIFF,
      async (_event, request: GitFileDiffRequest) => {
        try {
          const { original, modified, language } =
            await this.gitService.getFileDiff(
              request.projectPath,
              request.filePath,
              request.staged
            )
          return { original, modified, language, filePath: request.filePath }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * PTY/Terminal operation handlers
   */
  private registerPTYHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.PTY_CREATE,
      async (event, request: PTYCreateRequest) => {
        try {
          const ptyId = this.ptyManager.create({
            cwd: request.cwd,
            shell: request.shell,
          })

          // Set up data and exit event forwarding to renderer
          this.ptyManager.onData(ptyId, (data: string) => {
            event.sender.send(`${IPC_CHANNELS.PTY_DATA}:${ptyId}`, data)
          })

          this.ptyManager.onExit(ptyId, (code: number) => {
            event.sender.send(`${IPC_CHANNELS.PTY_EXIT}:${ptyId}`, code)
          })

          return { ptyId }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.PTY_WRITE,
      async (_event, request: PTYWriteRequest) => {
        try {
          this.ptyManager.write(request.ptyId, request.data)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.PTY_RESIZE,
      async (_event, request: PTYResizeRequest) => {
        try {
          this.ptyManager.resize(request.ptyId, request.cols, request.rows)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.PTY_KILL,
      async (_event, request: PTYKillRequest) => {
        try {
          this.ptyManager.kill(request.ptyId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(IPC_CHANNELS.PTY_KILL_ALL, async () => {
      try {
        this.ptyManager.killAll()
        return { success: true }
      } catch (error) {
        return this.handleError(error)
      }
    })

    ipcMain.handle(
      IPC_CHANNELS.PTY_PIN,
      async (_event, request: PTYPinRequest) => {
        try {
          // Extract projectId from request - we'll need to enhance the request type
          // For now, we'll use a placeholder
          this.ptyManager.pin(request.ptyId, 'unknown')
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.PTY_UNPIN,
      async (_event, request: PTYUnpinRequest) => {
        try {
          this.ptyManager.unpin(request.ptyId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(IPC_CHANNELS.PTY_GET_PINNED, async () => {
      try {
        const processes = this.ptyManager.getPinnedProcesses()
        return { processes }
      } catch (error) {
        return this.handleError(error)
      }
    })
  }

  /**
   * Keychain operation handlers
   */
  private registerKeychainHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.KEYCHAIN_GET,
      async (_event, request: KeychainGetRequest) => {
        try {
          const key = await this.keychainService.getApiKey(request.provider)
          return { key }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.KEYCHAIN_SET,
      async (_event, request: KeychainSetRequest) => {
        try {
          await this.keychainService.setApiKey(request.provider, request.key)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.KEYCHAIN_DELETE,
      async (_event, request: KeychainDeleteRequest) => {
        try {
          await this.keychainService.deleteApiKey(request.provider)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.KEYCHAIN_HAS,
      async (_event, request: KeychainHasRequest) => {
        try {
          const hasKey = await this.keychainService.hasApiKey(request.provider)
          return { hasKey }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Session operation handlers
   */
  private registerSessionHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.SESSION_SAVE,
      async (_event, request: SessionSaveRequest) => {
        try {
          this.db.saveSession(request.projectId, request.state)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.SESSION_RESTORE,
      async (_event, request: SessionRestoreRequest) => {
        try {
          const state = this.db.getSession(request.projectId)
          return { state }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(IPC_CHANNELS.SESSION_CLEAR_ALL, async () => {
      try {
        this.db.clearAllSessions()
        return { success: true }
      } catch (error) {
        return this.handleError(error)
      }
    })
  }

  /**
   * Command library operation handlers
   */
  private registerCommandHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.COMMAND_LIST,
      async (_event, _request: CommandListRequest) => {
        try {
          const commands = this.db.getCommands()
          return { commands }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.COMMAND_CREATE,
      async (_event, request: CommandCreateRequest) => {
        try {
          const command = this.db.createCommand(request.data)
          return { command }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Blueprint operation handlers
   */
  private registerBlueprintHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.BLUEPRINT_LIST,
      async (_event, _request: BlueprintListRequest) => {
        try {
          const blueprints = this.db.getBlueprints()
          return { blueprints }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.BLUEPRINT_CREATE,
      async (_event, request: BlueprintCreateRequest) => {
        try {
          const blueprint = this.db.createBlueprint(request.data)
          return { blueprint }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.BLUEPRINT_CAPTURE,
      async (_event, request: BlueprintCaptureRequest) => {
        try {
          const structure = this.blueprintService.captureBlueprint(
            request.projectPath,
            request.customExcludePatterns
          )
          return { structure }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.BLUEPRINT_APPLY,
      async (_event, request: BlueprintApplyRequest) => {
        try {
          // Get the blueprint from database
          const blueprints = this.db.getBlueprints()
          const blueprint = blueprints.find(b => b.id === request.blueprintId)

          if (!blueprint) {
            throw new Error(`Blueprint ${request.blueprintId} not found`)
          }

          // Apply the blueprint
          this.blueprintService.applyBlueprint(
            blueprint.structure,
            request.targetPath
          )
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Settings operation handlers
   */
  private registerSettingsHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.SETTING_GET,
      async (_event, request: SettingGetRequest) => {
        try {
          const value = this.db.getSetting(request.key)
          return { value }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.SETTING_SET,
      async (_event, request: SettingSetRequest) => {
        try {
          this.db.setSetting(request.key, request.value)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Shortcut operation handlers
   */
  private registerShortcutHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.SHORTCUT_LIST,
      async (_event, _request: ShortcutListRequest) => {
        try {
          const shortcuts = this.db.getShortcuts()
          return { shortcuts }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.SHORTCUT_SET,
      async (_event, request: ShortcutSetRequest) => {
        try {
          const success = this.db.setShortcut(request.action, request.binding)
          if (!success) {
            return {
              error: 'Shortcut conflict detected',
              code: 'SHORTCUT_CONFLICT',
            }
          }
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Shell operation handlers
   */
  private registerShellHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.SHELL_OPEN_EXTERNAL,
      async (_event, request: ShellOpenExternalRequest) => {
        try {
          await shell.openExternal(request.url)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.SHELL_OPEN_PATH,
      async (_event, request: ShellOpenPathRequest) => {
        try {
          await shell.openPath(request.path)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Scripts operation handlers
   */
  private registerScriptsHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.SCRIPTS_GET,
      async (_event, request: ScriptsGetRequest) => {
        try {
          const result = this.scriptsService.getScripts(request.projectPath)
          return result
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Dialog operation handlers
   */
  private registerDialogHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.DIALOG_OPEN_DIRECTORY,
      async (_event, request: DialogOpenDirectoryRequest) => {
        try {
          const focusedWindow = BrowserWindow.getFocusedWindow()
          const result = await dialog.showOpenDialog(
            focusedWindow ?? (undefined as unknown as BrowserWindow),
            {
              title: request.title ?? 'Select Directory',
              defaultPath: request.defaultPath,
              properties: ['openDirectory'],
            }
          )
          return {
            path: result.filePaths[0] ?? null,
            canceled: result.canceled,
          }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * AI Service operation handlers (Vercel AI SDK)
   * Requirements: 1.2, 1.3, 3.1, 3.3, 4.5
   */
  private registerAIServiceHandlers(): void {
    // Generate text (non-streaming)
    ipcMain.handle(
      IPC_CHANNELS.AI_GENERATE_TEXT,
      async (_event, request: AIGenerateTextRequest) => {
        try {
          if (!this.aiService) {
            return {
              error: 'AI service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const result = await this.aiService.generateText({
            projectId: request.projectId,
            content: request.content,
            action: request.action,
            systemPrompt: request.systemPrompt,
          })
          return {
            text: result.text,
            usage: result.usage,
            model: result.model,
            finishReason: result.finishReason,
          }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Stream text generation
    ipcMain.handle(
      IPC_CHANNELS.AI_STREAM_TEXT,
      async (event, request: AIStreamTextRequest) => {
        try {
          if (!this.aiService) {
            return {
              error: 'AI service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }

          // Start streaming in background
          const streamId = request.streamId
          const sender = event.sender

          // Run streaming asynchronously
          ;(async () => {
            try {
              if (!this.aiService) {
                throw new Error('AI service not initialized')
              }
              const stream = this.aiService.streamText({
                projectId: request.projectId,
                content: request.content,
                action: request.action,
                systemPrompt: request.systemPrompt,
              })

              for await (const chunk of stream) {
                sender.send(IPC_CHANNELS.AI_STREAM_TEXT_CHUNK, {
                  streamId,
                  text: chunk.text,
                  isComplete: chunk.isComplete,
                  usage: chunk.usage,
                })
              }
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Unknown error'
              sender.send(IPC_CHANNELS.AI_STREAM_TEXT_CHUNK, {
                streamId,
                text: '',
                isComplete: true,
                error: message,
              })
            }
          })()

          return { streamId, started: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get available models
    ipcMain.handle(
      IPC_CHANNELS.AI_GET_MODELS,
      async (_event, _request: AIGetModelsRequest) => {
        try {
          if (!this.aiService) {
            return {
              error: 'AI service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const models = await this.aiService.getAvailableModels()
          const defaultModelId = this.aiService.getDefaultModelId()
          const actionModelsMap = this.aiService.getActionModels()

          // Convert Map to Record for IPC serialization
          const actionModels: Record<string, string> = {}
          actionModelsMap.forEach((modelId, action) => {
            actionModels[action] = modelId
          })

          return {
            models,
            defaultModelId,
            actionModels,
          }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Set default model
    ipcMain.handle(
      IPC_CHANNELS.AI_SET_DEFAULT_MODEL,
      async (_event, request: AISetDefaultModelRequest) => {
        try {
          if (!this.aiService) {
            return {
              error: 'AI service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.aiService.setDefaultModel(request.modelId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Set action-specific model
    ipcMain.handle(
      IPC_CHANNELS.AI_SET_ACTION_MODEL,
      async (_event, request: AISetActionModelRequest) => {
        try {
          if (!this.aiService) {
            return {
              error: 'AI service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.aiService.setActionModel(request.action, request.modelId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get conversation
    ipcMain.handle(
      IPC_CHANNELS.AI_GET_CONVERSATION,
      async (_event, request: AIGetConversationRequest) => {
        try {
          if (!this.aiService) {
            return {
              error: 'AI service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const messages = this.aiService.getConversation(request.projectId)
          return { messages }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Clear conversation
    ipcMain.handle(
      IPC_CHANNELS.AI_CLEAR_CONVERSATION,
      async (_event, request: AIClearConversationRequest) => {
        try {
          if (!this.aiService) {
            return {
              error: 'AI service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          this.aiService.clearConversation(request.projectId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get request logs
    ipcMain.handle(
      IPC_CHANNELS.AI_GET_REQUEST_LOGS,
      async (_event, request: AIGetRequestLogsRequest) => {
        try {
          if (!this.requestLogger) {
            return {
              error: 'Request logger not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const logs = this.requestLogger.getLogs(request.filter)
          return { logs }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get single request log
    ipcMain.handle(
      IPC_CHANNELS.AI_GET_REQUEST_LOG,
      async (_event, request: AIGetRequestLogRequest) => {
        try {
          if (!this.requestLogger) {
            return {
              error: 'Request logger not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const log = this.requestLogger.getLog(request.logId)
          return { log }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Agent Executor operation handlers
   * Requirements: 6.1, 7.1, 8.1, 9.2, 10.1
   */
  private registerAgentExecutorHandlers(): void {
    // Create task
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_CREATE,
      async (_event, request: AgentTaskCreateRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const task = await this.agentExecutorService.createTask({
            description: request.description,
            agentType: request.agentType,
            targetDirectory: request.targetDirectory,
            parameters: request.parameters,
            priority: request.priority,
            serviceType: request.serviceType,
            julesParams: request.julesParams,
            planningMode: request.planningMode,
            requirePlanApproval: request.requirePlanApproval,
          })
          return { task }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get task
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_GET,
      async (_event, request: AgentTaskGetRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const task = this.agentExecutorService.getTask(request.taskId)
          return { task: task ?? null }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // List tasks
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_LIST,
      async (_event, request: AgentTaskListRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const tasks = this.agentExecutorService.getTasks(request.filter)
          return { tasks }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Update task
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_UPDATE,
      async (_event, request: AgentTaskUpdateRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const task = await this.agentExecutorService.updateTask(
            request.taskId,
            request.updates
          )
          return { task }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Delete task
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_DELETE,
      async (_event, request: AgentTaskDeleteRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.agentExecutorService.deleteTask(request.taskId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Start task
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_START,
      async (_event, request: AgentTaskStartRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.agentExecutorService.startTask(request.taskId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Pause task
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_PAUSE,
      async (_event, request: AgentTaskPauseRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.agentExecutorService.pauseTask(request.taskId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Resume task
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_RESUME,
      async (_event, request: AgentTaskResumeRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.agentExecutorService.resumeTask(request.taskId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Restart task (with optional session resume)
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_RESTART,
      async (_event, request: AgentTaskRestartRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const result = await this.agentExecutorService.restartTask(
            request.taskId,
            request.resumeSession ?? true,
            request.forkSession ?? false
          )
          return { success: true, sessionId: result.sessionId }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Stop task
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_STOP,
      async (_event, request: AgentTaskStopRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.agentExecutorService.stopTask(request.taskId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get task output (from memory buffer)
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_GET_OUTPUT,
      async (_event, request: AgentTaskGetOutputRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const output = this.agentExecutorService.getTaskOutput(request.taskId)
          return { output }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Load task output from database (for persisted tasks)
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_LOAD_OUTPUT,
      async (_event, request: AgentTaskGetOutputRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const output = await this.agentExecutorService.loadTaskOutput(
            request.taskId
          )
          return { output }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Subscribe to output streaming
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_SUBSCRIBE_OUTPUT,
      async (event, request: AgentTaskGetOutputRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }

          const sender = event.sender
          const taskId = request.taskId

          // Subscribe to output updates
          this.agentExecutorService.subscribeToOutput(
            taskId,
            (line: import('shared/ai-types').OutputLine) => {
              sender.send(IPC_CHANNELS.AGENT_TASK_OUTPUT_STREAM, {
                taskId,
                line,
              })
            }
          )

          // Note: In a real implementation, you'd want to track these
          // and clean them up when the renderer disconnects

          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Agent Configuration operation handlers
   * Requirements: 5.1, 5.2, 5.5
   */
  private registerAgentConfigHandlers(): void {
    // Get configuration
    ipcMain.handle(
      IPC_CHANNELS.AGENT_CONFIG_GET,
      async (_event, _request: AgentConfigGetRequest) => {
        try {
          if (!this.agentConfigService) {
            return {
              error: 'Agent config service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const config = await this.agentConfigService.getConfig()
          return { config }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Set configuration
    ipcMain.handle(
      IPC_CHANNELS.AGENT_CONFIG_SET,
      async (_event, request: AgentConfigSetRequest) => {
        try {
          if (!this.agentConfigService) {
            return {
              error: 'Agent config service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.agentConfigService.setConfig(request.updates)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Validate configuration
    ipcMain.handle(
      IPC_CHANNELS.AGENT_CONFIG_VALIDATE,
      async (_event, request: AgentConfigValidateRequest) => {
        try {
          if (!this.agentConfigService) {
            return {
              error: 'Agent config service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const result = this.agentConfigService.validateConfig(request.config)
          return { result }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Check if configured
    ipcMain.handle(
      IPC_CHANNELS.AGENT_CONFIG_IS_CONFIGURED,
      async (_event, _request: AgentConfigIsConfiguredRequest) => {
        try {
          if (!this.agentConfigService) {
            return {
              error: 'Agent config service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const isConfigured = await this.agentConfigService.isConfigured()
          return { isConfigured }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get configured services
    ipcMain.handle(
      IPC_CHANNELS.AGENT_CONFIG_GET_CONFIGURED_SERVICES,
      async () => {
        try {
          if (!this.agentConfigService) {
            return {
              services: [],
              error: 'Agent config service not initialized',
            }
          }
          const services = await this.agentConfigService.getConfiguredServices()
          return { services }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Jules operation handlers
   */
  private registerJulesHandlers(): void {
    // List available sources
    ipcMain.handle(IPC_CHANNELS.JULES_LIST_SOURCES, async () => {
      try {
        if (!this.julesService) {
          return {
            sources: [],
            error: 'Jules service not initialized',
          }
        }
        const sources = await this.julesService.listSources()
        return { sources }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return {
          sources: [],
          error: message,
        }
      }
    })

    // Approve plan for a Jules session
    ipcMain.handle(
      IPC_CHANNELS.JULES_APPROVE_PLAN,
      async (
        _event,
        request: import('shared/ipc-types').JulesApprovePlanRequest
      ) => {
        try {
          if (!this.julesService) {
            return { success: false, error: 'Jules service not initialized' }
          }
          await this.julesService.approvePlan(request.sessionId)
          return { success: true }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return { success: false, error: message }
        }
      }
    )

    // Send message to a Jules session
    ipcMain.handle(
      IPC_CHANNELS.JULES_SEND_MESSAGE,
      async (
        _event,
        request: import('shared/ipc-types').JulesSendMessageRequest
      ) => {
        try {
          if (!this.julesService) {
            return { success: false, error: 'Jules service not initialized' }
          }
          await this.julesService.sendMessage(
            request.sessionId,
            request.message
          )
          return { success: true }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return { success: false, error: message }
        }
      }
    )

    // Resync a Jules task (fetch latest status)
    ipcMain.handle(
      IPC_CHANNELS.JULES_RESYNC_TASK,
      async (
        _event,
        request: import('shared/ipc-types').JulesResyncTaskRequest
      ) => {
        try {
          if (!this.agentExecutorService) {
            return { success: false, error: 'Agent executor not initialized' }
          }
          const status = await this.agentExecutorService.resyncJulesTask(
            request.taskId
          )
          return { success: true, status }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return { success: false, error: message }
        }
      }
    )

    // Get session status for a Jules task
    ipcMain.handle(
      IPC_CHANNELS.JULES_GET_SESSION_STATUS,
      async (
        _event,
        request: import('shared/ipc-types').JulesGetSessionStatusRequest
      ) => {
        try {
          if (!this.agentExecutorService) {
            return { status: null, error: 'Agent executor not initialized' }
          }
          const status = await this.agentExecutorService.getJulesTaskStatus(
            request.taskId
          )
          return { status }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return { status: null, error: message }
        }
      }
    )

    // Get activities for a Jules task
    ipcMain.handle(
      IPC_CHANNELS.JULES_GET_ACTIVITIES,
      async (
        _event,
        request: import('shared/ipc-types').JulesGetActivitiesRequest
      ) => {
        try {
          if (!this.agentExecutorService) {
            return { activities: [], error: 'Agent executor not initialized' }
          }
          const activities = await this.agentExecutorService.getJulesActivities(
            request.taskId
          )
          return { activities }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return { activities: [], error: message }
        }
      }
    )
  }

  /**
   * CLI Detection operation handlers
   */
  private registerCLIDetectorHandlers(): void {
    const cliDetector = getCLIDetectorService()

    // Detect a specific CLI
    ipcMain.handle(
      IPC_CHANNELS.CLI_DETECT,
      async (_event, request: CLIDetectRequest) => {
        try {
          const result = await cliDetector.detect(
            request.cliType,
            request.useCache ?? true
          )
          return { result }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Detect all supported CLIs
    ipcMain.handle(
      IPC_CHANNELS.CLI_DETECT_ALL,
      async (_event, _request: CLIDetectAllRequest) => {
        try {
          const resultsMap = await cliDetector.detectAll()
          // Convert Map to plain object for IPC serialization
          const results: Record<
            CLIType,
            import('shared/ipc-types').CLIDetectionResult
          > = {} as Record<
            CLIType,
            import('shared/ipc-types').CLIDetectionResult
          >
          for (const [key, value] of resultsMap) {
            results[key] = value
          }
          return { results }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get recommended path for a CLI
    ipcMain.handle(
      IPC_CHANNELS.CLI_GET_RECOMMENDED,
      async (_event, request: CLIGetRecommendedRequest) => {
        try {
          const path = await cliDetector.getRecommendedPath(request.cliType)
          return { path: path ?? null }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Verify a specific path is valid for a CLI type
    ipcMain.handle(
      IPC_CHANNELS.CLI_VERIFY_PATH,
      async (_event, request: CLIVerifyPathRequest) => {
        try {
          const valid = await cliDetector.verifyPath(
            request.cliType,
            request.path
          )
          return { valid }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Clear the detection cache
    ipcMain.handle(
      IPC_CHANNELS.CLI_CLEAR_CACHE,
      async (_event, _request: CLIClearCacheRequest) => {
        try {
          cliDetector.clearCache()
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Running Projects operation handlers
   */
  private registerRunningProjectsHandlers(): void {
    // Start a project's dev server
    ipcMain.handle(
      IPC_CHANNELS.RUNNING_PROJECT_START,
      async (_event, request: RunningProjectStartRequest) => {
        try {
          if (!this.runningProjectsService) {
            return {
              error: 'Running projects service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          // Get project details from database
          const project = this.db.getProject(request.projectId)
          if (!project) {
            return { error: 'Project not found', code: 'PROJECT_NOT_FOUND' }
          }
          const runningProject = await this.runningProjectsService.start(
            request.projectId,
            project.name,
            project.path,
            request.devCommand
          )
          return { project: runningProject }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Stop a running project
    ipcMain.handle(
      IPC_CHANNELS.RUNNING_PROJECT_STOP,
      async (_event, request: RunningProjectStopRequest) => {
        try {
          if (!this.runningProjectsService) {
            return {
              error: 'Running projects service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const success = await this.runningProjectsService.stop(
            request.projectId
          )
          return { success }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Restart a running project
    ipcMain.handle(
      IPC_CHANNELS.RUNNING_PROJECT_RESTART,
      async (_event, request: RunningProjectRestartRequest) => {
        try {
          if (!this.runningProjectsService) {
            return {
              error: 'Running projects service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const project = await this.runningProjectsService.restart(
            request.projectId
          )
          return { project }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // List all running projects
    ipcMain.handle(
      IPC_CHANNELS.RUNNING_PROJECT_LIST,
      async (_event, _request: RunningProjectListRequest) => {
        try {
          if (!this.runningProjectsService) {
            return {
              error: 'Running projects service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const projects = this.runningProjectsService.list()
          return { projects }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get logs for a running project
    ipcMain.handle(
      IPC_CHANNELS.RUNNING_PROJECT_GET_LOGS,
      async (_event, request: RunningProjectGetLogsRequest) => {
        try {
          if (!this.runningProjectsService) {
            return {
              error: 'Running projects service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const logs = this.runningProjectsService.getLogs(
            request.projectId,
            request.lines
          )
          return { logs }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Set dev command for a project
    ipcMain.handle(
      IPC_CHANNELS.RUNNING_PROJECT_SET_DEV_COMMAND,
      async (_event, request: RunningProjectSetDevCommandRequest) => {
        try {
          if (!this.runningProjectsService) {
            return {
              error: 'Running projects service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          this.runningProjectsService.setDevCommand(
            request.projectId,
            request.devCommand
          )
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get dev command for a project
    ipcMain.handle(
      IPC_CHANNELS.RUNNING_PROJECT_GET_DEV_COMMAND,
      async (_event, request: RunningProjectGetDevCommandRequest) => {
        try {
          if (!this.runningProjectsService) {
            return {
              error: 'Running projects service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const devCommand = this.runningProjectsService.getDevCommand(
            request.projectId
          )
          return { devCommand }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * DevTools operation handlers
   */
  private registerDevToolsHandlers(): void {
    const devToolsService = getDevToolsService()

    // List ports
    ipcMain.handle(
      IPC_CHANNELS.DEVTOOLS_PORT_LIST,
      async (_event, request: DevToolsPortListRequest) => {
        try {
          return await devToolsService.listPorts(request.filter)
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Kill port
    ipcMain.handle(
      IPC_CHANNELS.DEVTOOLS_PORT_KILL,
      async (_event, request: DevToolsPortKillRequest) => {
        try {
          return await devToolsService.killPort(request.port)
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // List tasks
    ipcMain.handle(
      IPC_CHANNELS.DEVTOOLS_TASK_LIST,
      async (_event, request: DevToolsTaskListRequest) => {
        try {
          return await devToolsService.listTasks(request.filter)
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Kill task
    ipcMain.handle(
      IPC_CHANNELS.DEVTOOLS_TASK_KILL,
      async (_event, request: DevToolsTaskKillRequest) => {
        try {
          return await devToolsService.killTask(request.pid, request.force)
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Running Tasks Global View operation handlers
   * Requirements: 2.1, 2.4
   */
  private registerRunningTasksHandlers(): void {
    // Get all running tasks
    ipcMain.handle(IPC_CHANNELS.RUNNING_TASKS_GET_ALL, async () => {
      try {
        if (!this.globalProcessService) {
          return {
            error: 'Global process service not initialized',
            code: 'SERVICE_NOT_INITIALIZED',
          }
        }
        const tasks = this.globalProcessService.getRunningTasks()
        return { tasks }
      } catch (error) {
        return this.handleError(error)
      }
    })

    // Stop a running task
    ipcMain.handle(
      IPC_CHANNELS.RUNNING_TASKS_STOP,
      async (_event, request: RunningTasksStopRequest) => {
        try {
          if (!this.globalProcessService) {
            return {
              error: 'Global process service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.globalProcessService.stopTask(request.taskId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Set up event forwarding for running tasks updates
    if (this.globalProcessService) {
      this.globalProcessService.on(
        'tasksUpdated',
        (
          tasks: Array<{
            taskId: string
            projectPath: string
            projectName: string
            description: string
            status: import('shared/ai-types').TaskStatus
            startedAt: Date
            isAutoMode: boolean
          }>
        ) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.RUNNING_TASKS_UPDATED, {
              tasks,
            })
          }
        }
      )
    }
  }

  /**
   * Planning Mode operation handlers
   * Requirements: 3.7, 3.8
   */
  private registerPlanningHandlers(): void {
    // Approve plan
    ipcMain.handle(
      IPC_CHANNELS.TASK_APPROVE_PLAN,
      async (_event, request: TaskApprovePlanRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const task = await this.agentExecutorService.approvePlan(
            request.taskId
          )
          return { task }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Reject plan
    ipcMain.handle(
      IPC_CHANNELS.TASK_REJECT_PLAN,
      async (_event, request: TaskRejectPlanRequest) => {
        try {
          if (!this.agentExecutorService) {
            return {
              error: 'Agent executor service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const task = await this.agentExecutorService.rejectPlan(
            request.taskId,
            request.feedback
          )
          return { task }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Set up event forwarding for plan generation
    if (this.agentExecutorService) {
      this.agentExecutorService.on(
        'planGenerated',
        (taskId: string, plan: import('shared/ai-types').PlanSpec) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.TASK_PLAN_GENERATED, {
              taskId,
              plan,
            })
          }
        }
      )
    }
  }

  /**
   * Worktree operation handlers
   * Requirements: 4.2, 4.3, 4.6
   */
  private registerWorktreeHandlers(): void {
    // Create worktree
    ipcMain.handle(
      IPC_CHANNELS.WORKTREE_CREATE,
      async (_event, request: WorktreeCreateRequest) => {
        try {
          if (!this.worktreeService) {
            return {
              error: 'Worktree service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const worktree = await this.worktreeService.createWorktree(
            request.projectPath,
            request.branchName,
            request.taskId
          )
          return { worktree }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Delete worktree
    ipcMain.handle(
      IPC_CHANNELS.WORKTREE_DELETE,
      async (_event, request: WorktreeDeleteRequest) => {
        try {
          if (!this.worktreeService) {
            return {
              error: 'Worktree service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.worktreeService.deleteWorktree(request.worktreePath)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // List worktrees
    ipcMain.handle(
      IPC_CHANNELS.WORKTREE_LIST,
      async (_event, request: WorktreeListRequest) => {
        try {
          if (!this.worktreeService) {
            return {
              error: 'Worktree service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const worktrees = await this.worktreeService.listWorktrees(
            request.projectPath
          )
          return { worktrees }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get worktree for task
    ipcMain.handle(
      IPC_CHANNELS.WORKTREE_GET_FOR_TASK,
      async (_event, request: WorktreeGetForTaskRequest) => {
        try {
          if (!this.worktreeService) {
            return {
              error: 'Worktree service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const worktree = this.worktreeService.getWorktreeForTask(
            request.taskId
          )
          return { worktree }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Task Dependency operation handlers
   * Requirements: 5.1, 5.2
   */
  private registerDependencyHandlers(): void {
    // Set dependencies
    ipcMain.handle(
      IPC_CHANNELS.TASK_SET_DEPENDENCIES,
      async (_event, request: TaskSetDependenciesRequest) => {
        try {
          if (!this.dependencyManager) {
            return {
              error: 'Dependency manager not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          this.dependencyManager.setDependencies(
            request.taskId,
            request.dependsOn
          )
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get dependencies
    ipcMain.handle(
      IPC_CHANNELS.TASK_GET_DEPENDENCIES,
      async (_event, request: TaskGetDependenciesRequest) => {
        try {
          if (!this.dependencyManager) {
            return {
              error: 'Dependency manager not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const dependencies = this.dependencyManager.getDependencies(
            request.taskId
          )
          return { dependencies }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get blocking status
    ipcMain.handle(
      IPC_CHANNELS.TASK_GET_BLOCKING_STATUS,
      async (_event, request: TaskGetBlockingStatusRequest) => {
        try {
          if (!this.dependencyManager) {
            return {
              error: 'Dependency manager not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }

          // Check if dependency blocking is enabled in settings
          const dependencyBlockingEnabled = this.db.getSetting(
            'tasks.dependencyBlockingEnabled'
          )

          // If blocking is disabled, return not blocked
          if (dependencyBlockingEnabled === 'false') {
            return {
              status: {
                taskId: request.taskId,
                isBlocked: false,
                blockingTasks: [],
                failedDependencies: [],
              },
            }
          }

          const status = this.dependencyManager.getBlockingStatus(
            request.taskId
          )
          return { status }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Agent Session Persistence operation handlers
   * Requirements: 6.1, 6.3, 6.4, 6.8, 6.9, 6.10
   */
  private registerAgentSessionHandlers(): void {
    // Create session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_SESSION_CREATE,
      async (_event, request: AgentSessionCreateRequest) => {
        try {
          if (!this.sessionService) {
            return {
              error: 'Session service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const session = await this.sessionService.createSession(
            request.projectPath,
            request.name,
            request.modelId
          )
          return { session }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_SESSION_GET,
      async (_event, request: AgentSessionGetRequest) => {
        try {
          if (!this.sessionService) {
            return {
              error: 'Session service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const session = this.sessionService.getSession(request.sessionId)
          return { session }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // List sessions
    ipcMain.handle(
      IPC_CHANNELS.AGENT_SESSION_LIST,
      async (_event, request: AgentSessionListRequest) => {
        try {
          if (!this.sessionService) {
            return {
              error: 'Session service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const sessions = this.sessionService.getSessions(
            request.projectPath,
            request.includeArchived
          )
          return { sessions }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Update session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_SESSION_UPDATE,
      async (_event, request: AgentSessionUpdateRequest) => {
        try {
          if (!this.sessionService) {
            return {
              error: 'Session service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const session = await this.sessionService.updateSession(
            request.sessionId,
            request.updates
          )
          return { session }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Archive session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_SESSION_ARCHIVE,
      async (_event, request: AgentSessionArchiveRequest) => {
        try {
          if (!this.sessionService) {
            return {
              error: 'Session service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.sessionService.archiveSession(request.sessionId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Delete session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_SESSION_DELETE,
      async (_event, request: AgentSessionDeleteRequest) => {
        try {
          if (!this.sessionService) {
            return {
              error: 'Session service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.sessionService.deleteSession(request.sessionId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Add message
    ipcMain.handle(
      IPC_CHANNELS.AGENT_SESSION_ADD_MESSAGE,
      async (_event, request: AgentSessionAddMessageRequest) => {
        try {
          if (!this.sessionService) {
            return {
              error: 'Session service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const message = await this.sessionService.addMessage(
            request.sessionId,
            request.role,
            request.content
          )
          return { message }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get messages
    ipcMain.handle(
      IPC_CHANNELS.AGENT_SESSION_GET_MESSAGES,
      async (_event, request: AgentSessionGetMessagesRequest) => {
        try {
          if (!this.sessionService) {
            return {
              error: 'Session service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const messages = this.sessionService.getMessages(request.sessionId)
          return { messages }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get last session ID
    ipcMain.handle(
      IPC_CHANNELS.AGENT_SESSION_GET_LAST,
      async (_event, request: AgentSessionGetLastRequest) => {
        try {
          if (!this.sessionService) {
            return {
              error: 'Session service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const sessionId = this.sessionService.getLastSessionId(
            request.projectPath
          )
          return { sessionId }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Set last session ID
    ipcMain.handle(
      IPC_CHANNELS.AGENT_SESSION_SET_LAST,
      async (_event, request: AgentSessionSetLastRequest) => {
        try {
          if (!this.sessionService) {
            return {
              error: 'Session service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          this.sessionService.setLastSessionId(
            request.projectPath,
            request.sessionId
          )
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Agent Service V2 operation handlers (Claude SDK Integration)
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
   */
  private registerAgentServiceV2Handlers(): void {
    // Create session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_V2_SESSION_CREATE,
      async (_event, request: AgentV2SessionCreateRequest) => {
        try {
          if (!this.agentServiceV2) {
            return {
              error: 'Agent service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const session = this.agentServiceV2.createSession({
            name: request.name,
            projectPath: request.projectPath,
            workingDirectory: request.workingDirectory,
            model: request.model,
            tags: request.tags,
          })
          return { session }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_V2_SESSION_GET,
      async (_event, request: AgentV2SessionGetRequest) => {
        try {
          if (!this.agentServiceV2) {
            return {
              error: 'Agent service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const session = this.agentServiceV2.getSession(request.sessionId)
          return { session }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // List sessions
    ipcMain.handle(
      IPC_CHANNELS.AGENT_V2_SESSION_LIST,
      async (_event, request: AgentV2SessionListRequest) => {
        try {
          if (!this.agentServiceV2) {
            return {
              error: 'Agent service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const sessions = this.agentServiceV2.listSessions({
            projectPath: request.projectPath,
            includeArchived: request.includeArchived,
          })
          return { sessions }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Update session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_V2_SESSION_UPDATE,
      async (_event, request: AgentV2SessionUpdateRequest) => {
        try {
          if (!this.agentServiceV2) {
            return {
              error: 'Agent service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const session = this.agentServiceV2.updateSession(
            request.sessionId,
            request.updates
          )
          return { session }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Archive session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_V2_SESSION_ARCHIVE,
      async (_event, request: AgentV2SessionArchiveRequest) => {
        try {
          if (!this.agentServiceV2) {
            return {
              error: 'Agent service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const success = this.agentServiceV2.archiveSession(request.sessionId)
          return { success }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Delete session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_V2_SESSION_DELETE,
      async (_event, request: AgentV2SessionDeleteRequest) => {
        try {
          if (!this.agentServiceV2) {
            return {
              error: 'Agent service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const success = this.agentServiceV2.deleteSession(request.sessionId)
          return { success }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Clear session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_V2_SESSION_CLEAR,
      async (_event, request: AgentV2SessionClearRequest) => {
        try {
          if (!this.agentServiceV2) {
            return {
              error: 'Agent service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const success = this.agentServiceV2.clearSession(request.sessionId)
          return { success }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Send message (with streaming)
    ipcMain.handle(
      IPC_CHANNELS.AGENT_V2_SEND_MESSAGE,
      async (event, request: AgentV2SendMessageRequest) => {
        try {
          if (!this.agentServiceV2) {
            return {
              error: 'Agent service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }

          const sender = event.sender
          const sessionId = request.sessionId

          // Set up event forwarding for this request
          const textDeltaHandler = (sid: string, text: string) => {
            if (sid === sessionId) {
              sender.send(IPC_CHANNELS.AGENT_V2_TEXT_DELTA, {
                sessionId: sid,
                text,
              })
            }
          }
          const toolUseHandler = (
            sid: string,
            toolName: string,
            input: unknown
          ) => {
            if (sid === sessionId) {
              sender.send(IPC_CHANNELS.AGENT_V2_TOOL_USE, {
                sessionId: sid,
                toolName,
                input,
              })
            }
          }
          const errorHandler = (sid: string, error: unknown) => {
            if (sid === sessionId) {
              sender.send(IPC_CHANNELS.AGENT_V2_ERROR, {
                sessionId: sid,
                error,
              })
            }
          }
          const completeHandler = (sid: string, result: string) => {
            if (sid === sessionId) {
              sender.send(IPC_CHANNELS.AGENT_V2_COMPLETE, {
                sessionId: sid,
                result,
              })
            }
          }

          this.agentServiceV2.on('textDelta', textDeltaHandler)
          this.agentServiceV2.on('toolUse', toolUseHandler)
          this.agentServiceV2.on('error', errorHandler)
          this.agentServiceV2.on('complete', completeHandler)

          try {
            const message = await this.agentServiceV2.sendMessage({
              sessionId: request.sessionId,
              message: request.message,
              imagePaths: request.imagePaths,
              model: request.model,
              systemPrompt: request.systemPrompt,
              allowedTools: request.allowedTools,
            })
            return { message }
          } finally {
            // Clean up event listeners
            this.agentServiceV2.off('textDelta', textDeltaHandler)
            this.agentServiceV2.off('toolUse', toolUseHandler)
            this.agentServiceV2.off('error', errorHandler)
            this.agentServiceV2.off('complete', completeHandler)
          }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get messages
    ipcMain.handle(
      IPC_CHANNELS.AGENT_V2_GET_MESSAGES,
      async (_event, request: AgentV2GetMessagesRequest) => {
        try {
          if (!this.agentServiceV2) {
            return {
              error: 'Agent service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const messages = this.agentServiceV2.getMessages(request.sessionId)
          return { messages }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Stop execution
    ipcMain.handle(
      IPC_CHANNELS.AGENT_V2_STOP_EXECUTION,
      async (_event, request: AgentV2StopExecutionRequest) => {
        try {
          if (!this.agentServiceV2) {
            return {
              error: 'Agent service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const success = this.agentServiceV2.stopExecution(request.sessionId)
          return { success }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Is executing
    ipcMain.handle(
      IPC_CHANNELS.AGENT_V2_IS_EXECUTING,
      async (_event, request: AgentV2IsExecutingRequest) => {
        try {
          if (!this.agentServiceV2) {
            return {
              error: 'Agent service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const isExecuting = this.agentServiceV2.isExecuting(request.sessionId)
          return { isExecuting }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Auto Mode Service V2 operation handlers (Claude SDK Integration)
   * Requirements: 4.1, 4.2, 4.7, 5.5, 5.6, 5.7
   */
  private registerAutoModeServiceV2Handlers(): void {
    // Start auto mode
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_V2_START,
      async (_event, request: AutoModeV2StartRequest) => {
        try {
          if (!this.autoModeServiceV2) {
            return {
              error: 'Auto mode service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.autoModeServiceV2.startAutoLoop(
            request.projectPath,
            request.config
          )
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Stop auto mode
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_V2_STOP,
      async (_event, request: AutoModeV2StopRequest) => {
        try {
          if (!this.autoModeServiceV2) {
            return {
              error: 'Auto mode service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.autoModeServiceV2.stopAutoLoop(request.projectPath)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get state
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_V2_GET_STATE,
      async (_event, request: AutoModeV2GetStateRequest) => {
        try {
          if (!this.autoModeServiceV2) {
            return {
              error: 'Auto mode service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const state = this.autoModeServiceV2.getState(request.projectPath)
          return { state }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Update config
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_V2_UPDATE_CONFIG,
      async (_event, request: AutoModeV2UpdateConfigRequest) => {
        try {
          if (!this.autoModeServiceV2) {
            return {
              error: 'Auto mode service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          this.autoModeServiceV2.updateConfig(
            request.projectPath,
            request.config
          )
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get queue
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_V2_GET_QUEUE,
      async (_event, request: AutoModeV2GetQueueRequest) => {
        try {
          if (!this.autoModeServiceV2) {
            return {
              error: 'Auto mode service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const features = await this.autoModeServiceV2.getFeatureQueue(
            request.projectPath
          )
          return { features }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Enqueue feature
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_V2_ENQUEUE_FEATURE,
      async (_event, request: AutoModeV2EnqueueFeatureRequest) => {
        try {
          if (!this.autoModeServiceV2) {
            return {
              error: 'Auto mode service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const feature = await this.autoModeServiceV2.enqueueFeature(
            request.projectPath,
            request.featureId
          )
          return { feature }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Dequeue feature
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_V2_DEQUEUE_FEATURE,
      async (_event, request: AutoModeV2DequeueFeatureRequest) => {
        try {
          if (!this.autoModeServiceV2) {
            return {
              error: 'Auto mode service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const feature = await this.autoModeServiceV2.dequeueFeature(
            request.projectPath,
            request.featureId
          )
          return { feature }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Execute feature
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_V2_EXECUTE_FEATURE,
      async (_event, request: AutoModeV2ExecuteFeatureRequest) => {
        try {
          if (!this.autoModeServiceV2) {
            return {
              error: 'Auto mode service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const feature = await this.autoModeServiceV2.executeFeature(
            request.projectPath,
            request.featureId,
            request.useWorktrees
          )
          return { feature }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Stop feature
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_V2_STOP_FEATURE,
      async (_event, request: AutoModeV2StopFeatureRequest) => {
        try {
          if (!this.autoModeServiceV2) {
            return {
              error: 'Auto mode service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const success = await this.autoModeServiceV2.stopFeature(
            request.projectPath,
            request.featureId
          )
          return { success }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Approve plan
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_V2_APPROVE_PLAN,
      async (_event, request: AutoModeV2ApprovePlanRequest) => {
        try {
          if (!this.autoModeServiceV2) {
            return {
              error: 'Auto mode service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const feature = await this.autoModeServiceV2.approvePlan(
            request.projectPath,
            request.featureId
          )
          return { feature }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Reject plan
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_V2_REJECT_PLAN,
      async (_event, request: AutoModeV2RejectPlanRequest) => {
        try {
          if (!this.autoModeServiceV2) {
            return {
              error: 'Auto mode service V2 not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const feature = await this.autoModeServiceV2.rejectPlan(
            request.projectPath,
            request.featureId,
            request.feedback
          )
          return { feature }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Set up event forwarding for auto mode V2 events
    if (this.autoModeServiceV2) {
      this.autoModeServiceV2.on(
        'stateChanged',
        (projectPath: string, state: unknown) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AUTO_MODE_V2_STATE_CHANGED, {
              projectPath,
              state,
            })
          }
        }
      )

      this.autoModeServiceV2.on(
        'featureStarted',
        (projectPath: string, featureId: string) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AUTO_MODE_V2_FEATURE_STARTED, {
              projectPath,
              featureId,
            })
          }
        }
      )

      this.autoModeServiceV2.on(
        'featureCompleted',
        (projectPath: string, featureId: string) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(
              IPC_CHANNELS.AUTO_MODE_V2_FEATURE_COMPLETED,
              {
                projectPath,
                featureId,
              }
            )
          }
        }
      )

      this.autoModeServiceV2.on(
        'featureFailed',
        (projectPath: string, featureId: string, error: string) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AUTO_MODE_V2_FEATURE_FAILED, {
              projectPath,
              featureId,
              error,
            })
          }
        }
      )

      this.autoModeServiceV2.on(
        'featureProgress',
        (projectPath: string, event: unknown) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(
              IPC_CHANNELS.AUTO_MODE_V2_FEATURE_PROGRESS,
              {
                projectPath,
                ...(event as object),
              }
            )
          }
        }
      )

      this.autoModeServiceV2.on(
        'planGenerated',
        (projectPath: string, featureId: string, plan: unknown) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AUTO_MODE_V2_PLAN_GENERATED, {
              projectPath,
              featureId,
              plan,
            })
          }
        }
      )

      this.autoModeServiceV2.on(
        'rateLimitWait',
        (projectPath: string, resetTime: string, waitSeconds: number) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AUTO_MODE_V2_RATE_LIMIT_WAIT, {
              projectPath,
              resetTime,
              waitSeconds,
            })
          }
        }
      )
    }
  }

  /**
   * Custom Theme operation handlers
   */
  private registerThemeHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.THEME_LIST,
      async (_event, _request: ThemeListRequest) => {
        try {
          const themes = this.db.getCustomThemes()
          return { themes }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.THEME_GET,
      async (_event, request: ThemeGetRequest) => {
        try {
          const theme = this.db.getCustomTheme(request.id)
          return { theme }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.THEME_CREATE,
      async (_event, request: ThemeCreateRequest) => {
        try {
          const theme = this.db.createCustomTheme(request.data)
          return { theme }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.THEME_UPDATE,
      async (_event, request: ThemeUpdateRequest) => {
        try {
          const theme = this.db.updateCustomTheme(request.id, request.data)
          return { theme }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.THEME_DELETE,
      async (_event, request: ThemeDeleteRequest) => {
        try {
          this.db.deleteCustomTheme(request.id)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * OpenCode SDK operation handlers
   */
  private registerOpencodeHandlers(): void {
    // Execute task
    ipcMain.handle(
      IPC_CHANNELS.OPENCODE_EXECUTE,
      async (event, request: OpencodeExecuteRequest) => {
        try {
          if (!this.opencodeSdkService) {
            return {
              error: 'OpenCode SDK service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }

          const sender = event.sender
          const taskId = request.taskId

          // Set up event forwarding
          const outputHandler = (data: string, stream: 'stdout' | 'stderr') => {
            sender.send(IPC_CHANNELS.OPENCODE_OUTPUT, { taskId, data, stream })
          }
          const toolCallHandler = (
            toolName: string,
            input: Record<string, unknown>
          ) => {
            sender.send(IPC_CHANNELS.OPENCODE_TOOL_CALL, {
              taskId,
              toolName,
              input,
            })
          }
          const toolResultHandler = (toolName: string, result: string) => {
            sender.send(IPC_CHANNELS.OPENCODE_TOOL_RESULT, {
              taskId,
              toolName,
              result,
            })
          }
          const errorHandler = (error: string) => {
            sender.send(IPC_CHANNELS.OPENCODE_ERROR, { taskId, error })
          }
          const sessionInitHandler = (sessionId: string) => {
            sender.send(IPC_CHANNELS.OPENCODE_SESSION_INIT, {
              taskId,
              sessionId,
            })
          }
          const completionHandler = () => {
            sender.send(IPC_CHANNELS.OPENCODE_COMPLETE, { taskId })
          }

          this.opencodeSdkService.on('output', outputHandler)
          this.opencodeSdkService.on('toolCall', toolCallHandler)
          this.opencodeSdkService.on('toolResult', toolResultHandler)
          this.opencodeSdkService.on('error', errorHandler)
          this.opencodeSdkService.on('sessionInit', sessionInitHandler)
          this.opencodeSdkService.on('completion', completionHandler)

          try {
            const result = await this.opencodeSdkService.execute(taskId, {
              prompt: request.prompt,
              workingDirectory: request.workingDirectory,
              model: request.model,
              sessionId: request.sessionId,
              agentName: request.agentName,
              serverPort: request.serverPort,
              serverBaseUrl: request.serverBaseUrl,
            })
            return result
          } finally {
            // Clean up event listeners
            this.opencodeSdkService.off('output', outputHandler)
            this.opencodeSdkService.off('toolCall', toolCallHandler)
            this.opencodeSdkService.off('toolResult', toolResultHandler)
            this.opencodeSdkService.off('error', errorHandler)
            this.opencodeSdkService.off('sessionInit', sessionInitHandler)
            this.opencodeSdkService.off('completion', completionHandler)
          }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Stop task
    ipcMain.handle(
      IPC_CHANNELS.OPENCODE_STOP,
      async (_event, request: OpencodeStopRequest) => {
        try {
          if (!this.opencodeSdkService) {
            return {
              error: 'OpenCode SDK service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.opencodeSdkService.stop(request.taskId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get sessions
    ipcMain.handle(
      IPC_CHANNELS.OPENCODE_GET_SESSIONS,
      async (_event, request: OpencodeGetSessionsRequest) => {
        try {
          if (!this.opencodeSdkService) {
            return {
              error: 'OpenCode SDK service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const sessions = await this.opencodeSdkService.listSessions(
            request.serverBaseUrl
          )
          return { sessions }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get messages
    ipcMain.handle(
      IPC_CHANNELS.OPENCODE_GET_MESSAGES,
      async (_event, request: OpencodeGetMessagesRequest) => {
        try {
          if (!this.opencodeSdkService) {
            return {
              error: 'OpenCode SDK service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const messages = await this.opencodeSdkService.getSessionMessages(
            request.sessionId,
            request.serverBaseUrl
          )
          return { messages }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Delete session
    ipcMain.handle(
      IPC_CHANNELS.OPENCODE_DELETE_SESSION,
      async (_event, request: OpencodeDeleteSessionRequest) => {
        try {
          if (!this.opencodeSdkService) {
            return {
              error: 'OpenCode SDK service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const success = await this.opencodeSdkService.deleteSession(
            request.sessionId,
            request.serverBaseUrl
          )
          return { success }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Backup config
    ipcMain.handle(
      IPC_CHANNELS.OPENCODE_BACKUP_CONFIG,
      async (_event, request: OpencodeBackupConfigRequest) => {
        try {
          if (!this.opencodeSdkService) {
            return {
              error: 'OpenCode SDK service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const backup = await this.opencodeSdkService.backupConfig(
            request.workingDirectory
          )
          return { backup }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Restore config
    ipcMain.handle(
      IPC_CHANNELS.OPENCODE_RESTORE_CONFIG,
      async (_event, request: OpencodeRestoreConfigRequest) => {
        try {
          if (!this.opencodeSdkService) {
            return {
              error: 'OpenCode SDK service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.opencodeSdkService.restoreConfig(request.backup)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Write config
    ipcMain.handle(
      IPC_CHANNELS.OPENCODE_WRITE_CONFIG,
      async (_event, request: OpencodeWriteConfigRequest) => {
        try {
          if (!this.opencodeSdkService) {
            return {
              error: 'OpenCode SDK service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.opencodeSdkService.writeConfig(
            request.workingDirectory,
            request.config
          )
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Generic error handler
   */
  private handleError(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('IPC Handler Error:', message, error)

    return {
      error: message,
      code: 'IPC_ERROR',
    }
  }
}
