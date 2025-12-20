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
  PinnedProcess,
  CustomTheme,
  CreateCustomThemeInput,
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

  // AI Service operations (Vercel AI SDK)
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
  AI_GET_MODEL_SETTINGS: 'ai:getModelSettings',

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

  // DevTools operations
  DEVTOOLS_PORT_LIST: 'devtools:port:list',
  DEVTOOLS_PORT_KILL: 'devtools:port:kill',
  DEVTOOLS_TASK_LIST: 'devtools:task:list',
  DEVTOOLS_TASK_KILL: 'devtools:task:kill',

  // Running Tasks Global View operations
  RUNNING_TASKS_GET_ALL: 'runningTasks:getAll',
  RUNNING_TASKS_STOP: 'runningTasks:stop',
  RUNNING_TASKS_UPDATED: 'runningTasks:updated', // event

  // Planning Mode operations
  TASK_APPROVE_PLAN: 'task:approvePlan',
  TASK_REJECT_PLAN: 'task:rejectPlan',
  TASK_PLAN_GENERATED: 'task:planGenerated', // event

  // Worktree operations
  WORKTREE_CREATE: 'worktree:create',
  WORKTREE_DELETE: 'worktree:delete',
  WORKTREE_LIST: 'worktree:list',
  WORKTREE_GET_FOR_TASK: 'worktree:getForTask',

  // Task Dependency operations
  TASK_SET_DEPENDENCIES: 'task:setDependencies',
  TASK_GET_DEPENDENCIES: 'task:getDependencies',
  TASK_GET_BLOCKING_STATUS: 'task:getBlockingStatus',

  // Agent Session operations (new session persistence)
  AGENT_SESSION_CREATE: 'agentSession:create',
  AGENT_SESSION_GET: 'agentSession:get',
  AGENT_SESSION_LIST: 'agentSession:list',
  AGENT_SESSION_UPDATE: 'agentSession:update',
  AGENT_SESSION_ARCHIVE: 'agentSession:archive',
  AGENT_SESSION_DELETE: 'agentSession:delete',
  AGENT_SESSION_ADD_MESSAGE: 'agentSession:addMessage',
  AGENT_SESSION_GET_MESSAGES: 'agentSession:getMessages',
  AGENT_SESSION_GET_LAST: 'agentSession:getLast',
  AGENT_SESSION_SET_LAST: 'agentSession:setLast',

  // Agent Service V2 operations (Claude SDK integration)
  AGENT_V2_SESSION_CREATE: 'agentV2:sessionCreate',
  AGENT_V2_SESSION_GET: 'agentV2:sessionGet',
  AGENT_V2_SESSION_LIST: 'agentV2:sessionList',
  AGENT_V2_SESSION_UPDATE: 'agentV2:sessionUpdate',
  AGENT_V2_SESSION_ARCHIVE: 'agentV2:sessionArchive',
  AGENT_V2_SESSION_DELETE: 'agentV2:sessionDelete',
  AGENT_V2_SESSION_CLEAR: 'agentV2:sessionClear',
  AGENT_V2_SEND_MESSAGE: 'agentV2:sendMessage',
  AGENT_V2_GET_MESSAGES: 'agentV2:getMessages',
  AGENT_V2_STOP_EXECUTION: 'agentV2:stopExecution',
  AGENT_V2_IS_EXECUTING: 'agentV2:isExecuting',
  AGENT_V2_TEXT_DELTA: 'agentV2:textDelta',
  AGENT_V2_MESSAGE: 'agentV2:message',
  AGENT_V2_TOOL_USE: 'agentV2:toolUse',
  AGENT_V2_ERROR: 'agentV2:error',
  AGENT_V2_COMPLETE: 'agentV2:complete',

  // Auto Mode Service V2 operations (Claude SDK integration)
  AUTO_MODE_V2_START: 'autoModeV2:start',
  AUTO_MODE_V2_STOP: 'autoModeV2:stop',
  AUTO_MODE_V2_GET_STATE: 'autoModeV2:getState',
  AUTO_MODE_V2_UPDATE_CONFIG: 'autoModeV2:updateConfig',
  AUTO_MODE_V2_GET_QUEUE: 'autoModeV2:getQueue',
  AUTO_MODE_V2_ENQUEUE_FEATURE: 'autoModeV2:enqueueFeature',
  AUTO_MODE_V2_DEQUEUE_FEATURE: 'autoModeV2:dequeueFeature',
  AUTO_MODE_V2_EXECUTE_FEATURE: 'autoModeV2:executeFeature',
  AUTO_MODE_V2_STOP_FEATURE: 'autoModeV2:stopFeature',
  AUTO_MODE_V2_APPROVE_PLAN: 'autoModeV2:approvePlan',
  AUTO_MODE_V2_REJECT_PLAN: 'autoModeV2:rejectPlan',
  AUTO_MODE_V2_STATE_CHANGED: 'autoModeV2:stateChanged',
  AUTO_MODE_V2_FEATURE_STARTED: 'autoModeV2:featureStarted',
  AUTO_MODE_V2_FEATURE_COMPLETED: 'autoModeV2:featureCompleted',
  AUTO_MODE_V2_FEATURE_FAILED: 'autoModeV2:featureFailed',
  AUTO_MODE_V2_FEATURE_PROGRESS: 'autoModeV2:featureProgress',
  AUTO_MODE_V2_PLAN_GENERATED: 'autoModeV2:planGenerated',
  AUTO_MODE_V2_RATE_LIMIT_WAIT: 'autoModeV2:rateLimitWait',

  // Custom Theme operations
  THEME_LIST: 'theme:list',
  THEME_GET: 'theme:get',
  THEME_CREATE: 'theme:create',
  THEME_UPDATE: 'theme:update',
  THEME_DELETE: 'theme:delete',
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

