/**
 * IPC Client for Renderer Process
 *
 * Provides typed wrapper functions for all IPC calls with error handling.
 * Requirements: 18.3, 18.4
 */

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
  IPCErrorResponse,
} from 'shared/ipc-types'

/**
 * Custom error class for IPC errors
 */
export class IPCError extends Error {
  code?: string
  details?: unknown

  constructor(message: string, code?: string, details?: unknown) {
    super(message)
    this.name = 'IPCError'
    this.code = code
    this.details = details
  }
}

// Export for use in error handler
export { IPCError as IPCErrorClass }

/**
 * Check if a response is an error response
 */
function isErrorResponse(response: unknown): response is IPCErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as IPCErrorResponse).error === 'string'
  )
}

/**
 * Handle IPC response and throw error if needed
 */
function handleResponse<T>(response: T | IPCErrorResponse): T {
  if (isErrorResponse(response)) {
    throw new IPCError(response.error, response.code, response.details)
  }
  return response as T
}

/**
 * IPC Client class providing all IPC operations
 */
export class IPCClient {
  private get api(): typeof window.api {
    return window.api
  }

  // ============================================================================
  // PROJECT OPERATIONS
  // ============================================================================

  async listProjects(
    request: ProjectListRequest
  ): Promise<ProjectListResponse> {
    const response = await this.api.projects.list(request)
    return handleResponse(response)
  }

  async getProject(request: ProjectGetRequest): Promise<ProjectGetResponse> {
    const response = await this.api.projects.get(request)
    return handleResponse(response)
  }

  async createProject(
    request: ProjectCreateRequest
  ): Promise<ProjectCreateResponse> {
    const response = await this.api.projects.create(request)
    return handleResponse(response)
  }

  async updateProject(
    request: ProjectUpdateRequest
  ): Promise<ProjectUpdateResponse> {
    const response = await this.api.projects.update(request)
    return handleResponse(response)
  }

  async deleteProject(
    request: ProjectDeleteRequest
  ): Promise<ProjectDeleteResponse> {
    const response = await this.api.projects.delete(request)
    return handleResponse(response)
  }

  // ============================================================================
  // TAG OPERATIONS
  // ============================================================================

  async listTags(request: TagListRequest): Promise<TagListResponse> {
    const response = await this.api.tags.list(request)
    return handleResponse(response)
  }

  async createTag(request: TagCreateRequest): Promise<TagCreateResponse> {
    const response = await this.api.tags.create(request)
    return handleResponse(response)
  }

  async addTagToProject(
    request: TagAddToProjectRequest
  ): Promise<TagAddToProjectResponse> {
    const response = await this.api.tags.addToProject(request)
    return handleResponse(response)
  }

  async removeTagFromProject(
    request: TagRemoveFromProjectRequest
  ): Promise<TagRemoveFromProjectResponse> {
    const response = await this.api.tags.removeFromProject(request)
    return handleResponse(response)
  }

  // ============================================================================
  // GIT OPERATIONS
  // ============================================================================

  async getGitTelemetry(
    request: GitTelemetryRequest
  ): Promise<GitTelemetryResponse> {
    const response = await this.api.git.getTelemetry(request)
    return handleResponse(response)
  }

  async startGitRefresh(
    request: GitStartRefreshRequest
  ): Promise<GitStartRefreshResponse> {
    const response = await this.api.git.startRefresh(request)
    return handleResponse(response)
  }

  async stopGitRefresh(
    request: GitStopRefreshRequest
  ): Promise<GitStopRefreshResponse> {
    const response = await this.api.git.stopRefresh(request)
    return handleResponse(response)
  }

  // ============================================================================
  // PTY/TERMINAL OPERATIONS
  // ============================================================================

  async createPTY(request: PTYCreateRequest): Promise<PTYCreateResponse> {
    const response = await this.api.pty.create(request)
    return handleResponse(response)
  }

  async writePTY(request: PTYWriteRequest): Promise<PTYWriteResponse> {
    const response = await this.api.pty.write(request)
    return handleResponse(response)
  }

  async resizePTY(request: PTYResizeRequest): Promise<PTYResizeResponse> {
    const response = await this.api.pty.resize(request)
    return handleResponse(response)
  }

  async killPTY(request: PTYKillRequest): Promise<PTYKillResponse> {
    const response = await this.api.pty.kill(request)
    return handleResponse(response)
  }

  async killAllPTY(request: PTYKillAllRequest): Promise<PTYKillAllResponse> {
    const response = await this.api.pty.killAll(request)
    return handleResponse(response)
  }

