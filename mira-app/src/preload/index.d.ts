import type {
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
} from 'shared/ipc-types'

export interface MiraAPI {
  projects: {
    list: (request: ProjectListRequest) => Promise<ProjectListResponse>
    get: (request: ProjectGetRequest) => Promise<ProjectGetResponse>
    create: (request: ProjectCreateRequest) => Promise<ProjectCreateResponse>
    update: (request: ProjectUpdateRequest) => Promise<ProjectUpdateResponse>
    delete: (request: ProjectDeleteRequest) => Promise<ProjectDeleteResponse>
  }
  tags: {
    list: (request: TagListRequest) => Promise<TagListResponse>
    create: (request: TagCreateRequest) => Promise<TagCreateResponse>
    addToProject: (
      request: TagAddToProjectRequest
    ) => Promise<TagAddToProjectResponse>
    removeFromProject: (
      request: TagRemoveFromProjectRequest
    ) => Promise<TagRemoveFromProjectResponse>
  }
  git: {
    getTelemetry: (
      request: GitTelemetryRequest
    ) => Promise<GitTelemetryResponse>
    startRefresh: (
      request: GitStartRefreshRequest
    ) => Promise<GitStartRefreshResponse>
    stopRefresh: (
      request: GitStopRefreshRequest
    ) => Promise<GitStopRefreshResponse>
  }
  pty: {
    create: (request: PTYCreateRequest) => Promise<PTYCreateResponse>
    write: (request: PTYWriteRequest) => Promise<PTYWriteResponse>
    resize: (request: PTYResizeRequest) => Promise<PTYResizeResponse>
    kill: (request: PTYKillRequest) => Promise<PTYKillResponse>
    killAll: (request: PTYKillAllRequest) => Promise<PTYKillAllResponse>
    pin: (request: PTYPinRequest) => Promise<PTYPinResponse>
    unpin: (request: PTYUnpinRequest) => Promise<PTYUnpinResponse>
    getPinned: (request: PTYGetPinnedRequest) => Promise<PTYGetPinnedResponse>
    onData: (ptyId: string, callback: (data: string) => void) => () => void
    onExit: (ptyId: string, callback: (code: number) => void) => () => void
  }
  keychain: {
    get: (request: KeychainGetRequest) => Promise<KeychainGetResponse>
    set: (request: KeychainSetRequest) => Promise<KeychainSetResponse>
    delete: (request: KeychainDeleteRequest) => Promise<KeychainDeleteResponse>
    has: (request: KeychainHasRequest) => Promise<KeychainHasResponse>
  }
  sessions: {
    save: (request: SessionSaveRequest) => Promise<SessionSaveResponse>
    restore: (request: SessionRestoreRequest) => Promise<SessionRestoreResponse>
    clearAll: () => Promise<SessionClearAllResponse>
  }
  commands: {
    list: (request: CommandListRequest) => Promise<CommandListResponse>
    create: (request: CommandCreateRequest) => Promise<CommandCreateResponse>
  }
  blueprints: {
    list: (request: BlueprintListRequest) => Promise<BlueprintListResponse>
    create: (
      request: BlueprintCreateRequest
    ) => Promise<BlueprintCreateResponse>
    capture: (
      request: BlueprintCaptureRequest
    ) => Promise<BlueprintCaptureResponse>
    apply: (request: BlueprintApplyRequest) => Promise<BlueprintApplyResponse>
  }
  settings: {
    get: (request: SettingGetRequest) => Promise<SettingGetResponse>
    set: (request: SettingSetRequest) => Promise<SettingSetResponse>
  }
  shortcuts: {
    list: (request: ShortcutListRequest) => Promise<ShortcutListResponse>
    set: (request: ShortcutSetRequest) => Promise<ShortcutSetResponse>
  }
  shell: {
    openExternal: (
      request: ShellOpenExternalRequest
    ) => Promise<ShellOpenExternalResponse>
    openPath: (request: ShellOpenPathRequest) => Promise<ShellOpenPathResponse>
  }
  dialog: {
    openDirectory: (
      request: DialogOpenDirectoryRequest
    ) => Promise<DialogOpenDirectoryResponse>
  }
  agent: {
    setModel: (request: AgentSetModelRequest) => Promise<AgentSetModelResponse>
    getModel: (request: AgentGetModelRequest) => Promise<AgentGetModelResponse>
    getModels: (
      request: AgentGetModelsRequest
    ) => Promise<AgentGetModelsResponse>
    sendMessage: (
      request: AgentSendMessageRequest
    ) => Promise<AgentSendMessageResponse>
    getConversation: (
      request: AgentGetConversationRequest
    ) => Promise<AgentGetConversationResponse>
    clearConversation: (
      request: AgentClearConversationRequest
    ) => Promise<AgentClearConversationResponse>
    addContextFile: (
      request: AgentAddContextFileRequest
    ) => Promise<AgentAddContextFileResponse>
    removeContextFile: (
      request: AgentRemoveContextFileRequest
    ) => Promise<AgentRemoveContextFileResponse>
    getContextFiles: (
      request: AgentGetContextFilesRequest
    ) => Promise<AgentGetContextFilesResponse>
    getTokenUsage: (
      request: AgentGetTokenUsageRequest
    ) => Promise<AgentGetTokenUsageResponse>
    generateFix: (
      request: AgentGenerateFixRequest
    ) => Promise<AgentGenerateFixResponse>
  }
}

declare global {
  interface Window {
    api: MiraAPI
  }
}
