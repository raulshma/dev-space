/**
 * Claude Provider
 *
 * Implements the BaseProvider interface using the @anthropic-ai/claude-agent-sdk.
 * Provides native TypeScript integration with Claude for AI-powered coding assistance.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import {
  query,
  type Options,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources'
import { BaseProvider, type ProviderFeature } from './base-provider'
import type {
  ExecuteOptions,
  ProviderMessage,
  InstallationStatus,
  ModelDefinition,
  ContentBlock,
} from './types'

/**
 * Default tools available for Claude to use
 */
const DEFAULT_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Bash',
  'WebSearch',
  'WebFetch',
] as const

/**
 * Claude Provider implementation
 *
 * Wraps the @anthropic-ai/claude-agent-sdk for seamless integration
 * with the provider architecture. Supports streaming responses,
 * tool use, and session resumption.
 */
export class ClaudeProvider extends BaseProvider {
  /**
   * Get the provider's unique name identifier
   */
  getName(): string {
    return 'claude'
  }

  /**
   * Execute a query using Claude Agent SDK
   *
   * Streams responses as they are received from the SDK.
   * Supports text prompts, multi-part prompts with images,
   * and session resumption for conversation continuity.
   *
   * @param options - Execution options
   * @yields ProviderMessage objects as responses are received
   */
  async *executeQuery(
    options: ExecuteOptions
  ): AsyncGenerator<ProviderMessage> {
    const {
      prompt,
      model,
      cwd,
      systemPrompt,
      maxTurns = 20,
      allowedTools,
      abortController,
      conversationHistory,
      sdkSessionId,
    } = options

    // Build Claude SDK options
    const toolsToUse = allowedTools || [...DEFAULT_TOOLS]

    const sdkOptions: Options = {
      model,
      systemPrompt,
      maxTurns,
      cwd,
      allowedTools: toolsToUse,
      permissionMode: 'acceptEdits',
      sandbox: {
        enabled: true,
        autoAllowBashIfSandboxed: true,
      },
      abortController,
      // Resume existing SDK session if we have a session ID and conversation history
      ...(sdkSessionId && conversationHistory && conversationHistory.length > 0
        ? { resume: sdkSessionId }
        : {}),
    }

    // Build prompt payload
    let promptPayload: string | AsyncIterable<SDKUserMessage>

    if (Array.isArray(prompt)) {
      // Multi-part prompt (with images) - convert our ContentBlock to SDK's format
      const sdkContent = this.convertToSDKContentBlocks(prompt)
      promptPayload = (async function* (): AsyncGenerator<SDKUserMessage> {
        const multiPartPrompt: SDKUserMessage = {
          type: 'user' as const,
          session_id: '',
          message: {
            role: 'user' as const,
            content: sdkContent,
          },
          parent_tool_use_id: null,
        }
        yield multiPartPrompt
      })()
    } else {
      // Simple text prompt
      promptPayload = prompt
    }

    // Execute via Claude Agent SDK
    try {
      const stream = query({ prompt: promptPayload, options: sdkOptions })

      // Stream messages directly - they're already in the correct format
      for await (const msg of stream) {
        yield msg as ProviderMessage
      }
    } catch (error) {
      // Check if this is an abort error
      if (this.isAbortError(error)) {
        // Yield an error message for abort
        yield {
          type: 'error',
          error: 'Query aborted by user',
        }
        return
      }

      console.error(
        '[ClaudeProvider] executeQuery() error during execution:',
        error
      )
      throw error
    }
  }

  /**
   * Detect Claude SDK installation status
   *
   * The SDK is always available since it's a dependency.
   * Checks for API key configuration.
   */
  async detectInstallation(): Promise<InstallationStatus> {
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY || !!this.config.apiKey

    return {
      installed: true,
      method: 'sdk',
      hasApiKey,
      authenticated: hasApiKey,
    }
  }

  /**
   * Get available Claude models
   *
   * Returns the list of Claude models supported by the SDK.
   */
  getAvailableModels(): ModelDefinition[] {
    return [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        modelString: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        description: 'Balanced performance and cost',
        contextWindow: 200000,
        maxOutputTokens: 16000,
        supportsVision: true,
        supportsTools: true,
        tier: 'standard',
        default: true,
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        modelString: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        description: 'Fast and capable',
        contextWindow: 200000,
        maxOutputTokens: 8000,
        supportsVision: true,
        supportsTools: true,
        tier: 'standard',
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        modelString: 'claude-3-5-haiku-20241022',
        provider: 'anthropic',
        description: 'Fastest Claude model',
        contextWindow: 200000,
        maxOutputTokens: 8000,
        supportsVision: true,
        supportsTools: true,
        tier: 'basic',
      },
    ]
  }

  /**
   * Check if the provider supports a specific feature
   *
   * Claude supports tools, text, vision, and streaming.
   */
  supportsFeature(feature: ProviderFeature): boolean {
    const supportedFeatures: ProviderFeature[] = [
      'tools',
      'text',
      'vision',
      'streaming',
      'code',
    ]
    return supportedFeatures.includes(feature)
  }

  /**
   * Check if an error is an abort error
   *
   * @param error - The error to check
   * @returns true if the error is an abort error
   */
  private isAbortError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.name === 'AbortError' ||
        error.message.includes('aborted') ||
        error.message.includes('abort')
      )
    }
    return false
  }

  /**
   * Convert our ContentBlock array to SDK's content format
   *
   * @param blocks - Our content blocks
   * @returns SDK-compatible content blocks
   */
  private convertToSDKContentBlocks(
    blocks: ContentBlock[]
  ): MessageParam['content'] {
    return blocks.map(block => {
      switch (block.type) {
        case 'text':
          return {
            type: 'text' as const,
            text: block.text || '',
          }
        case 'image':
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: (block.source?.media_type || 'image/png') as
                | 'image/jpeg'
                | 'image/png'
                | 'image/gif'
                | 'image/webp',
              data: block.source?.data || '',
            },
          }
        case 'tool_use':
          return {
            type: 'tool_use' as const,
            id: block.tool_use_id || '',
            name: block.name || '',
            input: block.input || {},
          }
        case 'tool_result':
          return {
            type: 'tool_result' as const,
            tool_use_id: block.tool_use_id || '',
            content: block.content || '',
          }
        default:
          // Default to text block for unknown types
          return {
            type: 'text' as const,
            text: block.text || '',
          }
      }
    })
  }
}
