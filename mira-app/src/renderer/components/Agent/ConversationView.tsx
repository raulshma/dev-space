import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { Button } from 'renderer/components/ui/button'
import { Textarea } from 'renderer/components/ui/textarea'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import { Spinner } from 'renderer/components/ui/spinner'
import { Separator } from 'renderer/components/ui/separator'
import type { ConversationMessage, ErrorContext } from 'shared/models'

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
  onErrorContextUsed,
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
      await window.api.agent.sendMessage({ projectId, content })
      await loadConversation()
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
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold">Conversation</h3>
        {messages.length > 0 && (
          <Button
            className="text-muted-foreground hover:text-destructive"
            onClick={handleClearConversation}
            size="xs"
            variant="ghost"
          >
            Clear
          </Button>
        )}
      </div>
      <Separator />

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No messages yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Start a conversation with the AI agent
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(message => (
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
                        • {message.model}
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
            disabled={isSending}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            value={inputValue}
          />
          <Button
            className="self-end"
            disabled={!inputValue.trim() || isSending}
            onClick={handleSendMessage}
          >
            {isSending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
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
