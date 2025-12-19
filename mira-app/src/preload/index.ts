import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from 'shared/ipc-types'
import type {
  FilesListRequest,
  FilesListResponse,
  FilesListShallowRequest,
  FilesListShallowResponse,
  FilesReadRequest,
  FilesReadResponse,
  FilesWriteRequest,
  FilesWriteResponse,
  ProjectListRequest,
  ProjectListResponse,
  ProjectGetRequest,
  ProjectGetResponse,
  ProjectCreateRequest,
  ProjectCreateResponse,
  ProjectUpdateRequest,
  ProjectUpdateResponse,
  ProjectDeleteRequest,
  ProjectDeleteResponse,
  TagListRequest,
  TagListResponse,
  TagCreateRequest,
  TagCreateResponse,
  TagAddToProjectRequest,
  TagAddToProjectResponse,
  TagRemoveFromProjectRequest,
  TagRemoveFromProjectResponse,
  GitTelemetryRequest,
  GitTelemetryResponse,
  GitStartRefreshRequest,
  GitStartRefreshResponse,
  GitStopRefreshRequest,
  GitStopRefreshResponse,
  GitFileDiffRequest,
  GitFileDiffResponse,
  PTYCreateRequest,
  PTYCreateResponse,
  PTYWriteRequest,
  PTYWriteResponse,
  PTYResizeRequest,
  PTYResizeResponse,
  PTYKillRequest,
  PTYKillResponse,
  PTYKillAllRequest,
  PTYKillAllResponse,
  PTYPinRequest,
  PTYPinResponse,
  PTYUnpinRequest,
  PTYUnpinResponse,
  PTYGetPinnedRequest,
  PTYGetPinnedResponse,
  KeychainGetRequest,
  KeychainGetResponse,
  KeychainSetRequest,
  KeychainSetResponse,
  KeychainDeleteRequest,
  KeychainDeleteResponse,
  KeychainHasRequest,
  KeychainHasResponse,
  SessionSaveRequest,
  SessionSaveResponse,
  SessionRestoreRequest,
  SessionRestoreResponse,
  SessionClearAllResponse,
  CommandListRequest,
  CommandListResponse,
  CommandCreateRequest,
  CommandCreateResponse,
  BlueprintListRequest,
  BlueprintListResponse,
  BlueprintCreateRequest,
  BlueprintCreateResponse,
  BlueprintCaptureRequest,
  BlueprintCaptureResponse,
  BlueprintApplyRequest,
  BlueprintApplyResponse,
  SettingGetRequest,
  SettingGetResponse,
  SettingSetRequest,
  SettingSetResponse,
  ShortcutListRequest,
  ShortcutListResponse,
  ShortcutSetRequest,
  ShortcutSetResponse,
  ShellOpenExternalRequest,
  ShellOpenExternalResponse,
  ShellOpenPathRequest,
  ShellOpenPathResponse,
  AgentSetModelRequest,
  AgentSetModelResponse,
  AgentGetModelRequest,
  AgentGetModelResponse,
  AgentGetModelsRequest,
  AgentGetModelsResponse,
  AgentSendMessageRequest,
  AgentSendMessageResponse,
  AgentGetConversationRequest,
  AgentGetConversationResponse,
  AgentClearConversationRequest,
  AgentClearConversationResponse,
  AgentAddContextFileRequest,
  AgentAddContextFileResponse,
  AgentRemoveContextFileRequest,
  AgentRemoveContextFileResponse,
  AgentGetContextFilesRequest,
  AgentGetContextFilesResponse,
  AgentGetTokenUsageRequest,
  AgentGetTokenUsageResponse,
  AgentGenerateFixRequest,
  AgentGenerateFixResponse,
  DialogOpenDirectoryRequest,
  DialogOpenDirectoryResponse,
  ScriptsGetRequest,
  ScriptsGetResponse,
  // New AI Service types
  AIGenerateTextRequest,
  AIGenerateTextResponse,
  AIStreamTextRequest,
  AIStreamTextResponse,
  AIStreamTextChunkData,
  AIGetModelsRequest,
  AIGetModelsResponse,
  AISetDefaultModelRequest,
  AISetDefaultModelResponse,
  AISetActionModelRequest,
  AISetActionModelResponse,
  AIGetConversationRequest,
  AIGetConversationResponse,
  AIClearConversationRequest,
  AIClearConversationResponse,
  AIGetRequestLogsRequest,
  AIGetRequestLogsResponse,
  AIGetRequestLogRequest,
  AIGetRequestLogResponse,
  // Agent Executor types
  AgentTaskCreateRequest,
  AgentTaskCreateResponse,
  AgentTaskGetRequest,
  AgentTaskGetResponse,
  AgentTaskListRequest,
  AgentTaskListResponse,
  AgentTaskUpdateRequest,
  AgentTaskUpdateResponse,
  AgentTaskDeleteRequest,
  AgentTaskDeleteResponse,
  AgentTaskStartRequest,
  AgentTaskStartResponse,
  AgentTaskPauseRequest,
  AgentTaskPauseResponse,
  AgentTaskResumeRequest,
  AgentTaskResumeResponse,
  AgentTaskStopRequest,
  AgentTaskStopResponse,
  AgentTaskGetOutputRequest,
  AgentTaskGetOutputResponse,
  AgentTaskOutputStreamData,
  // Agent Config types
  AgentConfigGetRequest,
  AgentConfigGetResponse,
  AgentConfigSetRequest,
  AgentConfigSetResponse,
  AgentConfigValidateRequest,
  AgentConfigValidateResponse,
  AgentConfigIsConfiguredRequest,
  AgentConfigIsConfiguredResponse,
  AgentConfigGetConfiguredServicesRequest,
  AgentConfigGetConfiguredServicesResponse,
  // Jules types
  JulesListSourcesRequest,
  JulesListSourcesResponse,
  JulesApprovePlanRequest,
  JulesApprovePlanResponse,
  JulesSendMessageRequest,
  JulesSendMessageResponse,
  JulesResyncTaskRequest,
  JulesResyncTaskResponse,
  JulesGetSessionStatusRequest,
  JulesGetSessionStatusResponse,
  JulesGetActivitiesRequest,
  JulesGetActivitiesResponse,
  JulesStatusUpdateData,
  // CLI Detection types
  CLIDetectRequest,
  CLIDetectResponse,
  CLIDetectAllRequest,
  CLIDetectAllResponse,
  CLIGetRecommendedRequest,
  CLIGetRecommendedResponse,
  CLIVerifyPathRequest,
  CLIVerifyPathResponse,
  CLIClearCacheRequest,
  CLIClearCacheResponse,
  // Running Projects types
  RunningProjectStartRequest,
  RunningProjectStartResponse,
  RunningProjectStopRequest,
  RunningProjectStopResponse,
  RunningProjectRestartRequest,
  RunningProjectRestartResponse,
  RunningProjectListRequest,
  RunningProjectListResponse,
  RunningProjectGetLogsRequest,
  RunningProjectGetLogsResponse,
  RunningProjectSetDevCommandRequest,
  RunningProjectSetDevCommandResponse,
  RunningProjectGetDevCommandRequest,
  RunningProjectGetDevCommandResponse,
  RunningProjectStatusUpdateData,
  RunningProjectOutputData,
} from 'shared/ipc-types'

