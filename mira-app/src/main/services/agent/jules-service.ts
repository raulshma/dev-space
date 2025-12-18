/**
 * Jules Service
 *
 * Provides integration with Google Jules API for cloud-based
 * AI coding assistance with GitHub integration.
 *
 * API Reference: https://developers.google.com/jules/api
 *
 * @module jules-service
 */

import type { AgentConfigService } from './agent-config-service'
import type { OutputLine } from 'shared/ai-types'

const JULES_API_BASE = 'https://jules.googleapis.com/v1alpha'

/**
 * Jules source representation
 */
export interface JulesSource {
  name: string
  id: string
  githubRepo?: {
    owner: string
    repo: string
  }
}

/**
 * Jules session representation
 */
export interface JulesSession {
  name: string
  id: string
  title?: string
  sourceContext?: {
    source: string
    githubRepoContext?: {
      startingBranch: string
    }
  }
  prompt: string
  outputs?: JulesOutput[]
  state?: string
}

/**
 * Jules output (e.g., pull request)
 */
export interface JulesOutput {
  pullRequest?: {
    url: string
    title: string
    description: string
  }
}

/**
 * Jules activity representation
 */
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
      }
    }
    media?: {
      data: string
      mimeType: string
    }
  }>
}

/**
 * Error codes for Jules operations
 */
export enum JulesErrorCode {
  API_KEY_MISSING = 'API_KEY_MISSING',
  API_ERROR = 'API_ERROR',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SOURCE_NOT_FOUND = 'SOURCE_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * Custom error class for Jules operations
 */
export class JulesError extends Error {
  constructor(
    message: string,
    public code: JulesErrorCode,
    public statusCode?: number,
    public cause?: Error
  ) {
    super(message)
    this.name = 'JulesError'
  }
}

/**
 * Interface for the Jules Service
 */
export interface IJulesService {
  listSources(): Promise<JulesSource[]>
  createSession(params: CreateSessionParams): Promise<JulesSession>
  getSession(sessionId: string): Promise<JulesSession>
  listSessions(pageSize?: number): Promise<JulesSession[]>
  approvePlan(sessionId: string): Promise<void>
  sendMessage(sessionId: string, prompt: string): Promise<void>
  listActivities(sessionId: string, pageSize?: number): Promise<JulesActivity[]>
}

/**
 * Parameters for creating a Jules session
 */
export interface CreateSessionParams {
  prompt: string
  source: string
  startingBranch?: string
  automationMode?: 'AUTO_CREATE_PR' | 'MANUAL'
  requirePlanApproval?: boolean
  title?: string
}

/**
 * Jules Service
 *
 * Handles all interactions with the Google Jules API.
 */
export class JulesService implements IJulesService {
  private configService: AgentConfigService

  constructor(configService: AgentConfigService) {
    this.configService = configService
  }

  /**
   * Get the API key from configuration
   */
  private async getApiKey(): Promise<string> {
    const config = await this.configService.getConfig()
    if (!config.googleApiKey) {
      throw new JulesError(
        'Google API key is not configured',
        JulesErrorCode.API_KEY_MISSING
      )
    }
    return config.googleApiKey
  }

  /**
   * Make an authenticated request to the Jules API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const apiKey = await this.getApiKey()

    const url = `${JULES_API_BASE}${endpoint}`
    const headers: Record<string, string> = {
      'X-Goog-Api-Key': apiKey,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new JulesError(
          `Jules API error: ${errorText}`,
          JulesErrorCode.API_ERROR,
          response.status
        )
      }

      // Handle empty responses
      const text = await response.text()
      if (!text) {
        return {} as T
      }

      return JSON.parse(text) as T
    } catch (error) {
      if (error instanceof JulesError) {
        throw error
      }
      throw new JulesError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        JulesErrorCode.NETWORK_ERROR,
        undefined,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * List available sources (GitHub repositories)
   * Fetches all pages of sources using pagination
   */
  async listSources(): Promise<JulesSource[]> {
    const allSources: JulesSource[] = []
    let pageToken: string | undefined

    do {
      const endpoint = pageToken
        ? `/sources?pageToken=${encodeURIComponent(pageToken)}`
        : '/sources'

      const response = await this.request<{
        sources?: JulesSource[]
        nextPageToken?: string
      }>(endpoint)

      if (response.sources) {
        allSources.push(...response.sources)
      }

      pageToken = response.nextPageToken
    } while (pageToken)

    return allSources
  }

