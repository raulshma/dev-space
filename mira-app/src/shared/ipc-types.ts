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
  // File operations
  FILES_LIST: 'files:list',
  FILES_LIST_SHALLOW: 'files:listShallow',
  FILES_READ: 'files:read',
  FILES_WRITE: 'files:write',

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
  GIT_FILE_DIFF: 'git:fileDiff',

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
  SESSION_CLEAR_ALL: 'session:clearAll',

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
  AGENT_TASK_LOAD_OUTPUT: 'agentTask:loadOutput',
  AGENT_TASK_OUTPUT_STREAM: 'agentTask:outputStream',
  AGENT_TASK_SUBSCRIBE_OUTPUT: 'agentTask:subscribeOutput',

  // Agent Configuration operations
  AGENT_CONFIG_GET: 'agentConfig:get',
  AGENT_CONFIG_SET: 'agentConfig:set',
  AGENT_CONFIG_VALIDATE: 'agentConfig:validate',
  AGENT_CONFIG_IS_CONFIGURED: 'agentConfig:isConfigured',
  AGENT_CONFIG_GET_CONFIGURED_SERVICES: 'agentConfig:getConfiguredServices',

  // Jules operations
  JULES_LIST_SOURCES: 'jules:listSources',
  JULES_APPROVE_PLAN: 'jules:approvePlan',
  JULES_SEND_MESSAGE: 'jules:sendMessage',
  JULES_RESYNC_TASK: 'jules:resyncTask',
  JULES_GET_SESSION_STATUS: 'jules:getSessionStatus',
  JULES_GET_ACTIVITIES: 'jules:getActivities',
  JULES_STATUS_UPDATE: 'jules:statusUpdate',

  // Scripts operations
  SCRIPTS_GET: 'scripts:get',

  // Shell operations
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',
  SHELL_OPEN_PATH: 'shell:openPath',

  // Dialog operations
  DIALOG_OPEN_DIRECTORY: 'dialog:openDirectory',

  // CLI Detection operations
  CLI_DETECT: 'cli:detect',
  CLI_DETECT_ALL: 'cli:detectAll',
  CLI_GET_RECOMMENDED: 'cli:getRecommended',
  CLI_VERIFY_PATH: 'cli:verifyPath',
  CLI_CLEAR_CACHE: 'cli:clearCache',

  // Running Projects operations
  RUNNING_PROJECT_START: 'runningProject:start',
  RUNNING_PROJECT_STOP: 'runningProject:stop',
  RUNNING_PROJECT_RESTART: 'runningProject:restart',
  RUNNING_PROJECT_LIST: 'runningProject:list',
  RUNNING_PROJECT_GET_LOGS: 'runningProject:getLogs',
  RUNNING_PROJECT_SET_DEV_COMMAND: 'runningProject:setDevCommand',
  RUNNING_PROJECT_GET_DEV_COMMAND: 'runningProject:getDevCommand',
  RUNNING_PROJECT_STATUS_UPDATE: 'runningProject:statusUpdate',
  RUNNING_PROJECT_OUTPUT: 'runningProject:output',
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

export interface GitFileDiffRequest {
  projectPath: string
  filePath: string
  staged?: boolean
}