/**
 * Mira API exposed to renderer process
 *
 * Provides typed IPC communication through contextBridge.
 * Requirements: 18.1
 */
const api = {
  // File operations
  files: {
    list: (request: FilesListRequest): Promise<FilesListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.FILES_LIST, request),
    listShallow: (
      request: FilesListShallowRequest
    ): Promise<FilesListShallowResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.FILES_LIST_SHALLOW, request),
    read: (request: FilesReadRequest): Promise<FilesReadResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.FILES_READ, request),
    write: (request: FilesWriteRequest): Promise<FilesWriteResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.FILES_WRITE, request),
  },

  // Project operations
  projects: {
    list: (request: ProjectListRequest): Promise<ProjectListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST, request),
    get: (request: ProjectGetRequest): Promise<ProjectGetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET, request),
    create: (request: ProjectCreateRequest): Promise<ProjectCreateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, request),
    update: (request: ProjectUpdateRequest): Promise<ProjectUpdateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE, request),
    delete: (request: ProjectDeleteRequest): Promise<ProjectDeleteResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, request),
  },

  // Tag operations
  tags: {
    list: (request: TagListRequest): Promise<TagListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TAG_LIST, request),
    create: (request: TagCreateRequest): Promise<TagCreateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TAG_CREATE, request),
    addToProject: (
      request: TagAddToProjectRequest
    ): Promise<TagAddToProjectResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TAG_ADD_TO_PROJECT, request),
    removeFromProject: (
      request: TagRemoveFromProjectRequest
    ): Promise<TagRemoveFromProjectResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TAG_REMOVE_FROM_PROJECT, request),
  },

  // Git operations
  git: {
    getTelemetry: (
      request: GitTelemetryRequest
    ): Promise<GitTelemetryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_TELEMETRY, request),
    startRefresh: (
      request: GitStartRefreshRequest
    ): Promise<GitStartRefreshResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_START_REFRESH, request),
    stopRefresh: (
      request: GitStopRefreshRequest
    ): Promise<GitStopRefreshResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_STOP_REFRESH, request),
    getFileDiff: (request: GitFileDiffRequest): Promise<GitFileDiffResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_FILE_DIFF, request),
  },

  // PTY/Terminal operations
  pty: {
    create: (request: PTYCreateRequest): Promise<PTYCreateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_CREATE, request),
    write: (request: PTYWriteRequest): Promise<PTYWriteResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_WRITE, request),
    resize: (request: PTYResizeRequest): Promise<PTYResizeResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_RESIZE, request),
    kill: (request: PTYKillRequest): Promise<PTYKillResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_KILL, request),
    killAll: (request: PTYKillAllRequest): Promise<PTYKillAllResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_KILL_ALL, request),
    pin: (request: PTYPinRequest): Promise<PTYPinResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_PIN, request),
    unpin: (request: PTYUnpinRequest): Promise<PTYUnpinResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_UNPIN, request),
    getPinned: (request: PTYGetPinnedRequest): Promise<PTYGetPinnedResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_GET_PINNED, request),
    onData: (ptyId: string, callback: (data: string) => void): (() => void) => {
      const channel = `${IPC_CHANNELS.PTY_DATA}:${ptyId}`
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: string
      ): void => callback(data)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (ptyId: string, callback: (code: number) => void): (() => void) => {
      const channel = `${IPC_CHANNELS.PTY_EXIT}:${ptyId}`
      const listener = (
        _event: Electron.IpcRendererEvent,
        code: number
      ): void => callback(code)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
  },

  // Keychain operations
  keychain: {
    get: (request: KeychainGetRequest): Promise<KeychainGetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.KEYCHAIN_GET, request),
    set: (request: KeychainSetRequest): Promise<KeychainSetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.KEYCHAIN_SET, request),
    delete: (request: KeychainDeleteRequest): Promise<KeychainDeleteResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.KEYCHAIN_DELETE, request),
    has: (request: KeychainHasRequest): Promise<KeychainHasResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.KEYCHAIN_HAS, request),
  },

  // Session operations
  sessions: {
    save: (request: SessionSaveRequest): Promise<SessionSaveResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_SAVE, request),
    restore: (
      request: SessionRestoreRequest
    ): Promise<SessionRestoreResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_RESTORE, request),
    clearAll: (): Promise<SessionClearAllResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_CLEAR_ALL, {}),
  },

  // Command library operations
  commands: {
    list: (request: CommandListRequest): Promise<CommandListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COMMAND_LIST, request),
    create: (request: CommandCreateRequest): Promise<CommandCreateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.COMMAND_CREATE, request),
  },

  // Blueprint operations
  blueprints: {
    list: (request: BlueprintListRequest): Promise<BlueprintListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.BLUEPRINT_LIST, request),
    create: (
      request: BlueprintCreateRequest
    ): Promise<BlueprintCreateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.BLUEPRINT_CREATE, request),
    capture: (
      request: BlueprintCaptureRequest
    ): Promise<BlueprintCaptureResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.BLUEPRINT_CAPTURE, request),
    apply: (request: BlueprintApplyRequest): Promise<BlueprintApplyResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.BLUEPRINT_APPLY, request),
  },

  // Settings operations
  settings: {
    get: (request: SettingGetRequest): Promise<SettingGetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTING_GET, request),
    set: (request: SettingSetRequest): Promise<SettingSetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTING_SET, request),
  },

  // Shortcut operations
  shortcuts: {
    list: (request: ShortcutListRequest): Promise<ShortcutListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SHORTCUT_LIST, request),
    set: (request: ShortcutSetRequest): Promise<ShortcutSetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SHORTCUT_SET, request),
  },

  // Shell operations
  shell: {
    openExternal: (
      request: ShellOpenExternalRequest
    ): Promise<ShellOpenExternalResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, request),
    openPath: (request: ShellOpenPathRequest): Promise<ShellOpenPathResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, request),
  },

  // Scripts operations
  scripts: {
    get: (request: ScriptsGetRequest): Promise<ScriptsGetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCRIPTS_GET, request),
  },

  // Dialog operations
  dialog: {
    openDirectory: (
      request: DialogOpenDirectoryRequest
    ): Promise<DialogOpenDirectoryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, request),
  },

  // AI Agent operations (legacy)
  agent: {
    setModel: (request: AgentSetModelRequest): Promise<AgentSetModelResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SET_MODEL, request),
    getModel: (request: AgentGetModelRequest): Promise<AgentGetModelResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_MODEL, request),
    getModels: (
      request: AgentGetModelsRequest
    ): Promise<AgentGetModelsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_MODELS, request),
    sendMessage: (
      request: AgentSendMessageRequest
    ): Promise<AgentSendMessageResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SEND_MESSAGE, request),
    getConversation: (
      request: AgentGetConversationRequest
    ): Promise<AgentGetConversationResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_CONVERSATION, request),
    clearConversation: (
      request: AgentClearConversationRequest
    ): Promise<AgentClearConversationResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_CLEAR_CONVERSATION, request),
    addContextFile: (
      request: AgentAddContextFileRequest
    ): Promise<AgentAddContextFileResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_ADD_CONTEXT_FILE, request),
    removeContextFile: (
      request: AgentRemoveContextFileRequest
    ): Promise<AgentRemoveContextFileResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_REMOVE_CONTEXT_FILE, request),
    getContextFiles: (
      request: AgentGetContextFilesRequest
    ): Promise<AgentGetContextFilesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_CONTEXT_FILES, request),
    getTokenUsage: (
      request: AgentGetTokenUsageRequest
    ): Promise<AgentGetTokenUsageResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_TOKEN_USAGE, request),
    generateFix: (
      request: AgentGenerateFixRequest
    ): Promise<AgentGenerateFixResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_GENERATE_FIX, request),
  },

  // AI Service operations (Vercel AI SDK)
  ai: {
    generateText: (
      request: AIGenerateTextRequest
    ): Promise<AIGenerateTextResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_TEXT, request),
    streamText: (request: AIStreamTextRequest): Promise<AIStreamTextResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_STREAM_TEXT, request),
    onStreamChunk: (
      callback: (data: AIStreamTextChunkData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AIStreamTextChunkData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AI_STREAM_TEXT_CHUNK, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_TEXT_CHUNK, listener)
    },
    getModels: (request: AIGetModelsRequest): Promise<AIGetModelsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GET_MODELS, request),
    setDefaultModel: (
      request: AISetDefaultModelRequest
    ): Promise<AISetDefaultModelResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_SET_DEFAULT_MODEL, request),
    setActionModel: (
      request: AISetActionModelRequest
    ): Promise<AISetActionModelResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_SET_ACTION_MODEL, request),
    getConversation: (
      request: AIGetConversationRequest
    ): Promise<AIGetConversationResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GET_CONVERSATION, request),
    clearConversation: (
      request: AIClearConversationRequest
    ): Promise<AIClearConversationResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_CLEAR_CONVERSATION, request),
    getRequestLogs: (
      request: AIGetRequestLogsRequest
    ): Promise<AIGetRequestLogsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GET_REQUEST_LOGS, request),
    getRequestLog: (
      request: AIGetRequestLogRequest
    ): Promise<AIGetRequestLogResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GET_REQUEST_LOG, request),
  },

  // Agent Executor operations
  agentTasks: {
    create: (
      request: AgentTaskCreateRequest
    ): Promise<AgentTaskCreateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_CREATE, request),
    get: (request: AgentTaskGetRequest): Promise<AgentTaskGetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_GET, request),
    list: (request: AgentTaskListRequest): Promise<AgentTaskListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_LIST, request),
    update: (
      request: AgentTaskUpdateRequest
    ): Promise<AgentTaskUpdateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_UPDATE, request),
    delete: (
      request: AgentTaskDeleteRequest
    ): Promise<AgentTaskDeleteResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_DELETE, request),
    start: (request: AgentTaskStartRequest): Promise<AgentTaskStartResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_START, request),
    pause: (request: AgentTaskPauseRequest): Promise<AgentTaskPauseResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_PAUSE, request),
    resume: (
      request: AgentTaskResumeRequest
    ): Promise<AgentTaskResumeResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_RESUME, request),
    stop: (request: AgentTaskStopRequest): Promise<AgentTaskStopResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_STOP, request),
    getOutput: (
      request: AgentTaskGetOutputRequest
    ): Promise<AgentTaskGetOutputResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_GET_OUTPUT, request),
    loadOutput: (
      request: AgentTaskGetOutputRequest
    ): Promise<AgentTaskGetOutputResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_LOAD_OUTPUT, request),
    subscribeOutput: (
      request: AgentTaskGetOutputRequest
    ): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_SUBSCRIBE_OUTPUT, request),
    onOutputLine: (
      callback: (data: AgentTaskOutputStreamData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AgentTaskOutputStreamData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AGENT_TASK_OUTPUT_STREAM, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AGENT_TASK_OUTPUT_STREAM,
          listener
        )
    },
  },

  // Agent Configuration operations
  agentConfig: {
    get: (request: AgentConfigGetRequest): Promise<AgentConfigGetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_CONFIG_GET, request),
    set: (request: AgentConfigSetRequest): Promise<AgentConfigSetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_CONFIG_SET, request),
    validate: (
      request: AgentConfigValidateRequest
    ): Promise<AgentConfigValidateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_CONFIG_VALIDATE, request),
    isConfigured: (
      request: AgentConfigIsConfiguredRequest
    ): Promise<AgentConfigIsConfiguredResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_CONFIG_IS_CONFIGURED, request),
    getConfiguredServices: (
      request: AgentConfigGetConfiguredServicesRequest
    ): Promise<AgentConfigGetConfiguredServicesResponse> =>
      ipcRenderer.invoke(
        IPC_CHANNELS.AGENT_CONFIG_GET_CONFIGURED_SERVICES,
        request
      ),
  },

  // Jules operations
  jules: {
    listSources: (
      request: JulesListSourcesRequest
    ): Promise<JulesListSourcesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.JULES_LIST_SOURCES, request),
    approvePlan: (
      request: JulesApprovePlanRequest
    ): Promise<JulesApprovePlanResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.JULES_APPROVE_PLAN, request),
    sendMessage: (
      request: JulesSendMessageRequest
    ): Promise<JulesSendMessageResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.JULES_SEND_MESSAGE, request),
    resyncTask: (
      request: JulesResyncTaskRequest
    ): Promise<JulesResyncTaskResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.JULES_RESYNC_TASK, request),
    getSessionStatus: (
      request: JulesGetSessionStatusRequest
    ): Promise<JulesGetSessionStatusResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.JULES_GET_SESSION_STATUS, request),
    getActivities: (
      request: JulesGetActivitiesRequest
    ): Promise<JulesGetActivitiesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.JULES_GET_ACTIVITIES, request),
    onStatusUpdate: (
      callback: (data: JulesStatusUpdateData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: JulesStatusUpdateData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.JULES_STATUS_UPDATE, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.JULES_STATUS_UPDATE, listener)
    },
  },

  // CLI Detection operations
  cli: {
    detect: (request: CLIDetectRequest): Promise<CLIDetectResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_DETECT, request),
    detectAll: (request: CLIDetectAllRequest): Promise<CLIDetectAllResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_DETECT_ALL, request),
    getRecommended: (
      request: CLIGetRecommendedRequest
    ): Promise<CLIGetRecommendedResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_GET_RECOMMENDED, request),
    verifyPath: (
      request: CLIVerifyPathRequest
    ): Promise<CLIVerifyPathResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_VERIFY_PATH, request),
    clearCache: (
      request: CLIClearCacheRequest
    ): Promise<CLIClearCacheResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_CLEAR_CACHE, request),
  },

  // Running Projects operations
  runningProjects: {
    start: (
      request: RunningProjectStartRequest
    ): Promise<RunningProjectStartResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.RUNNING_PROJECT_START, request),
    stop: (
      request: RunningProjectStopRequest
    ): Promise<RunningProjectStopResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.RUNNING_PROJECT_STOP, request),
    restart: (
      request: RunningProjectRestartRequest
    ): Promise<RunningProjectRestartResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.RUNNING_PROJECT_RESTART, request),
    list: (
      request: RunningProjectListRequest
    ): Promise<RunningProjectListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.RUNNING_PROJECT_LIST, request),
    getLogs: (
      request: RunningProjectGetLogsRequest
    ): Promise<RunningProjectGetLogsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.RUNNING_PROJECT_GET_LOGS, request),
    setDevCommand: (
      request: RunningProjectSetDevCommandRequest
    ): Promise<RunningProjectSetDevCommandResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.RUNNING_PROJECT_SET_DEV_COMMAND, request),
    getDevCommand: (
      request: RunningProjectGetDevCommandRequest
    ): Promise<RunningProjectGetDevCommandResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.RUNNING_PROJECT_GET_DEV_COMMAND, request),
    onStatusUpdate: (
      callback: (data: RunningProjectStatusUpdateData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: RunningProjectStatusUpdateData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.RUNNING_PROJECT_STATUS_UPDATE, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.RUNNING_PROJECT_STATUS_UPDATE,
          listener
        )
    },
    onOutput: (
      callback: (data: RunningProjectOutputData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: RunningProjectOutputData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.RUNNING_PROJECT_OUTPUT, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.RUNNING_PROJECT_OUTPUT,
          listener
        )
    },
  },
}

declare global {
  interface Window {
    api: typeof api
  }
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
contextBridge.exposeInMainWorld('api', api)
