import { useState, useEffect, useRef, useCallback } from 'react'
import { IconMessage, IconSend, IconPlus } from '@tabler/icons-react'
import { Button } from 'renderer/components/ui/button'
import { Textarea } from 'renderer/components/ui/textarea'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import { Spinner } from 'renderer/components/ui/spinner'
import { Separator } from 'renderer/components/ui/separator'
import { SessionSelector } from './SessionSelector'
import { ModelBadge } from './SessionModelSelector'
import {
  useAgentSessions,
  useCurrentSessionMessages,
} from 'renderer/hooks/use-agent-sessions'
import type { ConversationMessage, ErrorContext } from 'shared/models'

/**
 * ConversationView Component
 *
 * Displays AI agent conversation history with role indicators.
 * Handles message input and integrates with Fix button context submission.
 * Now supports session persistence with session selection.
 *
 * Requirements: 6.3, 6.7, 7.2, 7.3
 */

interface ConversationViewProps {
  projectId: string
  /** Project path for session management */
  projectPath?: string
  errorContext?: ErrorContext | null
  onErrorContextUsed?: () => void
  /** Enable session management features */
  enableSessions?: boolean
}

export function ConversationView({
  projectId,
  projectPath,
  errorContext,
  onErrorContextUsed,
  enableSessions = false,
}: ConversationViewProps) {
  // Legacy state for non-session mode
  const [legacyMessages, setLegacyMessages] = useState<ConversationMessage[]>(
    []
  )
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Session management hooks (only used when enableSessions is true)
  const {
    sessions,
    currentSession,
    currentSessionId,
    isLoading: isLoadingSessions,
    isLoadingMessages,
    isSaving,
    createSession,
    archiveSession,
    deleteSession,
    selectSession,
    addMessage,
  } = useAgentSessions(projectPath || projectId)

  // Get messages for current session
  const sessionMessages = useCurrentSessionMessages()

  // Determine which messages to display
  const messages = enableSessions ? sessionMessages : legacyMessages

  // Load legacy conversation on mount and when projectId changes (non-session mode)
  useEffect(() => {
    if (!enableSessions) {
      loadLegacyConversation()
    }
  }, [projectId, enableSessions])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Handle error context from Fix button
  useEffect(() => {
    if (errorContext) {
      const errorMessage = `I encountered an error:\n\nCommand: ${errorContext.command}\nExit Code: ${errorContext.exitCode}\n\nError Output:\n${errorContext.errorOutput}\n\nCan you help me fix this?`
      setInputValue(errorMessage)
      if (onErrorContextUsed) {
        onErrorContextUsed()
      }
    }
  }, [errorContext, onErrorContextUsed])

  const loadLegacyConversation = async () => {
    try {
      const response = await window.api.agent.getConversation({ projectId })
      setLegacyMessages(response.messages)
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) {
      return
    }

    const content = inputValue.trim()
    setInputValue('')
    setIsSending(true)

    try {
      if (enableSessions && currentSessionId) {
        // Session mode: persist message to session
        await addMessage('user', content)
        // TODO: Integrate with AI service to get response and add assistant message
      } else {
        // Legacy mode: use existing agent API
        await window.api.agent.sendMessage({ projectId, content })
        await loadLegacyConversation()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message. Please check your API key configuration.')
      setInputValue(content)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClearConversation = async () => {
    if (!confirm('Are you sure you want to clear the conversation?')) {
      return
    }

    try {
      if (enableSessions && currentSessionId) {
        // In session mode, archive the current session instead of clearing
        await archiveSession(currentSessionId)
      } else {
        await window.api.agent.clearConversation({ projectId })
        setLegacyMessages([])
      }
    } catch (error) {
      console.error('Failed to clear conversation:', error)
      alert('Failed to clear conversation. Please try again.')
    }
  }

  const handleCreateSession = useCallback(
    async (name: string, modelId: string) => {
      await createSession(name, modelId)
    },
    [createSession]
  )

  const handleSelectSession = useCallback(
    async (sessionId: string | null) => {
      await selectSession(sessionId)
    },
    [selectSession]
  )

  const handleArchiveSession = useCallback(
    async (sessionId: string) => {
      await archiveSession(sessionId)
    },
    [archiveSession]
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId)
    },
    [deleteSession]
  )

  const formatTimestamp = (date: Date): string => {
    const d = new Date(date)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Convert session messages to display format
  const displayMessages = enableSessions
    ? sessionMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        model: currentSession?.modelId,
      }))
    : legacyMessages

  const isLoading = enableSessions
    ? isLoadingSessions || isLoadingMessages
    : false

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        {enableSessions ? (
          <>
            <SessionSelector
              compact
              currentSession={currentSession || null}
              isLoading={isLoadingSessions}
              isSaving={isSaving}
              onArchiveSession={handleArchiveSession}
              onCreateSession={handleCreateSession}
              onDeleteSession={handleDeleteSession}
              onSelectSession={handleSelectSession}
              sessions={sessions}
            />
            {currentSession && <ModelBadge modelId={currentSession.modelId} />}
          </>
        ) : (
          <h3 className="text-sm font-semibold">Conversation</h3>
        )}
        {displayMessages.length > 0 && (
          <Button
            className="text-muted-foreground hover:text-destructive"
            onClick={handleClearConversation}
            size="xs"
            variant="ghost"
          >
            {enableSessions ? 'Archive' : 'Clear'}
          </Button>
        )}
      </div>
      <Separator />

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="h-8 w-8" />
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <IconMessage className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                {enableSessions && !currentSession
                  ? 'Select or create a session to start'
                  : 'No messages yet'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {enableSessions && !currentSession
                  ? 'Click the session selector above'
                  : 'Start a conversation with the AI agent'}
              </p>
              {enableSessions && !currentSession && (
                <Button
                  className="mt-4"
                  onClick={() =>
                    handleCreateSession(
                      'New Session',
                      'anthropic/claude-sonnet-4-20250514'
                    )
                  }
                  size="sm"
                  variant="outline"
                >
                  <IconPlus className="mr-2 h-4 w-4" />
                  New Session
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {displayMessages.map(message => (
              <div
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                key={message.id}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary/10 text-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(message.timestamp)}
                    </span>
                    {message.model && (
                      <span className="text-xs text-muted-foreground/70">
                        • {message.model.split('/').pop()}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <Separator />
      <div className="p-4">
        <div className="flex gap-2">
          <Textarea
            className="flex-1 min-h-[80px]"
            disabled={isSending || (enableSessions && !currentSession)}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              enableSessions && !currentSession
                ? 'Select or create a session first...'
                : 'Type a message... (Shift+Enter for new line)'
            }
            value={inputValue}
          />
          <Button
            className="self-end"
            disabled={
              !inputValue.trim() ||
              isSending ||
              (enableSessions && !currentSession)
            }
            onClick={handleSendMessage}
          >
            {isSending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <IconSend className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
