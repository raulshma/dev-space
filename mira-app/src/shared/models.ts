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
   * PanelGroup layout percentages in order: [left, center, right].
   * Should sum to 100.
   */
  panelLayout?: number[]

  /** UI state for restoring the workspace experience */
  sidebarCollapsed?: boolean
  agentPanelCollapsed?: boolean
  zenMode?: boolean
  previousSidebarState?: boolean
  previousAgentPanelState?: boolean
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

export interface GitTelemetry {
  isGitRepo: boolean
  branch: string
  ahead: number
  behind: number
  modified: number
  staged: number
  untracked: number
}

export type AIProvider = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'local'

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
