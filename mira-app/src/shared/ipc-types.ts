// IPC channel definitions and request/response types for Mira Developer Hub

import type {
  Project,
  ProjectFilter,
  CreateProjectInput,
  UpdateProjectInput,
  Tag,
  CreateTagInput,
  SessionState,
  Command,
  CreateCommandInput,
  Blueprint,
  CreateBlueprintInput,
  GitTelemetry,
  AIProvider,
  AIModel,
  ContextFile,
  TokenUsage,
  ErrorContext,
  FixSuggestion,
  ConversationMessage,
  PinnedProcess,
} from './models'

// IPC Channel Constants
export const IPC_CHANNELS = {
  // Project operations
  PROJECT_LIST: 'project:list',
  PROJECT_GET: 'project:get',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',

  // Tag operations
  TAG_LIST: 'tag:list',
  TAG_CREATE: 'tag:create',
  TAG_ADD_TO_PROJECT: 'tag:addToProject',
  TAG_REMOVE_FROM_PROJECT: 'tag:removeFromProject',

  // Git operations
  GIT_STATUS: 'git:status',
  GIT_TELEMETRY: 'git:telemetry',
  GIT_START_REFRESH: 'git:startRefresh',
  GIT_STOP_REFRESH: 'git:stopRefresh',

  // Terminal/PTY operations
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_KILL_ALL: 'pty:killAll',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
  PTY_PIN: 'pty:pin',
  PTY_UNPIN: 'pty:unpin',
  PTY_GET_PINNED: 'pty:getPinned',

  // Keychain operations
  KEYCHAIN_GET: 'keychain:get',
  KEYCHAIN_SET: 'keychain:set',
  KEYCHAIN_DELETE: 'keychain:delete',
  KEYCHAIN_HAS: 'keychain:has',

  // Session operations
  SESSION_SAVE: 'session:save',
  SESSION_RESTORE: 'session:restore',

  // Command library operations
  COMMAND_LIST: 'command:list',
  COMMAND_CREATE: 'command:create',

  // Blueprint operations
  BLUEPRINT_LIST: 'blueprint:list',
  BLUEPRINT_CREATE: 'blueprint:create',
  BLUEPRINT_CAPTURE: 'blueprint:capture',
  BLUEPRINT_APPLY: 'blueprint:apply',

  // Settings operations
  SETTING_GET: 'setting:get',
  SETTING_SET: 'setting:set',

  // Shortcut operations
  SHORTCUT_LIST: 'shortcut:list',
  SHORTCUT_SET: 'shortcut:set',

  // AI Agent operations (legacy)
  AGENT_SET_MODEL: 'agent:setModel',
  AGENT_GET_MODEL: 'agent:getModel',
  AGENT_GET_MODELS: 'agent:getModels',
  AGENT_SEND_MESSAGE: 'agent:sendMessage',
  AGENT_GET_CONVERSATION: 'agent:getConversation',
  AGENT_CLEAR_CONVERSATION: 'agent:clearConversation',
  AGENT_ADD_CONTEXT_FILE: 'agent:addContextFile',
  AGENT_REMOVE_CONTEXT_FILE: 'agent:removeContextFile',
  AGENT_GET_CONTEXT_FILES: 'agent:getContextFiles',
  AGENT_GET_TOKEN_USAGE: 'agent:getTokenUsage',
  AGENT_GENERATE_FIX: 'agent:generateFix',

  // AI Service operations (new Vercel AI SDK)
  AI_GENERATE_TEXT: 'ai:generateText',
  AI_STREAM_TEXT: 'ai:streamText',
  AI_STREAM_TEXT_CHUNK: 'ai:streamTextChunk',
  AI_GET_MODELS: 'ai:getModels',
  AI_SET_DEFAULT_MODEL: 'ai:setDefaultModel',
  AI_SET_ACTION_MODEL: 'ai:setActionModel',
  AI_GET_CONVERSATION: 'ai:getConversation',
  AI_CLEAR_CONVERSATION: 'ai:clearConversation',
  AI_GET_REQUEST_LOGS: 'ai:getRequestLogs',
  AI_GET_REQUEST_LOG: 'ai:getRequestLog',

  // Agent Executor operations
  AGENT_TASK_CREATE: 'agentTask:create',
  AGENT_TASK_GET: 'agentTask:get',
  AGENT_TASK_LIST: 'agentTask:list',
  AGENT_TASK_UPDATE: 'agentTask:update',
  AGENT_TASK_DELETE: 'agentTask:delete',
  AGENT_TASK_START: 'agentTask:start',
  AGENT_TASK_PAUSE: 'agentTask:pause',
  AGENT_TASK_RESUME: 'agentTask:resume',
  AGENT_TASK_STOP: 'agentTask:stop',
  AGENT_TASK_GET_OUTPUT: 'agentTask:getOutput',
  AGENT_TASK_OUTPUT_STREAM: 'agentTask:outputStream',
  AGENT_TASK_SUBSCRIBE_OUTPUT: 'agentTask:subscribeOutput',

  // Agent Configuration operations
  AGENT_CONFIG_GET: 'agentConfig:get',
  AGENT_CONFIG_SET: 'agentConfig:set',
  AGENT_CONFIG_VALIDATE: 'agentConfig:validate',
  AGENT_CONFIG_IS_CONFIGURED: 'agentConfig:isConfigured',

  // Shell operations
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',
  SHELL_OPEN_PATH: 'shell:openPath',

  // Dialog operations
  DIALOG_OPEN_DIRECTORY: 'dialog:openDirectory',
} as const

