import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
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
  ShellOpenTerminalRequest,
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
} from 'shared/ipc-types'
import type { DatabaseService } from 'main/services/database'
import type { PTYManager } from 'main/services/pty-manager'
import type { GitService } from 'main/services/git-service'
import type { KeychainService } from 'main/services/keychain-service'
import { BlueprintService } from 'main/services/blueprint-service'
import { FilesService } from 'main/services/files-service'
import type { AIService } from 'main/services/ai-service'
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
import type { AgentService } from 'main/services/agent-service'
import type { AutoModeService } from 'main/services/auto-mode-service'
import type { ReviewService } from 'main/services/review-service'
import { ProviderFactory } from 'main/services/providers'
import { loadContextFiles, combineSystemPrompts } from 'main/services/context-loader'
import type {
  ThemeListRequest,
  ThemeGetRequest,
  ThemeCreateRequest,
  ThemeUpdateRequest,
  ThemeDeleteRequest,
  // Review Workflow types
  ReviewTransitionToReviewRequest,
  ReviewGetStatusRequest,
  ReviewSubmitFeedbackRequest,
  ReviewGetFeedbackHistoryRequest,
  ReviewApproveChangesRequest,
  ReviewDiscardChangesRequest,
  ReviewRunProjectRequest,
  ReviewStopProjectRequest,
  ReviewGetAvailableScriptsRequest,
  ReviewOpenTerminalRequest,
  ReviewGetOpenTerminalsRequest,
  // New Agent Service types (AI Agent Rework)
  AgentCreateSessionRequest,
  AgentListSessionsRequest,
  AgentDeleteSessionRequest,
  AgentArchiveSessionRequest,
  AgentSendMessageRequest,
  AgentStopExecutionRequest,
  AgentClearSessionRequest,
  // New Auto Mode Service types (AI Agent Rework)
  AutoModeStartRequest,
  AutoModeStopRequest,
  AutoModeExecuteFeatureRequest,
  AutoModeStopFeatureRequest,
  AutoModeApprovePlanRequest,
  AutoModeRejectPlanRequest,
  // Agent Config types
  AgentConfigSetRequest,
  AgentConfigValidateRequest,
  // Agent Task types
  AgentTaskCreateRequest,
  AgentTaskGetRequest,
  AgentTaskListRequest,
  AgentTaskUpdateRequest,
  AgentTaskDeleteRequest,
  AgentTaskStartRequest,
  AgentTaskStopRequest,
  AgentTaskGetOutputRequest,
} from 'shared/ipc-types'
import type {
  AgentEnvironmentConfig,
  AgentConfigValidationError,
  TaskServiceType,
} from 'shared/ai-types'

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
  private requestLogger?: RequestLogger
  private runningProjectsService?: RunningProjectsService
  private globalProcessService?: GlobalProcessService
  private worktreeService?: WorktreeService
  private dependencyManager?: DependencyManager
  private sessionService?: SessionService
  private reviewService?: ReviewService
  // New agent services (AI Agent Rework)
  private agentService?: AgentService
  private autoModeService?: AutoModeService
  // Task execution tracking
  private taskAbortControllers: Map<string, AbortController> = new Map()

  constructor(
    db: DatabaseService,
    ptyManager: PTYManager,
    gitService: GitService,
    keychainService: KeychainService,
    aiService?: AIService,
    requestLogger?: RequestLogger,
    runningProjectsService?: RunningProjectsService,
    globalProcessService?: GlobalProcessService,
    worktreeService?: WorktreeService,
    dependencyManager?: DependencyManager,
    sessionService?: SessionService,
    reviewService?: ReviewService,
    // New agent services (AI Agent Rework)
    agentService?: AgentService,
    autoModeService?: AutoModeService
  ) {
    this.db = db
    this.ptyManager = ptyManager
    this.gitService = gitService
    this.keychainService = keychainService
    this.blueprintService = new BlueprintService()
    this.filesService = new FilesService()
    this.scriptsService = new ScriptsService()
    this.aiService = aiService
    this.requestLogger = requestLogger
    this.runningProjectsService = runningProjectsService
    this.globalProcessService = globalProcessService
    this.worktreeService = worktreeService
    this.dependencyManager = dependencyManager
    this.sessionService = sessionService
    this.reviewService = reviewService
    // New agent services (AI Agent Rework)
    this.agentService = agentService
    this.autoModeService = autoModeService
  }

  /**
   * Execute a task asynchronously with streaming output
   */
  private async executeTaskAsync(
    taskId: string,
    task: import('shared/ai-types').AgentTask
  ): Promise<void> {
    const abortController = new AbortController()
    this.taskAbortControllers.set(taskId, abortController)

    try {
      // Get model from task parameters or use default
      const model = task.parameters?.model || 'claude-sonnet-4-20250514'
      const provider = ProviderFactory.getProviderForModel(model)

      console.log(`[IPCHandlers] Starting task ${taskId} with model ${model}`)

      // Load project context files
      const { formattedPrompt: contextFilesPrompt } = await loadContextFiles({
        projectPath: task.targetDirectory,
      })

      // Build system prompt - buildFeaturePrompt pattern
      const taskTitle = task.description.split('\n')[0].substring(0, 100)
      const baseSystemPrompt = `## Feature Implementation Task

**Task ID:** ${taskId}
**Title:** ${taskTitle}
**Description:** ${task.description}

## Instructions

Implement this feature by:
1. First, explore the codebase to understand the existing structure
2. Plan your implementation approach
3. Write the necessary code changes
4. Ensure the code follows existing patterns and conventions

When done, wrap your final summary in <summary> tags like this:

<summary>
## Summary: [Feature Title]

### Changes Implemented
- [List of changes made]

### Files Modified
- [List of files]

### Notes for Developer
- [Any important notes]
</summary>

This helps parse your summary correctly in the output logs.`

      const systemPrompt = combineSystemPrompts(contextFilesPrompt || undefined, baseSystemPrompt)

      // Send initial output to show task is starting
      const startLine: import('shared/ai-types').OutputLine = {
        id: 0,
        taskId,
        timestamp: new Date(),
        content: `Starting task: ${task.description}\nWorking directory: ${task.targetDirectory}\nModel: ${model}\n\n`,
        stream: 'stdout',
      }
      this.db.createTaskOutput({
        taskId,
        content: startLine.content,
        stream: 'stdout',
      })
      const windows = BrowserWindow.getAllWindows()
      for (const window of windows) {
        window.webContents.send(IPC_CHANNELS.AGENT_TASK_OUTPUT_STREAM, {
          taskId,
          line: startLine,
        })
      }

      // Execute the query
      const stream = provider.executeQuery({
        prompt: task.description,
        model,
        cwd: task.targetDirectory,
        systemPrompt,
        maxTurns: task.parameters?.maxIterations || 50,
        abortController,
      })

      let outputLineId = 1
      let responseText = ''

      // Process the stream
      for await (const msg of stream) {
        // Check if aborted
        if (abortController.signal.aborted) {
          console.log(`[IPCHandlers] Task ${taskId} aborted`)
          break
        }

        console.log(`[IPCHandlers] Task ${taskId} received message type: ${msg.type}`)

        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              responseText += block.text

              // Create output line
              const outputLine: import('shared/ai-types').OutputLine = {
                id: outputLineId++,
                taskId,
                timestamp: new Date(),
                content: block.text,
                stream: 'stdout',
              }

              // Store in database
              this.db.createTaskOutput({
                taskId,
                content: block.text,
                stream: 'stdout',
              })

              // Send to renderer
              const windows = BrowserWindow.getAllWindows()
              for (const window of windows) {
                window.webContents.send(IPC_CHANNELS.AGENT_TASK_OUTPUT_STREAM, {
                  taskId,
                  line: outputLine,
                })
              }
            } else if (block.type === 'tool_use' && block.name) {
              // Log tool usage
              const toolOutput = `\n[Tool: ${block.name}]\n${JSON.stringify(block.input, null, 2)}\n`
              const outputLine: import('shared/ai-types').OutputLine = {
                id: outputLineId++,
                taskId,
                timestamp: new Date(),
                content: toolOutput,
                stream: 'stdout',
              }

              this.db.createTaskOutput({
                taskId,
                content: toolOutput,
                stream: 'stdout',
              })

              const windows = BrowserWindow.getAllWindows()
              for (const window of windows) {
                window.webContents.send(IPC_CHANNELS.AGENT_TASK_OUTPUT_STREAM, {
                  taskId,
                  line: outputLine,
                })
              }
            } else if (block.type === 'tool_result') {
              // Log tool result
              const resultContent = typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content, null, 2)
              const toolResultOutput = `\n[Tool Result]\n${resultContent}\n`
              const outputLine: import('shared/ai-types').OutputLine = {
                id: outputLineId++,
                taskId,
                timestamp: new Date(),
                content: toolResultOutput,
                stream: 'stdout',
              }

              this.db.createTaskOutput({
                taskId,
                content: toolResultOutput,
                stream: 'stdout',
              })

              const windows = BrowserWindow.getAllWindows()
              for (const window of windows) {
                window.webContents.send(IPC_CHANNELS.AGENT_TASK_OUTPUT_STREAM, {
                  taskId,
                  line: outputLine,
                })
              }
            }
          }
        } else if (msg.type === 'user') {
          // User messages (tool results from SDK)
          if (msg.message?.content) {
            const content = Array.isArray(msg.message.content)
              ? msg.message.content.map((b: { type: string; text?: string; content?: string }) =>
                  b.type === 'text' ? b.text : b.content
                ).join('\n')
              : String(msg.message.content)

            if (content) {
              const outputLine: import('shared/ai-types').OutputLine = {
                id: outputLineId++,
                taskId,
                timestamp: new Date(),
                content: `\n${content}\n`,
                stream: 'stdout',
              }

              this.db.createTaskOutput({
                taskId,
                content: outputLine.content,
                stream: 'stdout',
              })

              const windows = BrowserWindow.getAllWindows()
              for (const window of windows) {
                window.webContents.send(IPC_CHANNELS.AGENT_TASK_OUTPUT_STREAM, {
                  taskId,
                  line: outputLine,
                })
              }
            }
          }
        } else if (msg.type === 'result') {
          if (msg.subtype === 'success' && msg.result) {
            const outputLine: import('shared/ai-types').OutputLine = {
              id: outputLineId++,
              taskId,
              timestamp: new Date(),
              content: `\n--- Task Completed ---\n${msg.result}`,
              stream: 'stdout',
            }

            this.db.createTaskOutput({
              taskId,
              content: outputLine.content,
              stream: 'stdout',
            })

            const windows = BrowserWindow.getAllWindows()
            for (const window of windows) {
              window.webContents.send(IPC_CHANNELS.AGENT_TASK_OUTPUT_STREAM, {
                taskId,
                line: outputLine,
              })
            }
          } else if (msg.subtype === 'error' && msg.error) {
            const outputLine: import('shared/ai-types').OutputLine = {
              id: outputLineId++,
              taskId,
              timestamp: new Date(),
              content: `Error: ${msg.error}`,
              stream: 'stderr',
            }

            this.db.createTaskOutput({
              taskId,
              content: outputLine.content,
              stream: 'stderr',
            })

            const windows = BrowserWindow.getAllWindows()
            for (const window of windows) {
              window.webContents.send(IPC_CHANNELS.AGENT_TASK_OUTPUT_STREAM, {
                taskId,
                line: outputLine,
              })
            }
          }
        } else if (msg.type === 'error') {
          const outputLine: import('shared/ai-types').OutputLine = {
            id: outputLineId++,
            taskId,
            timestamp: new Date(),
            content: `Error: ${msg.error || 'Unknown error'}`,
            stream: 'stderr',
          }

          this.db.createTaskOutput({
            taskId,
            content: outputLine.content,
            stream: 'stderr',
          })

          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AGENT_TASK_OUTPUT_STREAM, {
              taskId,
              line: outputLine,
            })
          }
        }
      }

      console.log(`[IPCHandlers] Task ${taskId} stream completed`)

      // Task completed successfully
      this.db.updateAgentTask(taskId, {
        status: 'completed',
        completedAt: new Date(),
      })

      // Notify completion
      if (this.globalProcessService) {
        this.globalProcessService.notifyTaskCompleted(taskId, task.targetDirectory)
      }

      // Emit final status update
      const finalWindows = BrowserWindow.getAllWindows()
      for (const window of finalWindows) {
        window.webContents.send(IPC_CHANNELS.AGENT_TASK_STATUS_UPDATE, {
          task: this.db.getAgentTask(taskId),
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[IPCHandlers] Task ${taskId} error:`, errorMessage)
      const isAbort = errorMessage.includes('abort') || abortController.signal.aborted

      if (!isAbort) {
        // Update task as failed
        this.db.updateAgentTask(taskId, {
          status: 'failed',
          completedAt: new Date(),
          error: errorMessage,
        })

        // Add error to output
        this.db.createTaskOutput({
          taskId,
          content: `Task failed: ${errorMessage}`,
          stream: 'stderr',
        })

        // Send error to renderer
        const windows = BrowserWindow.getAllWindows()
        for (const window of windows) {
          window.webContents.send(IPC_CHANNELS.AGENT_TASK_OUTPUT_STREAM, {
            taskId,
            line: {
              id: Date.now(),
              taskId,
              timestamp: new Date(),
              content: `Task failed: ${errorMessage}`,
              stream: 'stderr',
            },
          })
        }
      } else {
        // Task was stopped
        this.db.updateAgentTask(taskId, {
          status: 'stopped',
          completedAt: new Date(),
        })
      }

      // Emit status update
      const windows = BrowserWindow.getAllWindows()
      for (const window of windows) {
        window.webContents.send(IPC_CHANNELS.AGENT_TASK_STATUS_UPDATE, {
          task: this.db.getAgentTask(taskId),
        })
      }
    } finally {
      this.taskAbortControllers.delete(taskId)
    }
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
    // AI service handlers
    this.registerAIServiceHandlers()
    this.registerCLIDetectorHandlers()
    this.registerRunningProjectsHandlers()
    this.registerDevToolsHandlers()
    // Agent enhancement handlers
    this.registerWorktreeHandlers()
    this.registerDependencyHandlers()
    this.registerAgentSessionHandlers()
    // New agent service handlers (AI Agent Rework)
    this.registerNewAgentServiceHandlers()
    this.registerNewAutoModeServiceHandlers()
    // Review Workflow handlers
    this.registerReviewHandlers()
    // Agent Config handlers
    this.registerAgentConfigHandlers()
    // Agent Task handlers
    this.registerAgentTaskHandlers()
    // Running Tasks handlers
    this.registerRunningTasksHandlers()
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

    // Open external terminal window in specified directory
    ipcMain.handle(
      IPC_CHANNELS.SHELL_OPEN_TERMINAL,
      async (_event, request: ShellOpenTerminalRequest) => {
        try {
          const platform = process.platform

          if (platform === 'win32') {
            // Try Windows Terminal first, fall back to cmd.exe
            try {
              spawn('wt.exe', ['-d', request.cwd], {
                detached: true,
                stdio: 'ignore',
              }).unref()
            } catch {
              // Fallback to cmd.exe if Windows Terminal is not available
              spawn(
                'cmd.exe',
                ['/c', 'start', 'cmd.exe', '/K', `cd /d "${request.cwd}"`],
                {
                  detached: true,
                  stdio: 'ignore',
                  shell: true,
                }
              ).unref()
            }
          } else if (platform === 'darwin') {
            // macOS: Open Terminal.app
            spawn('open', ['-a', 'Terminal', request.cwd], {
              detached: true,
              stdio: 'ignore',
            }).unref()
          } else {
            // Linux: Try common terminal emulators
            const terminals = [
              'gnome-terminal',
              'konsole',
              'xfce4-terminal',
              'xterm',
            ]
            let opened = false

            for (const term of terminals) {
              try {
                if (term === 'gnome-terminal') {
                  spawn(term, ['--working-directory=' + request.cwd], {
                    detached: true,
                    stdio: 'ignore',
                  }).unref()
                } else if (term === 'konsole') {
                  spawn(term, ['--workdir', request.cwd], {
                    detached: true,
                    stdio: 'ignore',
                  }).unref()
                } else {
                  spawn(term, [], {
                    cwd: request.cwd,
                    detached: true,
                    stdio: 'ignore',
                  }).unref()
                }
                opened = true
                break
              } catch {
                // Try next terminal
              }
            }

            if (!opened) {
              throw new Error('No terminal emulator found')
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

          // Use provided path/name or look up from database
          let projectPath = request.projectPath
          let projectName = request.projectName

          if (!projectPath) {
            // Get project details from database
            const project = this.db.getProject(request.projectId)
            if (!project) {
              return { error: 'Project not found', code: 'PROJECT_NOT_FOUND' }
            }
            projectPath = project.path
            projectName = project.name
          }

          if (!projectName) {
            // Use a fallback name based on the path
            projectName = projectPath.split(/[/\\]/).pop() || 'Unknown Project'
          }

          const runningProject = await this.runningProjectsService.start(
            request.projectId,
            projectName,
            projectPath,
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
   * New Agent Service operation handlers (AI Agent Rework)
   * Requirements: 11.1, 11.2, 11.5
   */
  private registerNewAgentServiceHandlers(): void {
    // Create session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_CREATE_SESSION,
      async (
        _event,
        request: import('shared/ipc-types').AgentCreateSessionRequest
      ) => {
        try {
          if (!this.agentService) {
            return {
              error: 'Agent service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const session = this.agentService.createSession(
            request.name,
            request.projectPath,
            request.workingDirectory
          )
          return { session }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // List sessions
    ipcMain.handle(
      IPC_CHANNELS.AGENT_LIST_SESSIONS,
      async (
        _event,
        request: import('shared/ipc-types').AgentListSessionsRequest
      ) => {
        try {
          if (!this.agentService) {
            return {
              error: 'Agent service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const sessions = this.agentService.listSessions(
            request.includeArchived
          )
          return { sessions }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Delete session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_DELETE_SESSION,
      async (
        _event,
        request: import('shared/ipc-types').AgentDeleteSessionRequest
      ) => {
        try {
          if (!this.agentService) {
            return {
              error: 'Agent service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const success = this.agentService.deleteSession(request.sessionId)
          return { success }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Archive session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_ARCHIVE_SESSION,
      async (
        _event,
        request: import('shared/ipc-types').AgentArchiveSessionRequest
      ) => {
        try {
          if (!this.agentService) {
            return {
              error: 'Agent service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const success = this.agentService.archiveSession(request.sessionId)
          return { success }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Start conversation
    ipcMain.handle(
      IPC_CHANNELS.AGENT_START_CONVERSATION,
      async (
        _event,
        request: import('shared/ipc-types').AgentStartConversationRequest
      ) => {
        try {
          if (!this.agentService) {
            return {
              error: 'Agent service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const result = await this.agentService.startConversation(
            request.sessionId,
            request.workingDirectory
          )
          return result
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Send message (with streaming)
    ipcMain.handle(
      IPC_CHANNELS.AGENT_SEND_MESSAGE,
      async (
        event,
        request: import('shared/ipc-types').AgentSendMessageRequest
      ) => {
        try {
          if (!this.agentService) {
            return {
              error: 'Agent service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }

          const sender = event.sender
          const sessionId = request.sessionId

          // Set up event forwarding for this request
          const textDeltaHandler = (sid: string, text: string) => {
            if (sid === sessionId) {
              sender.send(IPC_CHANNELS.AGENT_STREAM, {
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
              sender.send(IPC_CHANNELS.AGENT_TOOL_USE, {
                sessionId: sid,
                toolName,
                input,
              })
            }
          }
          const errorHandler = (
            sid: string,
            error: import('../services/providers/types').ProviderErrorInfo
          ) => {
            if (sid === sessionId) {
              sender.send(IPC_CHANNELS.AGENT_ERROR, {
                sessionId: sid,
                error,
              })
            }
          }
          const completeHandler = (sid: string, result: string) => {
            if (sid === sessionId) {
              sender.send(IPC_CHANNELS.AGENT_COMPLETE, {
                sessionId: sid,
                result,
              })
            }
          }

          this.agentService.on('textDelta', textDeltaHandler)
          this.agentService.on('toolUse', toolUseHandler)
          this.agentService.on('error', errorHandler)
          this.agentService.on('complete', completeHandler)

          try {
            const result = await this.agentService.sendMessage({
              sessionId: request.sessionId,
              message: request.message,
              imagePaths: request.imagePaths,
              model: request.model,
              systemPrompt: request.systemPrompt,
              allowedTools: request.allowedTools,
            })
            return result
          } finally {
            // Clean up event listeners
            this.agentService.off('textDelta', textDeltaHandler)
            this.agentService.off('toolUse', toolUseHandler)
            this.agentService.off('error', errorHandler)
            this.agentService.off('complete', completeHandler)
          }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Stop execution
    ipcMain.handle(
      IPC_CHANNELS.AGENT_STOP_EXECUTION,
      async (
        _event,
        request: import('shared/ipc-types').AgentStopExecutionRequest
      ) => {
        try {
          if (!this.agentService) {
            return {
              error: 'Agent service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const success = this.agentService.stopExecution(request.sessionId)
          return { success }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Clear session
    ipcMain.handle(
      IPC_CHANNELS.AGENT_CLEAR_SESSION,
      async (
        _event,
        request: import('shared/ipc-types').AgentClearSessionRequest
      ) => {
        try {
          if (!this.agentService) {
            return {
              error: 'Agent service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const success = this.agentService.clearSession(request.sessionId)
          return { success }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get messages
    ipcMain.handle(
      IPC_CHANNELS.AGENT_GET_MESSAGES,
      async (
        _event,
        request: import('shared/ipc-types').AgentGetMessagesRequest
      ) => {
        try {
          if (!this.agentService) {
            return {
              error: 'Agent service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const messages = this.agentService.getMessages(request.sessionId)
          return { messages }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Is executing
    ipcMain.handle(
      IPC_CHANNELS.AGENT_IS_EXECUTING,
      async (
        _event,
        request: import('shared/ipc-types').AgentIsExecutingRequest
      ) => {
        try {
          if (!this.agentService) {
            return {
              error: 'Agent service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const isExecuting = this.agentService.isExecuting(request.sessionId)
          return { isExecuting }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * New Auto Mode Service operation handlers (AI Agent Rework)
   * Requirements: 11.3, 11.5
   */
  private registerNewAutoModeServiceHandlers(): void {
    // Start auto mode
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_START,
      async (
        _event,
        request: import('shared/ipc-types').AutoModeStartRequest
      ) => {
        try {
          if (!this.autoModeService) {
            return {
              error: 'Auto mode service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.autoModeService.startAutoLoop(
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
      IPC_CHANNELS.AUTO_MODE_STOP,
      async (
        _event,
        request: import('shared/ipc-types').AutoModeStopRequest
      ) => {
        try {
          if (!this.autoModeService) {
            return {
              error: 'Auto mode service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const stoppedCount = await this.autoModeService.stopAutoLoop(
            request.projectPath
          )
          return { stoppedCount }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get state
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_GET_STATE,
      async (
        _event,
        request: import('shared/ipc-types').AutoModeGetStateRequest
      ) => {
        try {
          if (!this.autoModeService) {
            return {
              error: 'Auto mode service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const state = this.autoModeService.getState(request.projectPath)
          return { state }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Update config
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_UPDATE_CONFIG,
      async (
        _event,
        request: import('shared/ipc-types').AutoModeUpdateConfigRequest
      ) => {
        try {
          if (!this.autoModeService) {
            return {
              error: 'Auto mode service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          this.autoModeService.updateConfig(request.projectPath, request.config)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get queue
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_GET_QUEUE,
      async (
        _event,
        request: import('shared/ipc-types').AutoModeGetQueueRequest
      ) => {
        try {
          if (!this.autoModeService) {
            return {
              error: 'Auto mode service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const features = await this.autoModeService.getFeatureQueue(
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
      IPC_CHANNELS.AUTO_MODE_ENQUEUE_FEATURE,
      async (
        _event,
        request: import('shared/ipc-types').AutoModeEnqueueFeatureRequest
      ) => {
        try {
          if (!this.autoModeService) {
            return {
              error: 'Auto mode service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const feature = await this.autoModeService.enqueueFeature(
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
      IPC_CHANNELS.AUTO_MODE_DEQUEUE_FEATURE,
      async (
        _event,
        request: import('shared/ipc-types').AutoModeDequeueFeatureRequest
      ) => {
        try {
          if (!this.autoModeService) {
            return {
              error: 'Auto mode service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const feature = await this.autoModeService.dequeueFeature(
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
      IPC_CHANNELS.AUTO_MODE_EXECUTE_FEATURE,
      async (
        _event,
        request: import('shared/ipc-types').AutoModeExecuteFeatureRequest
      ) => {
        try {
          if (!this.autoModeService) {
            return {
              error: 'Auto mode service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const feature = await this.autoModeService.executeFeature(
            request.projectPath,
            request.featureId
          )
          return { feature }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Stop feature
    ipcMain.handle(
      IPC_CHANNELS.AUTO_MODE_STOP_FEATURE,
      async (
        _event,
        request: import('shared/ipc-types').AutoModeStopFeatureRequest
      ) => {
        try {
          if (!this.autoModeService) {
            return {
              error: 'Auto mode service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const success = await this.autoModeService.stopFeature(
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
      IPC_CHANNELS.AUTO_MODE_APPROVE_PLAN,
      async (
        _event,
        request: import('shared/ipc-types').AutoModeApprovePlanRequest
      ) => {
        try {
          if (!this.autoModeService) {
            return {
              error: 'Auto mode service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const feature = await this.autoModeService.approvePlan(
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
      IPC_CHANNELS.AUTO_MODE_REJECT_PLAN,
      async (
        _event,
        request: import('shared/ipc-types').AutoModeRejectPlanRequest
      ) => {
        try {
          if (!this.autoModeService) {
            return {
              error: 'Auto mode service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const feature = await this.autoModeService.rejectPlan(
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

    // Set up event forwarding for auto mode events
    if (this.autoModeService) {
      this.autoModeService.on(
        'stateChanged',
        (projectPath: string, state: unknown) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AUTO_MODE_STATE_CHANGED, {
              projectPath,
              state,
            })
          }
        }
      )

      this.autoModeService.on(
        'featureStarted',
        (projectPath: string, featureId: string) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AUTO_MODE_FEATURE_STARTED, {
              projectPath,
              featureId,
            })
          }
        }
      )

      this.autoModeService.on(
        'featureCompleted',
        (projectPath: string, featureId: string) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AUTO_MODE_FEATURE_COMPLETED, {
              projectPath,
              featureId,
            })
          }
        }
      )

      this.autoModeService.on(
        'featureFailed',
        (projectPath: string, featureId: string, error: string) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AUTO_MODE_FEATURE_FAILED, {
              projectPath,
              featureId,
              error,
            })
          }
        }
      )

      this.autoModeService.on(
        'featureProgress',
        (projectPath: string, event: unknown) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AUTO_MODE_FEATURE_PROGRESS, {
              projectPath,
              ...(event as object),
            })
          }
        }
      )

      this.autoModeService.on(
        'planGenerated',
        (projectPath: string, featureId: string, plan: unknown) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AUTO_MODE_PLAN_GENERATED, {
              projectPath,
              featureId,
              plan,
            })
          }
        }
      )

      this.autoModeService.on(
        'rateLimitWait',
        (projectPath: string, resetTime: string, waitSeconds: number) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AUTO_MODE_RATE_LIMIT_WAIT, {
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
   * Task Review Workflow operation handlers
   * Requirements: 1.1, 4.2, 5.2, 6.4, 2.2, 2.4, 2.5, 3.2, 3.4
   */
  private registerReviewHandlers(): void {
    // Transition task to review status
    ipcMain.handle(
      IPC_CHANNELS.REVIEW_TRANSITION_TO_REVIEW,
      async (_event, request: ReviewTransitionToReviewRequest) => {
        try {
          if (!this.reviewService) {
            return {
              error: 'Review service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.reviewService.transitionToReview(request.taskId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get review status for a task
    ipcMain.handle(
      IPC_CHANNELS.REVIEW_GET_STATUS,
      async (_event, request: ReviewGetStatusRequest) => {
        try {
          if (!this.reviewService) {
            return {
              error: 'Review service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const status = this.reviewService.getReviewStatus(request.taskId)
          return { status }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Submit feedback for a task in review
    ipcMain.handle(
      IPC_CHANNELS.REVIEW_SUBMIT_FEEDBACK,
      async (_event, request: ReviewSubmitFeedbackRequest) => {
        try {
          if (!this.reviewService) {
            return {
              error: 'Review service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.reviewService.submitFeedback(
            request.taskId,
            request.feedback
          )
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get feedback history for a task
    ipcMain.handle(
      IPC_CHANNELS.REVIEW_GET_FEEDBACK_HISTORY,
      async (_event, request: ReviewGetFeedbackHistoryRequest) => {
        try {
          if (!this.reviewService) {
            return {
              error: 'Review service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const feedback = this.reviewService.getFeedbackHistory(request.taskId)
          return { feedback }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Approve changes and copy to original project
    ipcMain.handle(
      IPC_CHANNELS.REVIEW_APPROVE_CHANGES,
      async (_event, request: ReviewApproveChangesRequest) => {
        try {
          if (!this.reviewService) {
            return {
              error: 'Review service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const result = await this.reviewService.approveChanges(request.taskId)
          return { result }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Discard changes and cleanup
    ipcMain.handle(
      IPC_CHANNELS.REVIEW_DISCARD_CHANGES,
      async (_event, request: ReviewDiscardChangesRequest) => {
        try {
          if (!this.reviewService) {
            return {
              error: 'Review service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.reviewService.discardChanges(request.taskId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Run project in working directory
    ipcMain.handle(
      IPC_CHANNELS.REVIEW_RUN_PROJECT,
      async (_event, request: ReviewRunProjectRequest) => {
        try {
          if (!this.reviewService) {
            return {
              error: 'Review service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const process = await this.reviewService.runProject(
            request.taskId,
            request.script
          )
          return { process }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Stop running project
    ipcMain.handle(
      IPC_CHANNELS.REVIEW_STOP_PROJECT,
      async (_event, request: ReviewStopProjectRequest) => {
        try {
          if (!this.reviewService) {
            return {
              error: 'Review service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          await this.reviewService.stopProject(request.taskId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get available scripts from working directory
    ipcMain.handle(
      IPC_CHANNELS.REVIEW_GET_AVAILABLE_SCRIPTS,
      async (_event, request: ReviewGetAvailableScriptsRequest) => {
        try {
          if (!this.reviewService) {
            return {
              error: 'Review service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const scripts = await this.reviewService.getAvailableScripts(
            request.taskId
          )
          return { scripts }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Open terminal in working directory
    ipcMain.handle(
      IPC_CHANNELS.REVIEW_OPEN_TERMINAL,
      async (_event, request: ReviewOpenTerminalRequest) => {
        try {
          if (!this.reviewService) {
            return {
              error: 'Review service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const session = await this.reviewService.openTerminal(request.taskId)
          return { session }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get open terminals for a task
    ipcMain.handle(
      IPC_CHANNELS.REVIEW_GET_OPEN_TERMINALS,
      async (_event, request: ReviewGetOpenTerminalsRequest) => {
        try {
          if (!this.reviewService) {
            return {
              error: 'Review service not initialized',
              code: 'SERVICE_NOT_INITIALIZED',
            }
          }
          const terminals = this.reviewService.getOpenTerminals(request.taskId)
          return { terminals }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Set up event forwarding for review status updates
    if (this.reviewService) {
      this.reviewService.on(
        'taskTransitionedToReview',
        (task: import('shared/ai-types').AgentTask) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.REVIEW_STATUS_UPDATE, {
              taskId: task.id,
              status: {
                taskId: task.id,
                status: task.status,
                feedbackCount: 0,
                hasRunningProcess: false,
                openTerminalCount: 0,
                workingDirectory: task.workingDirectory || task.worktreePath,
                fileChanges: task.fileChanges,
              },
            })
          }
        }
      )

      this.reviewService.on(
        'changesApproved',
        (
          taskId: string,
          result: import('shared/ipc-types').ReviewApprovalResult
        ) => {
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.REVIEW_STATUS_UPDATE, {
              taskId,
              approved: true,
              result,
            })
          }
        }
      )

      this.reviewService.on('changesDiscarded', (taskId: string) => {
        const windows = BrowserWindow.getAllWindows()
        for (const window of windows) {
          window.webContents.send(IPC_CHANNELS.REVIEW_STATUS_UPDATE, {
            taskId,
            discarded: true,
          })
        }
      })
    }
  }

  /**
   * Agent Task handlers
   * Manages agent task CRUD operations and execution
   */
  private registerAgentTaskHandlers(): void {
    // Create agent task
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_CREATE,
      async (_event, request: AgentTaskCreateRequest) => {
        try {
          const task = this.db.createAgentTask({
            description: request.description,
            agentType: request.agentType,
            targetDirectory: request.targetDirectory,
            parameters: request.parameters,
            priority: request.priority,
            serviceType: request.serviceType,
            julesParams: request.julesParams,
            planningMode: request.planningMode,
            requirePlanApproval: request.requirePlanApproval,
            branchName: request.branchName,
            projectId: request.projectId,
            projectName: request.projectName,
          })
          return { task }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get agent task by ID
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_GET,
      async (_event, request: AgentTaskGetRequest) => {
        try {
          const task = this.db.getAgentTask(request.taskId)
          return { task }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // List agent tasks
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_LIST,
      async (_event, request: AgentTaskListRequest) => {
        try {
          const tasks = this.db.getAgentTasks(request.filter)
          return { tasks }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Update agent task
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_UPDATE,
      async (_event, request: AgentTaskUpdateRequest) => {
        try {
          const task = this.db.updateAgentTask(request.taskId, request.updates)
          if (!task) {
            return { error: 'Task not found', code: 'NOT_FOUND' }
          }
          return { task }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Delete agent task
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_DELETE,
      async (_event, request: AgentTaskDeleteRequest) => {
        try {
          this.db.deleteAgentTask(request.taskId)
          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Start agent task - execute via provider with streaming output
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_START,
      async (_event, request: AgentTaskStartRequest) => {
        try {
          const task = this.db.getAgentTask(request.taskId)
          if (!task) {
            return { error: 'Task not found', code: 'NOT_FOUND' }
          }

          // Update task status to running
          this.db.updateAgentTask(request.taskId, {
            status: 'running',
            startedAt: new Date(),
          })

          // Notify global process service
          if (this.globalProcessService) {
            this.globalProcessService.notifyTaskStarted(
              request.taskId,
              task.targetDirectory,
              task.description
            )
          }

          // Emit initial status update
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AGENT_TASK_STATUS_UPDATE, {
              task: this.db.getAgentTask(request.taskId),
            })
          }

          // Execute task asynchronously
          this.executeTaskAsync(request.taskId, task).catch((error: Error) => {
            console.error(`[IPCHandlers] Task ${request.taskId} execution error:`, error)
          })

          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Stop agent task
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_STOP,
      async (_event, request: AgentTaskStopRequest) => {
        try {
          const task = this.db.getAgentTask(request.taskId)
          if (!task) {
            return { error: 'Task not found', code: 'NOT_FOUND' }
          }

          // Abort the task if it has an abort controller
          const abortController = this.taskAbortControllers.get(request.taskId)
          if (abortController) {
            abortController.abort()
            this.taskAbortControllers.delete(request.taskId)
          }

          // Update task status to stopped
          this.db.updateAgentTask(request.taskId, {
            status: 'stopped',
            completedAt: new Date(),
          })

          // Stop via global process service
          if (this.globalProcessService) {
            await this.globalProcessService.stopTask(request.taskId)
          }

          // Emit status update
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AGENT_TASK_STATUS_UPDATE, {
              task: this.db.getAgentTask(request.taskId),
            })
          }

          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Get task output
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_GET_OUTPUT,
      async (_event, request: AgentTaskGetOutputRequest) => {
        try {
          const output = this.db.getTaskOutput(request.taskId)
          return { output }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Pause task - abort execution but keep state for resume
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_PAUSE,
      async (_event, request: { taskId: string }) => {
        try {
          const task = this.db.getAgentTask(request.taskId)
          if (!task) {
            return { error: 'Task not found', code: 'NOT_FOUND' }
          }

          // Only running tasks can be paused
          if (task.status !== 'running') {
            return { error: 'Task is not running', code: 'INVALID_STATE' }
          }

          // Abort the task execution
          const abortController = this.taskAbortControllers.get(request.taskId)
          if (abortController) {
            abortController.abort()
            this.taskAbortControllers.delete(request.taskId)
          }

          // Update status to paused
          this.db.updateAgentTask(request.taskId, { status: 'paused' })

          // Emit status update
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AGENT_TASK_STATUS_UPDATE, {
              task: this.db.getAgentTask(request.taskId),
            })
          }

          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Resume task - restart execution from where it left off
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_RESUME,
      async (_event, request: { taskId: string }) => {
        try {
          const task = this.db.getAgentTask(request.taskId)
          if (!task) {
            return { error: 'Task not found', code: 'NOT_FOUND' }
          }

          // Only paused or stopped tasks can be resumed
          if (task.status !== 'paused' && task.status !== 'stopped') {
            return { error: 'Task is not paused or stopped', code: 'INVALID_STATE' }
          }

          // Update status to running
          this.db.updateAgentTask(request.taskId, {
            status: 'running',
            startedAt: new Date(),
          })

          // Notify global process service
          if (this.globalProcessService) {
            this.globalProcessService.notifyTaskStarted(
              request.taskId,
              task.targetDirectory,
              task.description
            )
          }

          // Emit status update
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AGENT_TASK_STATUS_UPDATE, {
              task: this.db.getAgentTask(request.taskId),
            })
          }

          // Re-execute task asynchronously (continues from existing output context)
          this.executeTaskAsync(request.taskId, task).catch((error: Error) => {
            console.error(`[IPCHandlers] Task ${request.taskId} resume error:`, error)
          })

          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Restart task - clear output and start fresh
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_RESTART,
      async (_event, request: { taskId: string }) => {
        try {
          const task = this.db.getAgentTask(request.taskId)
          if (!task) {
            return { error: 'Task not found', code: 'NOT_FOUND' }
          }

          // Stop if currently running
          const abortController = this.taskAbortControllers.get(request.taskId)
          if (abortController) {
            abortController.abort()
            this.taskAbortControllers.delete(request.taskId)
          }

          // Clear existing output
          this.db.clearTaskOutput(request.taskId)

          // Reset task state
          this.db.updateAgentTask(request.taskId, {
            status: 'pending',
            startedAt: null,
            completedAt: null,
            error: null,
          })

          // Emit status update
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AGENT_TASK_STATUS_UPDATE, {
              task: this.db.getAgentTask(request.taskId),
            })
          }

          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Load output (same as get output, for compatibility)
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_LOAD_OUTPUT,
      async (_event, request: AgentTaskGetOutputRequest) => {
        try {
          const output = this.db.getTaskOutput(request.taskId)
          return { output }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Subscribe to output (stub - returns success, actual streaming via events)
    ipcMain.handle(
      IPC_CHANNELS.AGENT_TASK_SUBSCRIBE_OUTPUT,
      async (_event, request: { taskId: string }) => {
        try {
          // Subscription is handled via IPC events, just acknowledge
          return { success: true, taskId: request.taskId }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Approve task plan - continue execution after plan approval
    ipcMain.handle(
      IPC_CHANNELS.TASK_APPROVE_PLAN,
      async (_event, request: TaskApprovePlanRequest) => {
        try {
          const task = this.db.getAgentTask(request.taskId)
          if (!task) {
            return { error: 'Task not found', code: 'NOT_FOUND' }
          }

          // Task must be in awaiting_approval status
          if (task.status !== 'awaiting_approval') {
            return { error: 'Task is not awaiting approval', code: 'INVALID_STATE' }
          }

          // Update task status to running and continue execution
          this.db.updateAgentTask(request.taskId, {
            status: 'running',
            startedAt: new Date(),
          })

          // Emit status update
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AGENT_TASK_STATUS_UPDATE, {
              task: this.db.getAgentTask(request.taskId),
            })
          }

          // Continue task execution
          this.executeTaskAsync(request.taskId, task).catch((error: Error) => {
            console.error(`[IPCHandlers] Task ${request.taskId} execution error after approval:`, error)
          })

          return { task: this.db.getAgentTask(request.taskId) }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Reject task plan - stop execution and request changes
    ipcMain.handle(
      IPC_CHANNELS.TASK_REJECT_PLAN,
      async (_event, request: TaskRejectPlanRequest) => {
        try {
          const task = this.db.getAgentTask(request.taskId)
          if (!task) {
            return { error: 'Task not found', code: 'NOT_FOUND' }
          }

          // Task must be in awaiting_approval status
          if (task.status !== 'awaiting_approval') {
            return { error: 'Task is not awaiting approval', code: 'INVALID_STATE' }
          }

          // Abort any running execution
          const abortController = this.taskAbortControllers.get(request.taskId)
          if (abortController) {
            abortController.abort()
            this.taskAbortControllers.delete(request.taskId)
          }

          // Update task status to pending with feedback
          this.db.updateAgentTask(request.taskId, {
            status: 'pending',
            error: `Plan rejected: ${request.feedback}`,
          })

          // Add rejection feedback to output
          this.db.createTaskOutput({
            taskId: request.taskId,
            content: `\n--- Plan Rejected ---\nFeedback: ${request.feedback}\n`,
            stream: 'stderr',
          })

          // Emit status update
          const windows = BrowserWindow.getAllWindows()
          for (const window of windows) {
            window.webContents.send(IPC_CHANNELS.AGENT_TASK_STATUS_UPDATE, {
              task: this.db.getAgentTask(request.taskId),
            })
          }

          return { task: this.db.getAgentTask(request.taskId) }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Agent Configuration handlers
   * Persists agent configuration to the database settings table
   */
  private registerAgentConfigHandlers(): void {
    const AGENT_CONFIG_KEY = 'agent_config'

    // Default configuration
    const getDefaultConfig = (): AgentEnvironmentConfig => ({
      agentService: 'claude-code',
      anthropicAuthToken: '',
      anthropicBaseUrl: '',
      apiTimeoutMs: 30000,
      pythonPath: 'python',
      customEnvVars: {},
    })

    // Get agent config from database
    ipcMain.handle(IPC_CHANNELS.AGENT_CONFIG_GET, async () => {
      try {
        const stored = this.db.getSetting(AGENT_CONFIG_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          return { config: { ...getDefaultConfig(), ...parsed } }
        }
        return { config: getDefaultConfig() }
      } catch (error) {
        return this.handleError(error)
      }
    })

    // Set agent config - persist to database
    ipcMain.handle(
      IPC_CHANNELS.AGENT_CONFIG_SET,
      async (_event, request: AgentConfigSetRequest) => {
        try {
          // Get existing config
          const stored = this.db.getSetting(AGENT_CONFIG_KEY)
          const existing = stored ? JSON.parse(stored) : getDefaultConfig()

          // Merge updates
          const updated = { ...existing, ...request.updates }

          // Persist to database
          this.db.setSetting(AGENT_CONFIG_KEY, JSON.stringify(updated))

          return { success: true }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Validate agent config
    ipcMain.handle(
      IPC_CHANNELS.AGENT_CONFIG_VALIDATE,
      async (_event, request: AgentConfigValidateRequest) => {
        try {
          const errors: AgentConfigValidationError[] = []
          const config = request.config

          // Validate based on selected service
          if (config.agentService === 'claude-code') {
            if (!config.anthropicAuthToken) {
              errors.push({
                field: 'anthropicAuthToken',
                message: 'Anthropic API token is required for Claude Code',
              })
            }
          } else if (config.agentService === 'google-jules') {
            if (!config.googleApiKey) {
              errors.push({
                field: 'googleApiKey',
                message: 'Google API key is required for Jules',
              })
            }
          } else if (config.agentService === 'opencode') {
            // OpenCode can work with multiple providers, at least one key needed
            if (!config.openaiApiKey && !config.anthropicAuthToken && !config.openrouterApiKey) {
              errors.push({
                field: 'openaiApiKey',
                message: 'At least one API key is required for OpenCode',
              })
            }
          }

          return {
            result: {
              isValid: errors.length === 0,
              errors,
            },
          }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )

    // Check if agent is configured
    ipcMain.handle(IPC_CHANNELS.AGENT_CONFIG_IS_CONFIGURED, async () => {
      try {
        const stored = this.db.getSetting(AGENT_CONFIG_KEY)
        if (!stored) {
          return { isConfigured: false }
        }

        const config = JSON.parse(stored)
        // Check if at least one service has credentials configured
        const hasClaudeCode = !!config.anthropicAuthToken
        const hasJules = !!config.googleApiKey
        const hasOpenCode = !!(config.openaiApiKey || config.anthropicAuthToken || config.openrouterApiKey)
        const hasAider = !!(config.openaiApiKey || config.anthropicAuthToken)
        const hasCustom = !!config.customCommand

        return { isConfigured: hasClaudeCode || hasJules || hasOpenCode || hasAider || hasCustom }
      } catch (error) {
        return this.handleError(error)
      }
    })

    // Get configured services - return list of services that have valid credentials
    ipcMain.handle(
      IPC_CHANNELS.AGENT_CONFIG_GET_CONFIGURED_SERVICES,
      async () => {
        try {
          const stored = this.db.getSetting(AGENT_CONFIG_KEY)
          const services: TaskServiceType[] = []

          if (!stored) {
            return { services }
          }

          const config = JSON.parse(stored)

          // Check each service for valid configuration
          if (config.anthropicAuthToken) {
            services.push('claude-code')
          }
          if (config.googleApiKey) {
            services.push('google-jules')
          }
          if (config.openaiApiKey || config.anthropicAuthToken || config.openrouterApiKey) {
            services.push('opencode')
          }

          return { services }
        } catch (error) {
          return this.handleError(error)
        }
      }
    )
  }

  /**
   * Running Tasks handlers
   * Provides global view of all running agent tasks
   */
  private registerRunningTasksHandlers(): void {
    // Get all running tasks
    ipcMain.handle(IPC_CHANNELS.RUNNING_TASKS_GET_ALL, async () => {
      try {
        // Aggregate running tasks from globalProcessService if available
        if (this.globalProcessService) {
          const tasks = this.globalProcessService.getRunningTasks()
          return { tasks }
        }
        return { tasks: [] }
      } catch (error) {
        return this.handleError(error)
      }
    })

    // Stop a running task
    ipcMain.handle(
      IPC_CHANNELS.RUNNING_TASKS_STOP,
      async (_event, request: RunningTasksStopRequest) => {
        try {
          if (this.globalProcessService) {
            await this.globalProcessService.stopTask(request.taskId)
            return { success: true }
          }
          return { success: false, error: 'Global process service not available' }
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
