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
  AgentSetModelRequest,
  AgentGetModelRequest,
  AgentGetModelsRequest,
  AgentSendMessageRequest,
  AgentGetConversationRequest,
  AgentClearConversationRequest,
  AgentAddContextFileRequest,
  AgentRemoveContextFileRequest,
  AgentGetContextFilesRequest,
  AgentGetTokenUsageRequest,
  AgentGenerateFixRequest,
  DialogOpenDirectoryRequest,
} from 'shared/ipc-types'
import type { DatabaseService } from 'main/services/database'
import type { PTYManager } from 'main/services/pty-manager'
import type { GitService } from 'main/services/git-service'
import type { KeychainService } from 'main/services/keychain-service'
import type { AgentService } from 'main/services/agent-service'
import { BlueprintService } from 'main/services/blueprint-service'

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
  private agentService: AgentService
  private blueprintService: BlueprintService

  constructor(
    db: DatabaseService,
    ptyManager: PTYManager,
    gitService: GitService,
    keychainService: KeychainService,
    agentService: AgentService
  ) {
    this.db = db
    this.ptyManager = ptyManager
    this.gitService = gitService
    this.keychainService = keychainService
    this.agentService = agentService
    this.blueprintService = new BlueprintService()
  }

  /**
   * Register all IPC handlers
   */
  registerHandlers(): void {
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
    this.registerAgentHandlers()
    this.registerDialogHandlers()
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
   * AI Agent operation handlers
   */
  private registerAgentHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.AGENT_SET_MODEL,
      async (_event, request: AgentSetModelRequest) => {
        try {
          this.agentService.setActiveModel(request.model)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.AGENT_GET_MODEL,
      async (_event, _request: AgentGetModelRequest) => {
        try {
          const model = this.agentService.getActiveModel()
          return { model }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.AGENT_GET_MODELS,
      async (_event, _request: AgentGetModelsRequest) => {
        try {
          const models = await this.agentService.getAvailableModels()
          return { models }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.AGENT_SEND_MESSAGE,
      async (_event, request: AgentSendMessageRequest) => {
        try {
          const message = await this.agentService.sendMessage(
            request.projectId,
            request.content
          )
          return { message }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.AGENT_GET_CONVERSATION,
      async (_event, request: AgentGetConversationRequest) => {
        try {
          const messages = this.agentService.getConversation(request.projectId)
          return { messages }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.AGENT_CLEAR_CONVERSATION,
      async (_event, request: AgentClearConversationRequest) => {
        try {
          this.agentService.clearConversation(request.projectId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.AGENT_ADD_CONTEXT_FILE,
      async (_event, request: AgentAddContextFileRequest) => {
        try {
          const file = this.agentService.addFileToContext(
            request.projectId,
            request.filePath
          )
          return { file }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.AGENT_REMOVE_CONTEXT_FILE,
      async (_event, request: AgentRemoveContextFileRequest) => {
        try {
          this.agentService.removeFileFromContext(
            request.projectId,
            request.filePath
          )
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.AGENT_GET_CONTEXT_FILES,
      async (_event, request: AgentGetContextFilesRequest) => {
        try {
          const files = this.agentService.getContextFiles(request.projectId)
          return { files }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.AGENT_GET_TOKEN_USAGE,
      async (_event, request: AgentGetTokenUsageRequest) => {
        try {
          const usage = this.agentService.getTokenUsage(request.projectId)
          return { usage }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    ipcMain.handle(
      IPC_CHANNELS.AGENT_GENERATE_FIX,
      async (_event, request: AgentGenerateFixRequest) => {
        try {
          const suggestion = await this.agentService.generateFix(
            request.errorContext
          )
          return { suggestion }
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
            focusedWindow ?? undefined as unknown as BrowserWindow,
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
