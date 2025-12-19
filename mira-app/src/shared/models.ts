// Core data models for Mira Developer Hub

export interface Project {
  id: string
  name: string
  path: string
  createdAt: Date
  updatedAt: Date
  lastOpenedAt: Date | null
  isMissing: boolean
  tags: Tag[]
}

export interface Tag {
  id: string
  name: string
  category: 'tech_stack' | 'status'
  color?: string
}

export interface SessionState {
  terminals: TerminalSessionData[]
  agentConversation: ConversationMessage[]
  contextFiles: string[]
  activeTerminalId: string | null
  workspace?: WorkspaceSessionState
}

export interface WorkspaceSessionState {
  /**
   * PanelGroup layout as a map of panel id to percentage (0..100).
   */
  panelLayout?: { [panelId: string]: number }

  /**
   * Center panel layout (editor/terminal split) as a map of panel id to percentage.
   */
  centerPanelLayout?: { [panelId: string]: number }

  /** Expanded sizes for collapsed panels (to restore when uncollapsed) */
  expandedPanelSizes?: { left: number; right: number }

  /** UI state for restoring the workspace experience */
  sidebarCollapsed?: boolean
  agentPanelCollapsed?: boolean
  zenMode?: boolean
  previousSidebarState?: boolean
  previousAgentPanelState?: boolean

  /** Active sidebar tab (files, git, scripts, commands) */
  activeSidebarTab?: string

  /** Open editor files - paths only for restoration */
  openFilePaths?: string[]
  /** Currently active file path */
  activeFilePath?: string | null

  /** Expanded folder paths in the file tree */
  expandedFolderPaths?: string[]

  /** Open git diff files for restoration */
  openDiffFiles?: Array<{
    filePath: string
    staged: boolean
  }>
}

/** Window state for persistence across app restarts */
export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

export interface TerminalSessionData {
  id: string
  cwd: string
  isPinned: boolean
  layout: TerminalLayout
}

export interface TerminalLayout {
  projectId: string
  panes: TerminalPane[]
}

export interface TerminalPane {
  terminalId: string
  direction: 'horizontal' | 'vertical' | null
  children?: TerminalPane[]
  size: number
}

export interface Command {
  id: string
  name: string
  command: string
  category: string | null
  isCustom: boolean
}

export interface Blueprint {
  id: string
  name: string
  description: string | null
  structure: BlueprintStructure
  createdAt: Date
}

export interface BlueprintStructure {
  files: BlueprintFile[]
  excludePatterns: string[]
}

export interface BlueprintFile {
  relativePath: string
  isDirectory: boolean
  content?: string
}

export interface Shortcut {
  action: string
  binding: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  model?: string
}

export interface ErrorContext {
  terminalId: string
  errorOutput: string
  command: string
  exitCode: number
  relevantFiles: string[]
}

export interface FixSuggestion {
  explanation: string
  suggestedFix: string
  confidence: number
}

export interface GitFileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'staged'
  staged: boolean
}

export interface GitTelemetry {
  isGitRepo: boolean
  branch: string
  ahead: number
  behind: number
  modified: number
  staged: number
  untracked: number
  files: GitFileStatus[]
}

export type AIProvider =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'local'

export interface AIModel {
  id: string
  provider: AIProvider
  name: string
  maxTokens: number
  isConfigured: boolean
}

export interface ContextFile {
  path: string
  tokenCount: number
  content: string
}

export interface TokenUsage {
  used: number
  limit: number
  percentage: number
}

export interface PinnedProcess {
  ptyId: string
  projectId: string
  command: string
  startTime: Date
}

// Input types for creating/updating entities
export interface CreateProjectInput {
  name: string
  path: string
}

export interface UpdateProjectInput {
  name?: string
  path?: string
  lastOpenedAt?: Date
}

export interface CreateTagInput {
  name: string
  category: 'tech_stack' | 'status'
  color?: string
}

export interface CreateCommandInput {
  name: string
  command: string
  category?: string
}

export interface CreateBlueprintInput {
  name: string
  description?: string
  structure: BlueprintStructure
}

export interface ProjectFilter {
  tagFilter?: string[]
  searchQuery?: string
}