// Project Request/Response Types
export interface ProjectListRequest {
  filter?: ProjectFilter
}

export interface ProjectListResponse {
  projects: Project[]
  totalCount: number
}

export interface ProjectGetRequest {
  id: string
}

export interface ProjectGetResponse {
  project: Project | null
}

export interface ProjectCreateRequest {
  data: CreateProjectInput
}

export interface ProjectCreateResponse {
  project: Project
}

export interface ProjectUpdateRequest {
  id: string
  data: UpdateProjectInput
}

export interface ProjectUpdateResponse {
  project: Project
}

export interface ProjectDeleteRequest {
  id: string
}

export interface ProjectDeleteResponse {
  success: boolean
}

// Tag Request/Response Types
export interface TagListRequest {}

export interface TagListResponse {
  tags: Tag[]
}

export interface TagCreateRequest {
  data: CreateTagInput
}

export interface TagCreateResponse {
  tag: Tag
}

export interface TagAddToProjectRequest {
  projectId: string
  tagId: string
}

export interface TagAddToProjectResponse {
  success: boolean
}

export interface TagRemoveFromProjectRequest {
  projectId: string
  tagId: string
}

export interface TagRemoveFromProjectResponse {
  success: boolean
}

// Git Request/Response Types
export interface GitTelemetryRequest {
  projectPath: string
}

export interface GitTelemetryResponse {
  telemetry: GitTelemetry
}

export interface GitStartRefreshRequest {
  projectId: string
  interval: number
}

export interface GitStartRefreshResponse {
  success: boolean
}

export interface GitStopRefreshRequest {
  projectId: string
}

export interface GitStopRefreshResponse {
  success: boolean
}

// PTY Request/Response Types
export interface PTYCreateRequest {
  projectId: string
  cwd: string
  shell?: string
}

export interface PTYCreateResponse {
  ptyId: string
}

export interface PTYWriteRequest {
  ptyId: string
  data: string
}

export interface PTYWriteResponse {
  success: boolean
}

export interface PTYResizeRequest {
  ptyId: string
  cols: number
  rows: number
}

export interface PTYResizeResponse {
  success: boolean
}

export interface PTYKillRequest {
  ptyId: string
}

export interface PTYKillResponse {
  success: boolean
}

export interface PTYKillAllRequest {}

export interface PTYKillAllResponse {
  success: boolean
}

export interface PTYPinRequest {
  ptyId: string
}

export interface PTYPinResponse {
  success: boolean
}

export interface PTYUnpinRequest {
  ptyId: string
}

export interface PTYUnpinResponse {
  success: boolean
}

export interface PTYGetPinnedRequest {}

export interface PTYGetPinnedResponse {
  processes: PinnedProcess[]
}

// Keychain Request/Response Types
export interface KeychainGetRequest {
  provider: AIProvider
}

export interface KeychainGetResponse {
  key: string | null
}

export interface KeychainSetRequest {
  provider: AIProvider
  key: string
}

export interface KeychainSetResponse {
  success: boolean
}

export interface KeychainDeleteRequest {
  provider: AIProvider
}