export interface GitFileDiffResponse {
  original: string
  modified: string
  language: string
  filePath: string
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

export interface SessionClearAllRequest {}

export interface SessionClearAllResponse {
  success: boolean
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

// Scripts Request/Response Types
export interface ProjectScript {
  name: string
  command: string
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
}

export interface ScriptsGetRequest {
  projectPath: string
}

export interface ScriptsGetResponse {
  scripts: ProjectScript[]
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
  hasPackageJson: boolean
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

// File System Request/Response Types
export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export interface FilesListRequest {
  path: string
  maxDepth?: number
}

export interface FilesListResponse {
  files: FileNode[]
}

export interface FilesListShallowRequest {
  path: string
}

export interface FilesListShallowResponse {
  files: FileNode[]
}

export interface FilesReadRequest {
  path: string
  maxSize?: number // Max file size in bytes (default 1MB)
}

export interface FilesReadResponse {
  content: string
  size: number
  isTruncated: boolean
  language: string
}

export interface FilesWriteRequest {
  path: string
  content: string
}

export interface FilesWriteResponse {
  success: boolean
  size: number
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
  serviceType?: import('./ai-types').TaskServiceType
  julesParams?: import('./ai-types').JulesParameters
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

export interface AgentConfigGetConfiguredServicesRequest {}

export interface AgentConfigGetConfiguredServicesResponse {
  services: import('./ai-types').TaskServiceType[]
}

// ============================================================================
// Jules Request/Response Types
// ============================================================================

export interface JulesSource {
  name: string
  id: string
  githubRepo?: {
    owner: string
    repo: string
  }
}

export interface JulesListSourcesRequest {}

export interface JulesListSourcesResponse {
  sources: JulesSource[]
  error?: string
}

export interface JulesApprovePlanRequest {
  sessionId: string
}

export interface JulesApprovePlanResponse {
  success: boolean
  error?: string
}

export interface JulesSendMessageRequest {
  sessionId: string
  message: string
}

export interface JulesSendMessageResponse {
  success: boolean
  error?: string
}

export interface JulesResyncTaskRequest {
  taskId: string
}

export interface JulesResyncTaskResponse {
  success: boolean
  status?: import('./notification-types').JulesSessionStatus
  error?: string
}

export interface JulesGetSessionStatusRequest {
  taskId: string
}

export interface JulesGetSessionStatusResponse {
  status: import('./notification-types').JulesSessionStatus | null
  error?: string
}

export interface JulesActivity {
  name: string
  id: string
  createTime: string
  originator: 'user' | 'agent'
  planGenerated?: {
    plan: {
      id: string
      steps: Array<{
        id: string
        title: string
        index?: number
      }>
    }
  }
  planApproved?: {
    planId: string
  }
  progressUpdated?: {
    title: string
    description?: string
  }
  sessionCompleted?: Record<string, never>
  /** Agent is waiting for user input/message */
  userMessageRequested?: {
    prompt?: string
  }
  /** User sent a message to the agent */
  userMessageSent?: {
    message: string
  }
  /** Agent sent a message */
  agentMessaged?: {
    agentMessage: string
  }
  artifacts?: Array<{
    bashOutput?: {
      command?: string
      output?: string
      exitCode?: number
    }
    changeSet?: {
      source: string
      gitPatch?: {
        unidiffPatch?: string
        baseCommitId?: string
        suggestedCommitMessage?: string
      }
    }
    media?: {
      data: string
      mimeType: string
    }
  }>
}

export interface JulesGetActivitiesRequest {
  taskId: string
}

export interface JulesGetActivitiesResponse {
  activities: JulesActivity[]
  error?: string
}

export interface JulesStatusUpdateData {
  taskId: string
  status: import('./notification-types').JulesSessionStatus
}

// ============================================================================
// CLI Detection Request/Response Types
// ============================================================================

/**
 * Supported CLI types for detection
 */
export type CLIType =
  | 'python'
  | 'node'
  | 'git'
  | 'npm'
  | 'pnpm'
  | 'yarn'
  | 'bun'
  | 'claude-code'
  | 'uv'
  | 'uvx'

/**
 * Information about a detected CLI/executable
 */
export interface DetectedCLI {
  /** Name of the CLI (e.g., 'python', 'node') */
  name: string
  /** Full path to the executable */
  path: string
  /** Version string if available */
  version?: string
  /** Whether this is the recommended/default option */
  isDefault: boolean
}

/**
 * Result of CLI detection for a specific tool
 */
export interface CLIDetectionResult {
  /** Whether the CLI was found */
  found: boolean
  /** All detected installations */
  installations: DetectedCLI[]
  /** The recommended installation to use */
  recommended?: DetectedCLI
  /** Error message if detection failed */
  error?: string
}

export interface CLIDetectRequest {
  cliType: CLIType
  useCache?: boolean
}

export interface CLIDetectResponse {
  result: CLIDetectionResult
}

export interface CLIDetectAllRequest {}

export interface CLIDetectAllResponse {
  results: Record<CLIType, CLIDetectionResult>
}

export interface CLIGetRecommendedRequest {
  cliType: CLIType
}

export interface CLIGetRecommendedResponse {
  path: string | null
}

export interface CLIVerifyPathRequest {
  cliType: CLIType
  path: string
}

export interface CLIVerifyPathResponse {
  valid: boolean
}

export interface CLIClearCacheRequest {}

export interface CLIClearCacheResponse {
  success: boolean
}

// ============================================================================
// Running Projects Request/Response Types
// ============================================================================

export interface RunningProjectStartRequest {
  projectId: string
  devCommand?: string
}

export interface RunningProjectStartResponse {
  project: import('./models').RunningProject
}

export interface RunningProjectStopRequest {
  projectId: string
}

export interface RunningProjectStopResponse {
  success: boolean
}

export interface RunningProjectRestartRequest {
  projectId: string
}

export interface RunningProjectRestartResponse {
  project: import('./models').RunningProject
}

export interface RunningProjectListRequest {}

export interface RunningProjectListResponse {
  projects: import('./models').RunningProject[]
}

export interface RunningProjectGetLogsRequest {
  projectId: string
  lines?: number
}

export interface RunningProjectGetLogsResponse {
  logs: string[]
}

export interface RunningProjectSetDevCommandRequest {
  projectId: string
  devCommand: string
}

export interface RunningProjectSetDevCommandResponse {
  success: boolean
}

export interface RunningProjectGetDevCommandRequest {
  projectId: string
}

export interface RunningProjectGetDevCommandResponse {
  devCommand: string | null
}

export interface RunningProjectStatusUpdateData {
  projectId: string
  status: import('./models').RunningProjectStatus
  error?: string
}

export interface RunningProjectOutputData {
  projectId: string
  data: string
}