// Custom Theme Request/Response Types
export interface ThemeListRequest {}

export interface ThemeListResponse {
  themes: CustomTheme[]
}

export interface ThemeGetRequest {
  id: string
}

export interface ThemeGetResponse {
  theme: CustomTheme | null
}

export interface ThemeCreateRequest {
  data: CreateCustomThemeInput
}

export interface ThemeCreateResponse {
  theme: CustomTheme
}

export interface ThemeUpdateRequest {
  id: string
  data: Partial<CreateCustomThemeInput>
}

export interface ThemeUpdateResponse {
  theme: CustomTheme
}

export interface ThemeDeleteRequest {
  id: string
}

export interface ThemeDeleteResponse {
  success: boolean
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
  defaultModelId: string | null
  actionModels: Record<import('./ai-types').AIAction, string>
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

export interface AIGetModelSettingsRequest {}

export interface AIGetModelSettingsResponse {
  defaultModelId: string | null
  actionModels: Record<import('./ai-types').AIAction, string>
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
  planningMode?: import('./ai-types').PlanningMode
  requirePlanApproval?: boolean
  branchName?: string
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

// ============================================================================
// DevTools Request/Response Types
// ============================================================================

export interface DevToolsPortListRequest {
  filter?: string
}

export interface DevToolsPortListResponse {
  ports: Array<{
    port: number
    pid: number
    processName: string
    protocol: 'tcp' | 'udp'
    state: string
  }>
  error?: string
}

export interface DevToolsPortKillRequest {
  port: number
}

export interface DevToolsPortKillResponse {
  success: boolean
  error?: string
}

export interface DevToolsTaskListRequest {
  filter?: string
}

export interface DevToolsTaskListResponse {
  processes: Array<{
    pid: number
    name: string
    cpu: number
    memory: number
    command?: string
  }>
  error?: string
}

export interface DevToolsTaskKillRequest {
  pid: number
  force?: boolean
}

export interface DevToolsTaskKillResponse {
  success: boolean
  error?: string
}

// ============================================================================
// Running Tasks Global View Request/Response Types
// ============================================================================

export interface RunningTaskInfo {
  taskId: string
  projectPath: string
  projectName: string
  description: string
  status: import('./ai-types').TaskStatus
  startedAt: Date
  isAutoMode: boolean
}

export interface RunningTasksGetAllRequest {}

export interface RunningTasksGetAllResponse {
  tasks: RunningTaskInfo[]
}

export interface RunningTasksStopRequest {
  taskId: string
}

export interface RunningTasksStopResponse {
  success: boolean
}

export interface RunningTasksUpdatedData {
  tasks: RunningTaskInfo[]
}

// ============================================================================
// Planning Mode Request/Response Types
// ============================================================================

export interface TaskApprovePlanRequest {
  taskId: string
}

export interface TaskApprovePlanResponse {
  task: import('./ai-types').AgentTask
}

export interface TaskRejectPlanRequest {
  taskId: string
  feedback: string
}

export interface TaskRejectPlanResponse {
  task: import('./ai-types').AgentTask
}

export interface TaskPlanGeneratedData {
  taskId: string
  plan: import('./ai-types').PlanSpec
}

// ============================================================================
// Worktree Request/Response Types
// ============================================================================

export interface WorktreeInfo {
  path: string
  projectPath: string
  branch: string
  taskId: string | null
  createdAt: Date
}

export interface WorktreeCreateRequest {
  projectPath: string
  branchName: string
  taskId?: string
}

export interface WorktreeCreateResponse {
  worktree: WorktreeInfo
}

export interface WorktreeDeleteRequest {
  worktreePath: string
}

export interface WorktreeDeleteResponse {
  success: boolean
}

export interface WorktreeListRequest {
  projectPath: string
}

export interface WorktreeListResponse {
  worktrees: WorktreeInfo[]
}

export interface WorktreeGetForTaskRequest {
  taskId: string
}

export interface WorktreeGetForTaskResponse {
  worktree: WorktreeInfo | null
}

// ============================================================================
// Task Dependency Request/Response Types
// ============================================================================

export interface TaskSetDependenciesRequest {
  taskId: string
  dependsOn: string[]
}

export interface TaskSetDependenciesResponse {
  success: boolean
}

export interface TaskGetDependenciesRequest {
  taskId: string
}

export interface TaskGetDependenciesResponse {
  dependencies: string[]
}

export interface TaskGetBlockingStatusRequest {
  taskId: string
}

export interface TaskGetBlockingStatusResponse {
  status: {
    taskId: string
    isBlocked: boolean
    blockingTasks: string[]
    failedDependencies: string[]
  }
}

// ============================================================================
// Agent Session Persistence Request/Response Types
// ============================================================================

export interface AgentSessionInfo {
  id: string
  projectPath: string
  name: string
  modelId: string
  createdAt: Date
  updatedAt: Date
  isArchived: boolean
  messageCount: number
}

export interface AgentSessionMessageInfo {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface AgentSessionCreateRequest {
  projectPath: string
  name: string
  modelId: string
}

export interface AgentSessionCreateResponse {
  session: AgentSessionInfo
}

export interface AgentSessionGetRequest {
  sessionId: string
}

export interface AgentSessionGetResponse {
  session: AgentSessionInfo | null
}

export interface AgentSessionListRequest {
  projectPath: string
  includeArchived?: boolean
}

export interface AgentSessionListResponse {
  sessions: AgentSessionInfo[]
}

export interface AgentSessionUpdateRequest {
  sessionId: string
  updates: {
    name?: string
    modelId?: string
  }
}

export interface AgentSessionUpdateResponse {
  session: AgentSessionInfo
}

export interface AgentSessionArchiveRequest {
  sessionId: string
}

export interface AgentSessionArchiveResponse {
  success: boolean
}

export interface AgentSessionDeleteRequest {
  sessionId: string
}

export interface AgentSessionDeleteResponse {
  success: boolean
}

export interface AgentSessionAddMessageRequest {
  sessionId: string
  role: 'user' | 'assistant'
  content: string
}

export interface AgentSessionAddMessageResponse {
  message: AgentSessionMessageInfo
}

export interface AgentSessionGetMessagesRequest {
  sessionId: string
}

export interface AgentSessionGetMessagesResponse {
  messages: AgentSessionMessageInfo[]
}

export interface AgentSessionGetLastRequest {
  projectPath: string
}

export interface AgentSessionGetLastResponse {
  sessionId: string | null
}

export interface AgentSessionSetLastRequest {
  projectPath: string
  sessionId: string
}

export interface AgentSessionSetLastResponse {
  success: boolean
}

// ============================================================================
// Agent Service V2 Request/Response Types (Claude SDK Integration)
// ============================================================================

export interface AgentV2SessionCreateRequest {
  name: string
  projectPath?: string
  workingDirectory: string
  model?: string
  tags?: string[]
}

export interface AgentV2SessionCreateResponse {
  session: {
    id: string
    name: string
    projectPath?: string
    workingDirectory: string
    createdAt: string
    updatedAt: string
    archived?: boolean
    tags?: string[]
    model?: string
    sdkSessionId?: string
  }
}

export interface AgentV2SessionGetRequest {
  sessionId: string
}

export interface AgentV2SessionGetResponse {
  session: {
    metadata: {
      id: string
      name: string
      projectPath?: string
      workingDirectory: string
      createdAt: string
      updatedAt: string
      archived?: boolean
      tags?: string[]
      model?: string
      sdkSessionId?: string
    }
    messages: AgentV2Message[]
  } | null
}

export interface AgentV2SessionListRequest {
  projectPath?: string
  includeArchived?: boolean
}

export interface AgentV2SessionListResponse {
  sessions: Array<{
    id: string
    name: string
    projectPath?: string
    workingDirectory: string
    createdAt: string
    updatedAt: string
    archived?: boolean
    tags?: string[]
    model?: string
    sdkSessionId?: string
  }>
}

export interface AgentV2SessionUpdateRequest {
  sessionId: string
  updates: {
    name?: string
    tags?: string[]
    model?: string
  }
}

export interface AgentV2SessionUpdateResponse {
  session: {
    id: string
    name: string
    projectPath?: string
    workingDirectory: string
    createdAt: string
    updatedAt: string
    archived?: boolean
    tags?: string[]
    model?: string
    sdkSessionId?: string
  } | null
}

export interface AgentV2SessionArchiveRequest {
  sessionId: string
}

export interface AgentV2SessionArchiveResponse {
  success: boolean
}

export interface AgentV2SessionDeleteRequest {
  sessionId: string
}

export interface AgentV2SessionDeleteResponse {
  success: boolean
}

export interface AgentV2SessionClearRequest {
  sessionId: string
}

export interface AgentV2SessionClearResponse {
  success: boolean
}

export interface AgentV2Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: Array<{
    data: string
    mimeType: string
    filename: string
  }>
  timestamp: string
  isError?: boolean
  toolUses?: Array<{
    name: string
    input: unknown
    id: string
  }>
}

export interface AgentV2SendMessageRequest {
  sessionId: string
  message: string
  imagePaths?: string[]
  model?: string
  systemPrompt?: string
  allowedTools?: string[]
}

export interface AgentV2SendMessageResponse {
  message: AgentV2Message
}

export interface AgentV2GetMessagesRequest {
  sessionId: string
}

export interface AgentV2GetMessagesResponse {
  messages: AgentV2Message[]
}

export interface AgentV2StopExecutionRequest {
  sessionId: string
}

export interface AgentV2StopExecutionResponse {
  success: boolean
}

export interface AgentV2IsExecutingRequest {
  sessionId: string
}

export interface AgentV2IsExecutingResponse {
  isExecuting: boolean
}

export interface AgentV2TextDeltaData {
  sessionId: string
  text: string
}

export interface AgentV2MessageData {
  sessionId: string
  message: AgentV2Message
}

export interface AgentV2ToolUseData {
  sessionId: string
  toolName: string
  input: unknown
}

export interface AgentV2ErrorData {
  sessionId: string
  error: {
    type: 'abort' | 'rate_limit' | 'network' | 'auth' | 'unknown'
    message: string
    isAbort: boolean
    retryable: boolean
    resetTime?: string
  }
}

export interface AgentV2CompleteData {
  sessionId: string
  result: string
}

// ============================================================================
// Auto Mode Service V2 Request/Response Types (Claude SDK Integration)
// ============================================================================

export interface AutoModeV2StartRequest {
  projectPath: string
  config?: {
    maxConcurrency?: number
    defaultPlanningMode?: 'skip' | 'lite' | 'spec' | 'full'
    defaultRequirePlanApproval?: boolean
    useWorktrees?: boolean
    rateLimitBufferSeconds?: number
  }
}

export interface AutoModeV2StartResponse {
  success: boolean
}

export interface AutoModeV2StopRequest {
  projectPath: string
}

export interface AutoModeV2StopResponse {
  success: boolean
}

export interface AutoModeV2GetStateRequest {
  projectPath: string
}

export interface AutoModeV2GetStateResponse {
  state: {
    isRunning: boolean
    runningCount: number
    maxConcurrency: number
    runningFeatureIds: string[]
    lastStartedFeatureId: string | null
    isWaitingForRateLimit: boolean
    rateLimitResetTime?: string
  } | null
}

export interface AutoModeV2UpdateConfigRequest {
  projectPath: string
  config: {
    maxConcurrency?: number
    defaultPlanningMode?: 'skip' | 'lite' | 'spec' | 'full'
    defaultRequirePlanApproval?: boolean
    useWorktrees?: boolean
    rateLimitBufferSeconds?: number
  }
}

export interface AutoModeV2UpdateConfigResponse {
  success: boolean
}

export interface AutoModeV2GetQueueRequest {
  projectPath: string
}

export interface AutoModeV2Feature {
  id: string
  title: string
  description: string
  status:
    | 'backlog'
    | 'pending'
    | 'in_progress'
    | 'waiting_approval'
    | 'completed'
    | 'failed'
  branchName?: string
  model?: string
  imagePaths?: string[]
  planningMode?: 'skip' | 'lite' | 'spec' | 'full'
  requirePlanApproval?: boolean
  planSpec?: {
    status: 'pending' | 'generating' | 'generated' | 'approved' | 'rejected'
    content?: string
    version: number
    generatedAt?: string
    approvedAt?: string
  }
  createdAt: string
  updatedAt: string
}

export interface AutoModeV2GetQueueResponse {
  features: AutoModeV2Feature[]
}

export interface AutoModeV2EnqueueFeatureRequest {
  projectPath: string
  featureId: string
}

export interface AutoModeV2EnqueueFeatureResponse {
  feature: AutoModeV2Feature | null
}

export interface AutoModeV2DequeueFeatureRequest {
  projectPath: string
  featureId: string
}

export interface AutoModeV2DequeueFeatureResponse {
  feature: AutoModeV2Feature | null
}

export interface AutoModeV2ExecuteFeatureRequest {
  projectPath: string
  featureId: string
  useWorktrees?: boolean
}

export interface AutoModeV2ExecuteFeatureResponse {
  feature: AutoModeV2Feature | null
}

export interface AutoModeV2StopFeatureRequest {
  projectPath: string
  featureId: string
}

export interface AutoModeV2StopFeatureResponse {
  success: boolean
}

export interface AutoModeV2ApprovePlanRequest {
  projectPath: string
  featureId: string
}

export interface AutoModeV2ApprovePlanResponse {
  feature: AutoModeV2Feature | null
}

export interface AutoModeV2RejectPlanRequest {
  projectPath: string
  featureId: string
  feedback: string
}

export interface AutoModeV2RejectPlanResponse {
  feature: AutoModeV2Feature | null
}

export interface AutoModeV2StateChangedData {
  projectPath: string
  state: {
    isRunning: boolean
    runningCount: number
    maxConcurrency: number
    runningFeatureIds: string[]
    lastStartedFeatureId: string | null
    isWaitingForRateLimit: boolean
    rateLimitResetTime?: string
  }
}

export interface AutoModeV2FeatureStartedData {
  projectPath: string
  featureId: string
}

export interface AutoModeV2FeatureCompletedData {
  projectPath: string
  featureId: string
}

export interface AutoModeV2FeatureFailedData {
  projectPath: string
  featureId: string
  error: string
}

export interface AutoModeV2FeatureProgressData {
  projectPath: string
  featureId: string
  status:
    | 'backlog'
    | 'pending'
    | 'in_progress'
    | 'waiting_approval'
    | 'completed'
    | 'failed'
  message: string
  textDelta?: string
  toolUse?: {
    name: string
    input: unknown
  }
}

export interface AutoModeV2PlanGeneratedData {
  projectPath: string
  featureId: string
  plan: {
    status: 'pending' | 'generating' | 'generated' | 'approved' | 'rejected'
    content?: string
    version: number
    generatedAt?: string
    approvedAt?: string
  }
}

export interface AutoModeV2RateLimitWaitData {
  projectPath: string
  resetTime: string
  waitSeconds: number
}