export interface KeychainDeleteResponse {
  success: boolean
}

export interface KeychainHasRequest {
  provider: AIProvider
}

export interface KeychainHasResponse {
  hasKey: boolean
}

// Session Request/Response Types
export interface SessionSaveRequest {
  projectId: string
  state: SessionState
}

export interface SessionSaveResponse {
  success: boolean
}

export interface SessionRestoreRequest {
  projectId: string
}

export interface SessionRestoreResponse {
  state: SessionState | null
}

// Command Request/Response Types
export interface CommandListRequest {}

export interface CommandListResponse {
  commands: Command[]
}

export interface CommandCreateRequest {
  data: CreateCommandInput
}

export interface CommandCreateResponse {
  command: Command
}

// Blueprint Request/Response Types
export interface BlueprintListRequest {}

export interface BlueprintListResponse {
  blueprints: Blueprint[]
}

export interface BlueprintCreateRequest {
  data: CreateBlueprintInput
}

export interface BlueprintCreateResponse {
  blueprint: Blueprint
}

export interface BlueprintApplyRequest {
  blueprintId: string
  targetPath: string
}

export interface BlueprintApplyResponse {
  success: boolean
}

export interface BlueprintCaptureRequest {
  projectPath: string
  customExcludePatterns?: string[]
}

export interface BlueprintCaptureResponse {
  structure: import('./models').BlueprintStructure
}

// Settings Request/Response Types
export interface SettingGetRequest {
  key: string
}

export interface SettingGetResponse {
  value: string | null
}

export interface SettingSetRequest {
  key: string
  value: string
}

export interface SettingSetResponse {
  success: boolean
}

// Shortcut Request/Response Types
export interface ShortcutListRequest {}

export interface ShortcutListResponse {
  shortcuts: Record<string, string>
}

export interface ShortcutSetRequest {
  action: string
  binding: string
}

export interface ShortcutSetResponse {
  success: boolean
}

// AI Agent Request/Response Types
export interface AgentSetModelRequest {
  model: AIModel
}

export interface AgentSetModelResponse {
  success: boolean
}

export interface AgentGetModelRequest {}

export interface AgentGetModelResponse {
  model: AIModel
}

export interface AgentGetModelsRequest {}

export interface AgentGetModelsResponse {
  models: AIModel[]
}

export interface AgentSendMessageRequest {
  projectId: string
  content: string
}

export interface AgentSendMessageResponse {
  message: ConversationMessage
}

export interface AgentGetConversationRequest {
  projectId: string
}

export interface AgentGetConversationResponse {
  messages: ConversationMessage[]
}

export interface AgentClearConversationRequest {
  projectId: string
}

export interface AgentClearConversationResponse {
  success: boolean
}

export interface AgentAddContextFileRequest {
  projectId: string
  filePath: string
}

export interface AgentAddContextFileResponse {
  file: ContextFile
}

export interface AgentRemoveContextFileRequest {
  projectId: string
  filePath: string
}

export interface AgentRemoveContextFileResponse {
  success: boolean
}

export interface AgentGetContextFilesRequest {
  projectId: string
}

export interface AgentGetContextFilesResponse {
  files: ContextFile[]
}

export interface AgentGetTokenUsageRequest {
  projectId: string
}

export interface AgentGetTokenUsageResponse {
  usage: TokenUsage
}

export interface AgentGenerateFixRequest {
  errorContext: ErrorContext
}

export interface AgentGenerateFixResponse {
  suggestion: FixSuggestion
}

// Shell Request/Response Types
export interface ShellOpenExternalRequest {
  url: string
}

export interface ShellOpenExternalResponse {
  success: boolean
}

export interface ShellOpenPathRequest {
  path: string
}

export interface ShellOpenPathResponse {
  success: boolean
}

// Dialog Request/Response Types
export interface DialogOpenDirectoryRequest {
  title?: string
  defaultPath?: string
}

export interface DialogOpenDirectoryResponse {
  path: string | null
  canceled: boolean
}

// Generic IPC Error Response
export interface IPCErrorResponse {
  error: string
  code?: string
  details?: unknown
}

// ============================================================================
// AI Service Request/Response Types (Vercel AI SDK)
// ============================================================================

export interface AIGenerateTextRequest {
  projectId: string
  content: string
  action?: import('./ai-types').AIAction
  systemPrompt?: string
}