  /**
   * Create a new Jules session
   */
  async createSession(params: CreateSessionParams): Promise<JulesSession> {
    const body: Record<string, unknown> = {
      prompt: params.prompt,
      sourceContext: {
        source: params.source,
        githubRepoContext: {
          startingBranch: params.startingBranch || 'main',
        },
      },
    }

    if (params.automationMode) {
      body.automationMode = params.automationMode
    }

    if (params.requirePlanApproval) {
      body.requirePlanApproval = params.requirePlanApproval
    }

    if (params.title) {
      body.title = params.title
    }

    return this.request<JulesSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<JulesSession> {
    return this.request<JulesSession>(`/sessions/${sessionId}`)
  }

  /**
   * List sessions
   */
  async listSessions(pageSize = 10): Promise<JulesSession[]> {
    const response = await this.request<{ sessions: JulesSession[] }>(
      `/sessions?pageSize=${pageSize}`
    )
    return response.sessions || []
  }

  /**
   * Approve the latest plan for a session
   */
  async approvePlan(sessionId: string): Promise<void> {
    await this.request(`/sessions/${sessionId}:approvePlan`, {
      method: 'POST',
    })
  }

  /**
   * Send a message to the agent in a session
   */
  async sendMessage(sessionId: string, prompt: string): Promise<void> {
    await this.request(`/sessions/${sessionId}:sendMessage`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    })
  }

  /**
   * List activities in a session
   */
  async listActivities(
    sessionId: string,
    pageSize = 30
  ): Promise<JulesActivity[]> {
    const response = await this.request<{ activities: JulesActivity[] }>(
      `/sessions/${sessionId}/activities?pageSize=${pageSize}`
    )
    return response.activities || []
  }

  /**
   * Convert Jules activities to OutputLines for display
   */
  activitiesToOutputLines(
    taskId: string,
    activities: JulesActivity[]
  ): OutputLine[] {
    const lines: OutputLine[] = []

    for (const activity of activities) {
      const timestamp = new Date(activity.createTime)
      const prefix = activity.originator === 'agent' ? '[Jules]' : '[User]'

      if (activity.planGenerated) {
        lines.push({
          taskId,
          timestamp,
          content: `${prefix} Plan generated:`,
          stream: 'stdout',
        })
        for (const step of activity.planGenerated.plan.steps) {
          lines.push({
            taskId,
            timestamp,
            content: `  ${(step.index ?? 0) + 1}. ${step.title}`,
            stream: 'stdout',
          })
        }
      }

      if (activity.planApproved) {
        lines.push({
          taskId,
          timestamp,
          content: `${prefix} Plan approved`,
          stream: 'stdout',
        })
      }

      if (activity.progressUpdated) {
        lines.push({
          taskId,
          timestamp,
          content: `${prefix} ${activity.progressUpdated.title}`,
          stream: 'stdout',
        })
        if (activity.progressUpdated.description) {
          lines.push({
            taskId,
            timestamp,
            content: `  ${activity.progressUpdated.description}`,
            stream: 'stdout',
          })
        }
      }

      if (activity.artifacts) {
        for (const artifact of activity.artifacts) {
          if (artifact.bashOutput) {
            if (artifact.bashOutput.command) {
              lines.push({
                taskId,
                timestamp,
                content: `$ ${artifact.bashOutput.command}`,
                stream: 'stdout',
              })
            }
            if (artifact.bashOutput.output) {
              lines.push({
                taskId,
                timestamp,
                content: artifact.bashOutput.output,
                stream:
                  artifact.bashOutput.exitCode === 0 ? 'stdout' : 'stderr',
              })
            }
          }
        }
      }
    }

    return lines
  }
}
