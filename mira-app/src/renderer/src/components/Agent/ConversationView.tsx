import { useState, useEffect, useRef } from 'react'
import type { ConversationMessage, ErrorContext } from '../../../../shared/models'

/**
 * ConversationView Component
 *
 * Displays AI agent conversation history with role indicators.
 * Handles message input and integrates with Fix button context submission.
 *
 * Requirements: 7.2, 7.3
 */

interface ConversationViewProps {
  projectId: string
  errorContext?: ErrorContext | null
  onErrorContextUsed?: () => void
}

export function ConversationView({
  projectId,
  errorContext,
  onErrorContextUsed
}: ConversationViewProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load conversation on mount and when projectId changes
  useEffect(() => {
    loadConversation()
  }, [projectId])

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
  }, [errorContext])

  const loadConversation = async () => {
    try {
      const response = await window.api.agent.getConversation({ projectId })
      setMessages(response.messages)
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
      // Send message and get response
      await window.api.agent.sendMessage({ projectId, content })

      // Reload conversation to get both user and assistant messages
      await loadConversation()
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message. Please check your API key configuration.')
      // Restore input value on error
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
      await window.api.agent.clearConversation({ projectId })
      setMessages([])
    } catch (error) {
      console.error('Failed to clear conversation:', error)
      alert('Failed to clear conversation. Please try again.')
    }
  }

  const formatTimestamp = (date: Date): string => {
    const d = new Date(date)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">Conversation</h3>
        {messages.length > 0 && (
          <button
            onClick={handleClearConversation}
            className="text-xs text-neutral-500 hover:text-red-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <p className="mt-2 text-sm text-neutral-600">No messages yet</p>
              <p className="mt-1 text-xs text-neutral-500">
                Start a conversation with the AI agent
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-neutral-100 text-neutral-900'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {formatTimestamp(message.timestamp)}
                    </span>
                    {message.model && (
                      <span className="text-xs text-neutral-400">• {message.model}</span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-neutral-200 p-4">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            disabled={isSending}
            className="flex-1 resize-none rounded-sm border border-neutral-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-neutral-100"
            rows={3}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isSending}
            className="rounded-sm bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {isSending ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending
              </div>
            ) : (
              'Send'
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