export interface AIGenerateTextResponse {
  text: string
  usage: import('./ai-types').TokenUsage
  model: string
  finishReason: string
}

export interface AIStreamTextRequest {
  projectId: string
  content: string
  action?: import('./ai-types').AIAction
  systemPrompt?: string
  streamId: string
}

export interface AIStreamTextResponse {
  streamId: string
  started: boolean
}

export interface AIStreamTextChunkData {
  streamId: string
  text: string
  isComplete: boolean
  usage?: import('./ai-types').TokenUsage
  error?: string
}

export interface AIGetModelsRequest {}

export interface AIGetModelsResponse {
  models: import('./ai-types').AIModel[]
}

export interface AISetDefaultModelRequest {
  modelId: string
}

export interface AISetDefaultModelResponse {
  success: boolean
}

export interface AISetActionModelRequest {
  action: import('./ai-types').AIAction
  modelId: string
}

export interface AISetActionModelResponse {
  success: boolean
}

export interface AIGetConversationRequest {
  projectId: string
}

export interface AIGetConversationResponse {
  messages: import('./ai-types').ConversationMessage[]
}

export interface AIClearConversationRequest {
  projectId: string
}

export interface AIClearConversationResponse {
  success: boolean
}

export interface AIGetRequestLogsRequest {
  filter?: import('./ai-types').AILogFilter
}

export interface AIGetRequestLogsResponse {
  logs: import('./ai-types').AIRequestLog[]
}

export interface AIGetRequestLogRequest {
  logId: string
}

export interface AIGetRequestLogResponse {
  log: import('./ai-types').AIRequestLog | null
}

// ============================================================================
// Agent Executor Request/Response Types
// ============================================================================

export interface AgentTaskCreateRequest {
  description: string
  agentType: import('./ai-types').AgentType
  targetDirectory: string
  parameters?: import('./ai-types').AgentParameters
  priority?: number
}

export interface AgentTaskCreateResponse {
  task: import('./ai-types').AgentTask
}

export interface AgentTaskGetRequest {
  taskId: string
}

export interface AgentTaskGetResponse {
  task: import('./ai-types').AgentTask | null
}

export interface AgentTaskListRequest {
  filter?: import('./ai-types').AgentTaskFilter
}

export interface AgentTaskListResponse {
  tasks: import('./ai-types').AgentTask[]
}

export interface AgentTaskUpdateRequest {
  taskId: string
  updates: import('./ai-types').UpdateAgentTaskInput
}

export interface AgentTaskUpdateResponse {
  task: import('./ai-types').AgentTask
}

export interface AgentTaskDeleteRequest {
  taskId: string
}

export interface AgentTaskDeleteResponse {
  success: boolean
}

export interface AgentTaskStartRequest {
  taskId: string
}

export interface AgentTaskStartResponse {
  success: boolean
}

export interface AgentTaskPauseRequest {
  taskId: string
}

export interface AgentTaskPauseResponse {
  success: boolean
}

export interface AgentTaskResumeRequest {
  taskId: string
}

export interface AgentTaskResumeResponse {
  success: boolean
}

export interface AgentTaskStopRequest {
  taskId: string
}

export interface AgentTaskStopResponse {
  success: boolean
}

export interface AgentTaskGetOutputRequest {
  taskId: string
}

export interface AgentTaskGetOutputResponse {
  output: import('./ai-types').OutputLine[]
}

export interface AgentTaskOutputStreamData {
  taskId: string
  line: import('./ai-types').OutputLine
}

// ============================================================================
// Agent Configuration Request/Response Types
// ============================================================================

export interface AgentConfigGetRequest {}

export interface AgentConfigGetResponse {
  config: import('./ai-types').AgentEnvironmentConfig
}

export interface AgentConfigSetRequest {
  updates: import('./ai-types').UpdateAgentConfigInput
}

export interface AgentConfigSetResponse {
  success: boolean
}

export interface AgentConfigValidateRequest {
  config: import('./ai-types').AgentEnvironmentConfig
}

export interface AgentConfigValidateResponse {
  result: import('./ai-types').AgentConfigValidationResult
}

export interface AgentConfigIsConfiguredRequest {}

export interface AgentConfigIsConfiguredResponse {
  isConfigured: boolean
}
