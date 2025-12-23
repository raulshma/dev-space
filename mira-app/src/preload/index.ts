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
  ShellOpenTerminalRequest,
  ShellOpenTerminalResponse,
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
  AgentTaskRestartRequest,
  AgentTaskRestartResponse,
  AgentTaskStopRequest,
  AgentTaskStopResponse,
  AgentTaskGetOutputRequest,
  AgentTaskGetOutputResponse,
  AgentTaskOutputStreamData,
  AgentTaskStatusUpdateData,
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
  // Running Tasks types
  RunningTasksGetAllResponse,
  RunningTasksStopRequest,
  RunningTasksStopResponse,
  RunningTasksUpdatedData,
  // Planning types
  TaskApprovePlanRequest,
  TaskApprovePlanResponse,
  TaskRejectPlanRequest,
  TaskRejectPlanResponse,
  TaskPlanGeneratedData,
  // Worktree types
  WorktreeCreateRequest,
  WorktreeCreateResponse,
  WorktreeDeleteRequest,
  WorktreeDeleteResponse,
  WorktreeListRequest,
  WorktreeListResponse,
  WorktreeGetForTaskRequest,
  WorktreeGetForTaskResponse,
  // Dependency types
  TaskSetDependenciesRequest,
  TaskSetDependenciesResponse,
  TaskGetDependenciesRequest,
  TaskGetDependenciesResponse,
  TaskGetBlockingStatusRequest,
  TaskGetBlockingStatusResponse,
  // Agent Session types
  AgentSessionCreateRequest,
  AgentSessionCreateResponse,
  AgentSessionGetRequest,
  AgentSessionGetResponse,
  AgentSessionListRequest,
  AgentSessionListResponse,
  AgentSessionUpdateRequest,
  AgentSessionUpdateResponse,
  AgentSessionArchiveRequest,
  AgentSessionArchiveResponse,
  AgentSessionDeleteRequest,
  AgentSessionDeleteResponse,
  AgentSessionAddMessageRequest,
  AgentSessionAddMessageResponse,
  AgentSessionGetMessagesRequest,
  AgentSessionGetMessagesResponse,
  AgentSessionGetLastRequest,
  AgentSessionGetLastResponse,
  AgentSessionSetLastRequest,
  AgentSessionSetLastResponse,
  // Agent Service V2 types (Claude SDK integration)
  AgentV2SessionCreateRequest,
  AgentV2SessionCreateResponse,
  AgentV2SessionGetRequest,
  AgentV2SessionGetResponse,
  AgentV2SessionListRequest,
  AgentV2SessionListResponse,
  AgentV2SessionUpdateRequest,
  AgentV2SessionUpdateResponse,
  AgentV2SessionArchiveRequest,
  AgentV2SessionArchiveResponse,
  AgentV2SessionDeleteRequest,
  AgentV2SessionDeleteResponse,
  AgentV2SessionClearRequest,
  AgentV2SessionClearResponse,
  AgentV2SendMessageRequest,
  AgentV2SendMessageResponse,
  AgentV2GetMessagesRequest,
  AgentV2GetMessagesResponse,
  AgentV2StopExecutionRequest,
  AgentV2StopExecutionResponse,
  AgentV2IsExecutingRequest,
  AgentV2IsExecutingResponse,
  AgentV2TextDeltaData,
  AgentV2MessageData,
  AgentV2ToolUseData,
  AgentV2ErrorData,
  AgentV2CompleteData,
  // Auto Mode Service V2 types (Claude SDK integration)
  AutoModeV2StartRequest,
  AutoModeV2StartResponse,
  AutoModeV2StopRequest,
  AutoModeV2StopResponse,
  AutoModeV2GetStateRequest,
  AutoModeV2GetStateResponse,
  AutoModeV2UpdateConfigRequest,
  AutoModeV2UpdateConfigResponse,
  AutoModeV2GetQueueRequest,
  AutoModeV2GetQueueResponse,
  AutoModeV2EnqueueFeatureRequest,
  AutoModeV2EnqueueFeatureResponse,
  AutoModeV2DequeueFeatureRequest,
  AutoModeV2DequeueFeatureResponse,
  AutoModeV2ExecuteFeatureRequest,
  AutoModeV2ExecuteFeatureResponse,
  AutoModeV2StopFeatureRequest,
  AutoModeV2StopFeatureResponse,
  AutoModeV2ApprovePlanRequest,
  AutoModeV2ApprovePlanResponse,
  AutoModeV2RejectPlanRequest,
  AutoModeV2RejectPlanResponse,
  AutoModeV2StateChangedData,
  AutoModeV2FeatureStartedData,
  AutoModeV2FeatureCompletedData,
  AutoModeV2FeatureFailedData,
  AutoModeV2FeatureProgressData,
  AutoModeV2PlanGeneratedData,
  AutoModeV2RateLimitWaitData,
  // Custom Theme types
  ThemeListRequest,
  ThemeListResponse,
  ThemeGetRequest,
  ThemeGetResponse,
  ThemeCreateRequest,
  ThemeCreateResponse,
  ThemeUpdateRequest,
  ThemeUpdateResponse,
  ThemeDeleteRequest,
  ThemeDeleteResponse,
  // OpenCode types
  OpencodeExecuteRequest,
  OpencodeExecuteResponse,
  OpencodeStopRequest,
  OpencodeStopResponse,
  OpencodeGetSessionsRequest,
  OpencodeGetSessionsResponse,
  OpencodeGetMessagesRequest,
  OpencodeGetMessagesResponse,
  OpencodeDeleteSessionRequest,
  OpencodeDeleteSessionResponse,
  OpencodeBackupConfigRequest,
  OpencodeBackupConfigResponse,
  OpencodeRestoreConfigRequest,
  OpencodeRestoreConfigResponse,
  OpencodeWriteConfigRequest,
  OpencodeWriteConfigResponse,
  OpencodeOutputData,
  OpencodeToolCallData,
  OpencodeToolResultData,
  OpencodeErrorData,
  OpencodeSessionInitData,
  OpencodeCompleteData,
  // Review Workflow types
  ReviewTransitionToReviewRequest,
  ReviewTransitionToReviewResponse,
  ReviewGetStatusRequest,
  ReviewGetStatusResponse,
  ReviewSubmitFeedbackRequest,
  ReviewSubmitFeedbackResponse,
  ReviewGetFeedbackHistoryRequest,
  ReviewGetFeedbackHistoryResponse,
  ReviewApproveChangesRequest,
  ReviewApproveChangesResponse,
  ReviewDiscardChangesRequest,
  ReviewDiscardChangesResponse,
  ReviewRunProjectRequest,
  ReviewRunProjectResponse,
  ReviewStopProjectRequest,
  ReviewStopProjectResponse,
  ReviewGetAvailableScriptsRequest,
  ReviewGetAvailableScriptsResponse,
  ReviewOpenTerminalRequest,
  ReviewOpenTerminalResponse,
  ReviewGetOpenTerminalsRequest,
  ReviewGetOpenTerminalsResponse,
  ReviewStatusUpdateData,
  // New Agent Service types (AI Agent Rework)
  AgentCreateSessionRequest,
  AgentCreateSessionResponse,
  AgentListSessionsRequest,
  AgentListSessionsResponse,
  AgentDeleteSessionRequest,
  AgentDeleteSessionResponse,
  AgentArchiveSessionRequest,
  AgentArchiveSessionResponse,
  AgentStartConversationRequest,
  AgentStartConversationResponse,
  AgentSendMessageRequest,
  AgentSendMessageResponse,
  AgentStopExecutionRequest,
  AgentStopExecutionResponse,
  AgentClearSessionRequest,
  AgentClearSessionResponse,
  AgentGetMessagesRequest,
  AgentGetMessagesResponse,
  AgentIsExecutingRequest,
  AgentIsExecutingResponse,
  AgentStreamData,
  AgentToolUseData,
  AgentErrorData,
  AgentCompleteData,
  // New Auto Mode Service types (AI Agent Rework)
  AutoModeStartRequest,
  AutoModeStartResponse,
  AutoModeStopRequest,
  AutoModeStopResponse,
  AutoModeGetStateRequest,
  AutoModeGetStateResponse,
  AutoModeUpdateConfigRequest,
  AutoModeUpdateConfigResponse,
  AutoModeGetQueueRequest,
  AutoModeGetQueueResponse,
  AutoModeEnqueueFeatureRequest,
  AutoModeEnqueueFeatureResponse,
  AutoModeDequeueFeatureRequest,
  AutoModeDequeueFeatureResponse,
  AutoModeExecuteFeatureRequest,
  AutoModeExecuteFeatureResponse,
  AutoModeResumeFeatureRequest,
  AutoModeResumeFeatureResponse,
  AutoModeCheckContextRequest,
  AutoModeCheckContextResponse,
  AutoModeStopFeatureRequest,
  AutoModeStopFeatureResponse,
  AutoModeApprovePlanRequest,
  AutoModeApprovePlanResponse,
  AutoModeRejectPlanRequest,
  AutoModeRejectPlanResponse,
  AutoModeStateChangedData,
  AutoModeFeatureStartedData,
  AutoModeFeatureCompletedData,
  AutoModeFeatureFailedData,
  AutoModeFeatureProgressData,
  AutoModePlanGeneratedData,
  AutoModeRateLimitWaitData,
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
    openTerminal: (
      request: ShellOpenTerminalRequest
    ): Promise<ShellOpenTerminalResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_TERMINAL, request),
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
    restart: (
      request: AgentTaskRestartRequest
    ): Promise<AgentTaskRestartResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_TASK_RESTART, request),
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
    onStatusUpdate: (
      callback: (data: AgentTaskStatusUpdateData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AgentTaskStatusUpdateData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AGENT_TASK_STATUS_UPDATE, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AGENT_TASK_STATUS_UPDATE,
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

  // DevTools operations
  devTools: {
    listPorts: (
      request: import('shared/ipc-types').DevToolsPortListRequest
    ): Promise<import('shared/ipc-types').DevToolsPortListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEVTOOLS_PORT_LIST, request),
    killPort: (
      request: import('shared/ipc-types').DevToolsPortKillRequest
    ): Promise<import('shared/ipc-types').DevToolsPortKillResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEVTOOLS_PORT_KILL, request),
    listTasks: (
      request: import('shared/ipc-types').DevToolsTaskListRequest
    ): Promise<import('shared/ipc-types').DevToolsTaskListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEVTOOLS_TASK_LIST, request),
    killTask: (
      request: import('shared/ipc-types').DevToolsTaskKillRequest
    ): Promise<import('shared/ipc-types').DevToolsTaskKillResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEVTOOLS_TASK_KILL, request),
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

  // Running Tasks Global View operations
  runningTasks: {
    getAll: (): Promise<RunningTasksGetAllResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.RUNNING_TASKS_GET_ALL, {}),
    stop: (
      request: RunningTasksStopRequest
    ): Promise<RunningTasksStopResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.RUNNING_TASKS_STOP, request),
    onUpdated: (
      callback: (data: RunningTasksUpdatedData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: RunningTasksUpdatedData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.RUNNING_TASKS_UPDATED, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.RUNNING_TASKS_UPDATED, listener)
    },
  },

  // Planning Mode operations
  planning: {
    approvePlan: (
      request: TaskApprovePlanRequest
    ): Promise<TaskApprovePlanResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_APPROVE_PLAN, request),
    rejectPlan: (
      request: TaskRejectPlanRequest
    ): Promise<TaskRejectPlanResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_REJECT_PLAN, request),
    onPlanGenerated: (
      callback: (data: TaskPlanGeneratedData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: TaskPlanGeneratedData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.TASK_PLAN_GENERATED, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.TASK_PLAN_GENERATED, listener)
    },
  },

  // Worktree operations
  worktrees: {
    create: (request: WorktreeCreateRequest): Promise<WorktreeCreateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKTREE_CREATE, request),
    delete: (request: WorktreeDeleteRequest): Promise<WorktreeDeleteResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKTREE_DELETE, request),
    list: (request: WorktreeListRequest): Promise<WorktreeListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKTREE_LIST, request),
    getForTask: (
      request: WorktreeGetForTaskRequest
    ): Promise<WorktreeGetForTaskResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKTREE_GET_FOR_TASK, request),
  },

  // Task Dependency operations
  dependencies: {
    set: (
      request: TaskSetDependenciesRequest
    ): Promise<TaskSetDependenciesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_SET_DEPENDENCIES, request),
    get: (
      request: TaskGetDependenciesRequest
    ): Promise<TaskGetDependenciesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_GET_DEPENDENCIES, request),
    getBlockingStatus: (
      request: TaskGetBlockingStatusRequest
    ): Promise<TaskGetBlockingStatusResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_GET_BLOCKING_STATUS, request),
  },

  // Agent Session Persistence operations
  agentSessions: {
    create: (
      request: AgentSessionCreateRequest
    ): Promise<AgentSessionCreateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_CREATE, request),
    get: (request: AgentSessionGetRequest): Promise<AgentSessionGetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_GET, request),
    list: (
      request: AgentSessionListRequest
    ): Promise<AgentSessionListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_LIST, request),
    update: (
      request: AgentSessionUpdateRequest
    ): Promise<AgentSessionUpdateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_UPDATE, request),
    archive: (
      request: AgentSessionArchiveRequest
    ): Promise<AgentSessionArchiveResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_ARCHIVE, request),
    delete: (
      request: AgentSessionDeleteRequest
    ): Promise<AgentSessionDeleteResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_DELETE, request),
    addMessage: (
      request: AgentSessionAddMessageRequest
    ): Promise<AgentSessionAddMessageResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_ADD_MESSAGE, request),
    getMessages: (
      request: AgentSessionGetMessagesRequest
    ): Promise<AgentSessionGetMessagesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_GET_MESSAGES, request),
    getLast: (
      request: AgentSessionGetLastRequest
    ): Promise<AgentSessionGetLastResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_GET_LAST, request),
    setLast: (
      request: AgentSessionSetLastRequest
    ): Promise<AgentSessionSetLastResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_SET_LAST, request),
  },

  // Agent Service V2 operations (Claude SDK integration)
  agentV2: {
    // Session management
    createSession: (
      request: AgentV2SessionCreateRequest
    ): Promise<AgentV2SessionCreateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_V2_SESSION_CREATE, request),
    getSession: (
      request: AgentV2SessionGetRequest
    ): Promise<AgentV2SessionGetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_V2_SESSION_GET, request),
    listSessions: (
      request: AgentV2SessionListRequest
    ): Promise<AgentV2SessionListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_V2_SESSION_LIST, request),
    updateSession: (
      request: AgentV2SessionUpdateRequest
    ): Promise<AgentV2SessionUpdateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_V2_SESSION_UPDATE, request),
    archiveSession: (
      request: AgentV2SessionArchiveRequest
    ): Promise<AgentV2SessionArchiveResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_V2_SESSION_ARCHIVE, request),
    deleteSession: (
      request: AgentV2SessionDeleteRequest
    ): Promise<AgentV2SessionDeleteResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_V2_SESSION_DELETE, request),
    clearSession: (
      request: AgentV2SessionClearRequest
    ): Promise<AgentV2SessionClearResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_V2_SESSION_CLEAR, request),

    // Message operations
    sendMessage: (
      request: AgentV2SendMessageRequest
    ): Promise<AgentV2SendMessageResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_V2_SEND_MESSAGE, request),
    getMessages: (
      request: AgentV2GetMessagesRequest
    ): Promise<AgentV2GetMessagesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_V2_GET_MESSAGES, request),

    // Execution control
    stopExecution: (
      request: AgentV2StopExecutionRequest
    ): Promise<AgentV2StopExecutionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_V2_STOP_EXECUTION, request),
    isExecuting: (
      request: AgentV2IsExecutingRequest
    ): Promise<AgentV2IsExecutingResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_V2_IS_EXECUTING, request),

    // Event subscriptions for streaming
    onTextDelta: (
      callback: (data: AgentV2TextDeltaData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AgentV2TextDeltaData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AGENT_V2_TEXT_DELTA, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.AGENT_V2_TEXT_DELTA, listener)
    },
    onMessage: (callback: (data: AgentV2MessageData) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AgentV2MessageData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AGENT_V2_MESSAGE, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.AGENT_V2_MESSAGE, listener)
    },
    onToolUse: (callback: (data: AgentV2ToolUseData) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AgentV2ToolUseData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AGENT_V2_TOOL_USE, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.AGENT_V2_TOOL_USE, listener)
    },
    onError: (callback: (data: AgentV2ErrorData) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AgentV2ErrorData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AGENT_V2_ERROR, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.AGENT_V2_ERROR, listener)
    },
    onComplete: (
      callback: (data: AgentV2CompleteData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AgentV2CompleteData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AGENT_V2_COMPLETE, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.AGENT_V2_COMPLETE, listener)
    },
  },

  // Auto Mode Service V2 operations (Claude SDK integration)
  autoModeV2: {
    // Auto mode control
    start: (
      request: AutoModeV2StartRequest
    ): Promise<AutoModeV2StartResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_V2_START, request),
    stop: (request: AutoModeV2StopRequest): Promise<AutoModeV2StopResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_V2_STOP, request),
    getState: (
      request: AutoModeV2GetStateRequest
    ): Promise<AutoModeV2GetStateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_V2_GET_STATE, request),
    updateConfig: (
      request: AutoModeV2UpdateConfigRequest
    ): Promise<AutoModeV2UpdateConfigResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_V2_UPDATE_CONFIG, request),

    // Feature queue operations
    getQueue: (
      request: AutoModeV2GetQueueRequest
    ): Promise<AutoModeV2GetQueueResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_V2_GET_QUEUE, request),
    enqueueFeature: (
      request: AutoModeV2EnqueueFeatureRequest
    ): Promise<AutoModeV2EnqueueFeatureResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_V2_ENQUEUE_FEATURE, request),
    dequeueFeature: (
      request: AutoModeV2DequeueFeatureRequest
    ): Promise<AutoModeV2DequeueFeatureResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_V2_DEQUEUE_FEATURE, request),

    // Feature execution
    executeFeature: (
      request: AutoModeV2ExecuteFeatureRequest
    ): Promise<AutoModeV2ExecuteFeatureResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_V2_EXECUTE_FEATURE, request),
    stopFeature: (
      request: AutoModeV2StopFeatureRequest
    ): Promise<AutoModeV2StopFeatureResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_V2_STOP_FEATURE, request),

    // Plan approval workflow
    approvePlan: (
      request: AutoModeV2ApprovePlanRequest
    ): Promise<AutoModeV2ApprovePlanResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_V2_APPROVE_PLAN, request),
    rejectPlan: (
      request: AutoModeV2RejectPlanRequest
    ): Promise<AutoModeV2RejectPlanResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_V2_REJECT_PLAN, request),

    // Event subscriptions
    onStateChanged: (
      callback: (data: AutoModeV2StateChangedData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeV2StateChangedData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_V2_STATE_CHANGED, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_V2_STATE_CHANGED,
          listener
        )
    },
    onFeatureStarted: (
      callback: (data: AutoModeV2FeatureStartedData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeV2FeatureStartedData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_V2_FEATURE_STARTED, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_V2_FEATURE_STARTED,
          listener
        )
    },
    onFeatureCompleted: (
      callback: (data: AutoModeV2FeatureCompletedData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeV2FeatureCompletedData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_V2_FEATURE_COMPLETED, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_V2_FEATURE_COMPLETED,
          listener
        )
    },
    onFeatureFailed: (
      callback: (data: AutoModeV2FeatureFailedData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeV2FeatureFailedData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_V2_FEATURE_FAILED, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_V2_FEATURE_FAILED,
          listener
        )
    },
    onFeatureProgress: (
      callback: (data: AutoModeV2FeatureProgressData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeV2FeatureProgressData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_V2_FEATURE_PROGRESS, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_V2_FEATURE_PROGRESS,
          listener
        )
    },
    onPlanGenerated: (
      callback: (data: AutoModeV2PlanGeneratedData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeV2PlanGeneratedData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_V2_PLAN_GENERATED, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_V2_PLAN_GENERATED,
          listener
        )
    },
    onRateLimitWait: (
      callback: (data: AutoModeV2RateLimitWaitData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeV2RateLimitWaitData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_V2_RATE_LIMIT_WAIT, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_V2_RATE_LIMIT_WAIT,
          listener
        )
    },
  },

  // Custom Theme operations
  themes: {
    list: (request: ThemeListRequest): Promise<ThemeListResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.THEME_LIST, request),
    get: (request: ThemeGetRequest): Promise<ThemeGetResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.THEME_GET, request),
    create: (request: ThemeCreateRequest): Promise<ThemeCreateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.THEME_CREATE, request),
    update: (request: ThemeUpdateRequest): Promise<ThemeUpdateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.THEME_UPDATE, request),
    delete: (request: ThemeDeleteRequest): Promise<ThemeDeleteResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.THEME_DELETE, request),
  },

  // OpenCode SDK operations
  opencode: {
    execute: (
      request: OpencodeExecuteRequest
    ): Promise<OpencodeExecuteResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_EXECUTE, request),
    stop: (request: OpencodeStopRequest): Promise<OpencodeStopResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_STOP, request),
    getSessions: (
      request: OpencodeGetSessionsRequest
    ): Promise<OpencodeGetSessionsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_GET_SESSIONS, request),
    getMessages: (
      request: OpencodeGetMessagesRequest
    ): Promise<OpencodeGetMessagesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_GET_MESSAGES, request),
    deleteSession: (
      request: OpencodeDeleteSessionRequest
    ): Promise<OpencodeDeleteSessionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_DELETE_SESSION, request),
    backupConfig: (
      request: OpencodeBackupConfigRequest
    ): Promise<OpencodeBackupConfigResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_BACKUP_CONFIG, request),
    restoreConfig: (
      request: OpencodeRestoreConfigRequest
    ): Promise<OpencodeRestoreConfigResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_RESTORE_CONFIG, request),
    writeConfig: (
      request: OpencodeWriteConfigRequest
    ): Promise<OpencodeWriteConfigResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_WRITE_CONFIG, request),
    // Event listeners
    onOutput: (callback: (data: OpencodeOutputData) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: OpencodeOutputData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.OPENCODE_OUTPUT, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.OPENCODE_OUTPUT, listener)
    },
    onToolCall: (
      callback: (data: OpencodeToolCallData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: OpencodeToolCallData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.OPENCODE_TOOL_CALL, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.OPENCODE_TOOL_CALL, listener)
    },
    onToolResult: (
      callback: (data: OpencodeToolResultData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: OpencodeToolResultData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.OPENCODE_TOOL_RESULT, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.OPENCODE_TOOL_RESULT, listener)
    },
    onError: (callback: (data: OpencodeErrorData) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: OpencodeErrorData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.OPENCODE_ERROR, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.OPENCODE_ERROR, listener)
    },
    onSessionInit: (
      callback: (data: OpencodeSessionInitData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: OpencodeSessionInitData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.OPENCODE_SESSION_INIT, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.OPENCODE_SESSION_INIT, listener)
    },
    onComplete: (
      callback: (data: OpencodeCompleteData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: OpencodeCompleteData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.OPENCODE_COMPLETE, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.OPENCODE_COMPLETE, listener)
    },
  },

  // Review Workflow operations
  review: {
    transitionToReview: (
      request: ReviewTransitionToReviewRequest
    ): Promise<ReviewTransitionToReviewResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_TRANSITION_TO_REVIEW, request),
    getStatus: (
      request: ReviewGetStatusRequest
    ): Promise<ReviewGetStatusResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_GET_STATUS, request),
    submitFeedback: (
      request: ReviewSubmitFeedbackRequest
    ): Promise<ReviewSubmitFeedbackResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_SUBMIT_FEEDBACK, request),
    getFeedbackHistory: (
      request: ReviewGetFeedbackHistoryRequest
    ): Promise<ReviewGetFeedbackHistoryResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_GET_FEEDBACK_HISTORY, request),
    approveChanges: (
      request: ReviewApproveChangesRequest
    ): Promise<ReviewApproveChangesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_APPROVE_CHANGES, request),
    discardChanges: (
      request: ReviewDiscardChangesRequest
    ): Promise<ReviewDiscardChangesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_DISCARD_CHANGES, request),
    runProject: (
      request: ReviewRunProjectRequest
    ): Promise<ReviewRunProjectResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_RUN_PROJECT, request),
    stopProject: (
      request: ReviewStopProjectRequest
    ): Promise<ReviewStopProjectResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_STOP_PROJECT, request),
    getAvailableScripts: (
      request: ReviewGetAvailableScriptsRequest
    ): Promise<ReviewGetAvailableScriptsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_GET_AVAILABLE_SCRIPTS, request),
    openTerminal: (
      request: ReviewOpenTerminalRequest
    ): Promise<ReviewOpenTerminalResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_OPEN_TERMINAL, request),
    getOpenTerminals: (
      request: ReviewGetOpenTerminalsRequest
    ): Promise<ReviewGetOpenTerminalsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_GET_OPEN_TERMINALS, request),
    // Event listener for review status updates
    onStatusUpdate: (
      callback: (data: ReviewStatusUpdateData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: ReviewStatusUpdateData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.REVIEW_STATUS_UPDATE, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.REVIEW_STATUS_UPDATE, listener)
    },
  },

  // New Agent Service operations (AI Agent Rework)
  agent: {
    // Session management
    createSession: (
      request: AgentCreateSessionRequest
    ): Promise<AgentCreateSessionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_CREATE_SESSION, request),
    listSessions: (
      request: AgentListSessionsRequest
    ): Promise<AgentListSessionsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_LIST_SESSIONS, request),
    deleteSession: (
      request: AgentDeleteSessionRequest
    ): Promise<AgentDeleteSessionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_DELETE_SESSION, request),
    archiveSession: (
      request: AgentArchiveSessionRequest
    ): Promise<AgentArchiveSessionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_ARCHIVE_SESSION, request),

    // Conversation operations
    startConversation: (
      request: AgentStartConversationRequest
    ): Promise<AgentStartConversationResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_START_CONVERSATION, request),
    sendMessage: (
      request: AgentSendMessageRequest
    ): Promise<AgentSendMessageResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SEND_MESSAGE, request),
    getMessages: (
      request: AgentGetMessagesRequest
    ): Promise<AgentGetMessagesResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_MESSAGES, request),
    clearSession: (
      request: AgentClearSessionRequest
    ): Promise<AgentClearSessionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_CLEAR_SESSION, request),

    // Execution control
    stopExecution: (
      request: AgentStopExecutionRequest
    ): Promise<AgentStopExecutionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_STOP_EXECUTION, request),
    isExecuting: (
      request: AgentIsExecutingRequest
    ): Promise<AgentIsExecutingResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_IS_EXECUTING, request),

    // Event subscriptions for streaming
    onStream: (callback: (data: AgentStreamData) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AgentStreamData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AGENT_STREAM, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.AGENT_STREAM, listener)
    },
    onToolUse: (callback: (data: AgentToolUseData) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AgentToolUseData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AGENT_TOOL_USE, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.AGENT_TOOL_USE, listener)
    },
    onError: (callback: (data: AgentErrorData) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AgentErrorData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AGENT_ERROR, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.AGENT_ERROR, listener)
    },
    onComplete: (callback: (data: AgentCompleteData) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AgentCompleteData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AGENT_COMPLETE, listener)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.AGENT_COMPLETE, listener)
    },
  },

  // New Auto Mode Service operations (AI Agent Rework)
  autoMode: {
    // Auto mode control
    start: (request: AutoModeStartRequest): Promise<AutoModeStartResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_START, request),
    stop: (request: AutoModeStopRequest): Promise<AutoModeStopResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_STOP, request),
    getState: (
      request: AutoModeGetStateRequest
    ): Promise<AutoModeGetStateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_GET_STATE, request),
    updateConfig: (
      request: AutoModeUpdateConfigRequest
    ): Promise<AutoModeUpdateConfigResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_UPDATE_CONFIG, request),

    // Feature queue operations
    getQueue: (
      request: AutoModeGetQueueRequest
    ): Promise<AutoModeGetQueueResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_GET_QUEUE, request),
    enqueueFeature: (
      request: AutoModeEnqueueFeatureRequest
    ): Promise<AutoModeEnqueueFeatureResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_ENQUEUE_FEATURE, request),
    dequeueFeature: (
      request: AutoModeDequeueFeatureRequest
    ): Promise<AutoModeDequeueFeatureResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_DEQUEUE_FEATURE, request),

    // Feature execution
    executeFeature: (
      request: AutoModeExecuteFeatureRequest
    ): Promise<AutoModeExecuteFeatureResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_EXECUTE_FEATURE, request),
    resumeFeature: (
      request: AutoModeResumeFeatureRequest
    ): Promise<AutoModeResumeFeatureResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_RESUME_FEATURE, request),
    checkContext: (
      request: AutoModeCheckContextRequest
    ): Promise<AutoModeCheckContextResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_CHECK_CONTEXT, request),
    stopFeature: (
      request: AutoModeStopFeatureRequest
    ): Promise<AutoModeStopFeatureResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_STOP_FEATURE, request),

    // Plan approval workflow
    approvePlan: (
      request: AutoModeApprovePlanRequest
    ): Promise<AutoModeApprovePlanResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_APPROVE_PLAN, request),
    rejectPlan: (
      request: AutoModeRejectPlanRequest
    ): Promise<AutoModeRejectPlanResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTO_MODE_REJECT_PLAN, request),

    // Event subscriptions
    onStateChanged: (
      callback: (data: AutoModeStateChangedData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeStateChangedData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_STATE_CHANGED, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_STATE_CHANGED,
          listener
        )
    },
    onFeatureStarted: (
      callback: (data: AutoModeFeatureStartedData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeFeatureStartedData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_FEATURE_STARTED, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_FEATURE_STARTED,
          listener
        )
    },
    onFeatureCompleted: (
      callback: (data: AutoModeFeatureCompletedData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeFeatureCompletedData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_FEATURE_COMPLETED, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_FEATURE_COMPLETED,
          listener
        )
    },
    onFeatureFailed: (
      callback: (data: AutoModeFeatureFailedData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeFeatureFailedData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_FEATURE_FAILED, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_FEATURE_FAILED,
          listener
        )
    },
    onFeatureProgress: (
      callback: (data: AutoModeFeatureProgressData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeFeatureProgressData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_FEATURE_PROGRESS, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_FEATURE_PROGRESS,
          listener
        )
    },
    onPlanGenerated: (
      callback: (data: AutoModePlanGeneratedData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModePlanGeneratedData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_PLAN_GENERATED, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_PLAN_GENERATED,
          listener
        )
    },
    onRateLimitWait: (
      callback: (data: AutoModeRateLimitWaitData) => void
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: AutoModeRateLimitWaitData
      ): void => callback(data)
      ipcRenderer.on(IPC_CHANNELS.AUTO_MODE_RATE_LIMIT_WAIT, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.AUTO_MODE_RATE_LIMIT_WAIT,
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