  async pinPTY(request: PTYPinRequest): Promise<PTYPinResponse> {
    const response = await this.api.pty.pin(request)
    return handleResponse(response)
  }

  async unpinPTY(request: PTYUnpinRequest): Promise<PTYUnpinResponse> {
    const response = await this.api.pty.unpin(request)
    return handleResponse(response)
  }

  async getPinnedPTY(
    request: PTYGetPinnedRequest
  ): Promise<PTYGetPinnedResponse> {
    const response = await this.api.pty.getPinned(request)
    return handleResponse(response)
  }

  // ============================================================================
  // KEYCHAIN OPERATIONS
  // ============================================================================

  async getApiKey(request: KeychainGetRequest): Promise<KeychainGetResponse> {
    const response = await this.api.keychain.get(request)
    return handleResponse(response)
  }

  async setApiKey(request: KeychainSetRequest): Promise<KeychainSetResponse> {
    const response = await this.api.keychain.set(request)
    return handleResponse(response)
  }

  async deleteApiKey(
    request: KeychainDeleteRequest
  ): Promise<KeychainDeleteResponse> {
    const response = await this.api.keychain.delete(request)
    return handleResponse(response)
  }

  async hasApiKey(request: KeychainHasRequest): Promise<KeychainHasResponse> {
    const response = await this.api.keychain.has(request)
    return handleResponse(response)
  }

  // ============================================================================
  // SESSION OPERATIONS
  // ============================================================================

  async saveSession(request: SessionSaveRequest): Promise<SessionSaveResponse> {
    const response = await this.api.sessions.save(request)
    return handleResponse(response)
  }

  async restoreSession(
    request: SessionRestoreRequest
  ): Promise<SessionRestoreResponse> {
    const response = await this.api.sessions.restore(request)
    return handleResponse(response)
  }

  // ============================================================================
  // COMMAND LIBRARY OPERATIONS
  // ============================================================================

  async listCommands(
    request: CommandListRequest
  ): Promise<CommandListResponse> {
    const response = await this.api.commands.list(request)
    return handleResponse(response)
  }

  async createCommand(
    request: CommandCreateRequest
  ): Promise<CommandCreateResponse> {
    const response = await this.api.commands.create(request)
    return handleResponse(response)
  }

  // ============================================================================
  // BLUEPRINT OPERATIONS
  // ============================================================================

  async listBlueprints(
    request: BlueprintListRequest
  ): Promise<BlueprintListResponse> {
    const response = await this.api.blueprints.list(request)
    return handleResponse(response)
  }

  async createBlueprint(
    request: BlueprintCreateRequest
  ): Promise<BlueprintCreateResponse> {
    const response = await this.api.blueprints.create(request)
    return handleResponse(response)
  }

  async captureBlueprint(
    request: BlueprintCaptureRequest
  ): Promise<BlueprintCaptureResponse> {
    const response = await this.api.blueprints.capture(request)
    return handleResponse(response)
  }

  async applyBlueprint(
    request: BlueprintApplyRequest
  ): Promise<BlueprintApplyResponse> {
    const response = await this.api.blueprints.apply(request)
    return handleResponse(response)
  }

  // ============================================================================
  // SETTINGS OPERATIONS
  // ============================================================================

  async getSetting(request: SettingGetRequest): Promise<SettingGetResponse> {
    const response = await this.api.settings.get(request)
    return handleResponse(response)
  }

  async setSetting(request: SettingSetRequest): Promise<SettingSetResponse> {
    const response = await this.api.settings.set(request)
    return handleResponse(response)
  }

  // ============================================================================
  // SHORTCUT OPERATIONS
  // ============================================================================

  async listShortcuts(
    request: ShortcutListRequest
  ): Promise<ShortcutListResponse> {
    const response = await this.api.shortcuts.list(request)
    return handleResponse(response)
  }

  async setShortcut(request: ShortcutSetRequest): Promise<ShortcutSetResponse> {
    const response = await this.api.shortcuts.set(request)
    return handleResponse(response)
  }

  // ============================================================================
  // SHELL OPERATIONS
  // ============================================================================

  async openExternal(
    request: ShellOpenExternalRequest
  ): Promise<ShellOpenExternalResponse> {
    const response = await this.api.shell.openExternal(request)
    return handleResponse(response)
  }

  async openPath(
    request: ShellOpenPathRequest
  ): Promise<ShellOpenPathResponse> {
    const response = await this.api.shell.openPath(request)
    return handleResponse(response)
  }
}

// Export singleton instance
export const ipcClient = new IPCClient()
