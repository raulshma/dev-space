/**
 * Session Selector Component
 *
 * Provides UI for managing agent conversation sessions:
 * - Dropdown for session selection
 * - New session button
 * - Archive/delete actions
 *
 * Requirements: 6.7, 6.8, 6.9
 */

import { memo, useState, useCallback } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'renderer/components/ui/dropdown-menu'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { Input } from 'renderer/components/ui/input'
import { Label } from 'renderer/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'renderer/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'renderer/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  IconMessage,
  IconPlus,
  IconChevronDown,
  IconArchive,
  IconTrash,
  IconLoader2,
  IconMessageCircle,
  IconClock,
  IconCheck,
} from '@tabler/icons-react'
import type { AgentSessionInfo } from 'shared/ipc-types'
import { cn } from 'renderer/lib/utils'

interface SessionSelectorProps {
  /** List of available sessions */
  sessions: AgentSessionInfo[]
  /** Currently selected session */
  currentSession: AgentSessionInfo | null
  /** Loading state */
  isLoading?: boolean
  /** Saving state */
  isSaving?: boolean
  /** Callback when session is selected */
  onSelectSession: (sessionId: string | null) => void
  /** Callback when new session is created */
  onCreateSession: (name: string, modelId: string) => Promise<void>
  /** Callback when session is archived */
  onArchiveSession: (sessionId: string) => Promise<void>
  /** Callback when session is deleted */
  onDeleteSession: (sessionId: string) => Promise<void>
  /** Default model ID for new sessions */
  defaultModelId?: string
  /** Optional compact mode */
  compact?: boolean
}

/**
 * Format relative time for session display
 */
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

export const SessionSelector = memo(function SessionSelector({
  sessions,
  currentSession,
  isLoading = false,
  isSaving = false,
  onSelectSession,
  onCreateSession,
  onArchiveSession,
  onDeleteSession,
  defaultModelId = 'anthropic/claude-sonnet-4-20250514',
  compact = false,
}: SessionSelectorProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] =
    useState<AgentSessionInfo | null>(null)
  const [newSessionName, setNewSessionName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Filter active sessions (non-archived)
  const activeSessions = sessions.filter(s => !s.isArchived)
  const archivedSessions = sessions.filter(s => s.isArchived)

  const handleCreateSession = useCallback(async () => {
    if (!newSessionName.trim()) return

    setIsCreating(true)
    try {
      await onCreateSession(newSessionName.trim(), defaultModelId)
      setNewSessionName('')
      setIsNewSessionDialogOpen(false)
    } catch (error) {
      console.error('Failed to create session:', error)
    } finally {
      setIsCreating(false)
    }
  }, [newSessionName, defaultModelId, onCreateSession])

  const handleArchiveSession = useCallback(
    async (session: AgentSessionInfo, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await onArchiveSession(session.id)
      } catch (error) {
        console.error('Failed to archive session:', error)
      }
    },
    [onArchiveSession]
  )

  const handleDeleteClick = useCallback(
    (session: AgentSessionInfo, e: React.MouseEvent) => {
      e.stopPropagation()
      setSessionToDelete(session)
      setIsDeleteDialogOpen(true)
    },
    []
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!sessionToDelete) return

    try {
      await onDeleteSession(sessionToDelete.id)
    } catch (error) {
      console.error('Failed to delete session:', error)
    } finally {
      setSessionToDelete(null)
      setIsDeleteDialogOpen(false)
    }
  }, [sessionToDelete, onDeleteSession])

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      onSelectSession(sessionId)
      setIsOpen(false)
    },
    [onSelectSession]
  )

  // Compact mode renders a simpler trigger
  if (compact) {
    return (
      <>
        <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                className="gap-1.5 h-8"
                disabled={isLoading}
                size="sm"
                variant="outline"
              >
                <IconMessageCircle className="h-4 w-4" />
                {currentSession ? (
                  <span className="max-w-24 truncate text-xs">
                    {currentSession.name}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No session
                  </span>
                )}
                <IconChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            }
          />
          <SessionDropdownContent
            activeSessions={activeSessions}
            archivedSessions={archivedSessions}
            currentSession={currentSession}
            isSaving={isSaving}
            onArchiveSession={handleArchiveSession}
            onDeleteClick={handleDeleteClick}
            onNewSession={() => setIsNewSessionDialogOpen(true)}
            onSelectSession={handleSelectSession}
          />
        </DropdownMenu>

        <NewSessionDialog
          isCreating={isCreating}
          isOpen={isNewSessionDialogOpen}
          newSessionName={newSessionName}
          onClose={() => setIsNewSessionDialogOpen(false)}
          onCreate={handleCreateSession}
          setNewSessionName={setNewSessionName}
        />

        <DeleteSessionDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
          session={sessionToDelete}
        />
      </>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                className="gap-2 min-w-40 justify-between"
                disabled={isLoading}
                variant="outline"
              >
                <div className="flex items-center gap-2">
                  <IconMessage className="h-4 w-4" />
                  {currentSession ? (
                    <span className="max-w-32 truncate">
                      {currentSession.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Select session
                    </span>
                  )}
                </div>
                {isLoading ? (
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <IconChevronDown className="h-4 w-4 opacity-50" />
                )}
              </Button>
            }
          />
          <SessionDropdownContent
            activeSessions={activeSessions}
            archivedSessions={archivedSessions}
            currentSession={currentSession}
            isSaving={isSaving}
            onArchiveSession={handleArchiveSession}
            onDeleteClick={handleDeleteClick}
            onNewSession={() => setIsNewSessionDialogOpen(true)}
            onSelectSession={handleSelectSession}
          />
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                onClick={() => setIsNewSessionDialogOpen(true)}
                size="icon"
                variant="outline"
              >
                <IconPlus className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent>New session</TooltipContent>
        </Tooltip>
      </div>

      <NewSessionDialog
        isCreating={isCreating}
        isOpen={isNewSessionDialogOpen}
        newSessionName={newSessionName}
        onClose={() => setIsNewSessionDialogOpen(false)}
        onCreate={handleCreateSession}
        setNewSessionName={setNewSessionName}
      />

      <DeleteSessionDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        session={sessionToDelete}
      />
    </>
  )
})

/**
 * Session dropdown content component
 */
interface SessionDropdownContentProps {
  activeSessions: AgentSessionInfo[]
  archivedSessions: AgentSessionInfo[]
  currentSession: AgentSessionInfo | null
  isSaving: boolean
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  onArchiveSession: (session: AgentSessionInfo, e: React.MouseEvent) => void
  onDeleteClick: (session: AgentSessionInfo, e: React.MouseEvent) => void
}

function SessionDropdownContent({
  activeSessions,
  archivedSessions,
  currentSession,
  isSaving,
  onSelectSession,
  onNewSession,
  onArchiveSession,
  onDeleteClick,
}: SessionDropdownContentProps) {
  return (
    <DropdownMenuContent align="start" className="w-72">
      <DropdownMenuLabel>Sessions</DropdownMenuLabel>
      <DropdownMenuSeparator />

      {/* New session button */}
      <DropdownMenuItem onClick={onNewSession}>
        <IconPlus className="h-4 w-4" />
        <span>New Session</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      {/* Active sessions */}
      {activeSessions.length === 0 ? (
        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
          No active sessions
        </div>
      ) : (
        <ScrollArea className="max-h-64">
          {activeSessions.map(session => (
            <SessionItem
              isSaving={isSaving}
              isSelected={currentSession?.id === session.id}
              key={session.id}
              onArchive={e => onArchiveSession(session, e)}
              onDelete={e => onDeleteClick(session, e)}
              onSelect={() => onSelectSession(session.id)}
              session={session}
            />
          ))}
        </ScrollArea>
      )}

      {/* Archived sessions */}
      {archivedSessions.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-muted-foreground">
            Archived
          </DropdownMenuLabel>
          <ScrollArea className="max-h-32">
            {archivedSessions.map(session => (
              <SessionItem
                isArchived
                isSaving={isSaving}
                isSelected={currentSession?.id === session.id}
                key={session.id}
                onDelete={e => onDeleteClick(session, e)}
                onSelect={() => onSelectSession(session.id)}
                session={session}
              />
            ))}
          </ScrollArea>
        </>
      )}
    </DropdownMenuContent>
  )
}

/**
 * Individual session item in the dropdown
 */
interface SessionItemProps {
  session: AgentSessionInfo
  isSelected: boolean
  isArchived?: boolean
  isSaving: boolean
  onSelect: () => void
  onArchive?: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}

function SessionItem({
  session,
  isSelected,
  isArchived = false,
  isSaving,
  onSelect,
  onArchive,
  onDelete,
}: SessionItemProps) {
  return (
    <DropdownMenuItem
      className={cn(
        'flex items-center justify-between gap-2 group',
        isSelected && 'bg-accent'
      )}
      onClick={onSelect}
    >
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isSelected && (
            <IconCheck className="h-3 w-3 text-primary shrink-0" />
          )}
          <span className="truncate font-medium text-xs">{session.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <IconClock className="h-3 w-3" />
            {formatRelativeTime(session.updatedAt)}
          </span>
          <Badge className="h-4 px-1 text-[9px]" variant="secondary">
            {session.messageCount} msgs
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isArchived && onArchive && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  className="h-6 w-6"
                  disabled={isSaving}
                  onClick={onArchive}
                  size="icon"
                  variant="ghost"
                >
                  <IconArchive className="h-3 w-3" />
                </Button>
              }
            />
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="h-6 w-6 text-destructive hover:text-destructive"
                disabled={isSaving}
                onClick={onDelete}
                size="icon"
                variant="ghost"
              >
                <IconTrash className="h-3 w-3" />
              </Button>
            }
          />
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </DropdownMenuItem>
  )
}

/**
 * New session dialog
 */
interface NewSessionDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreate: () => void
  newSessionName: string
  setNewSessionName: (name: string) => void
  isCreating: boolean
}

function NewSessionDialog({
  isOpen,
  onClose,
  onCreate,
  newSessionName,
  setNewSessionName,
  isCreating,
}: NewSessionDialogProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newSessionName.trim()) {
      onCreate()
    }
  }

  return (
    <Dialog onOpenChange={open => !open && onClose()} open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
          <DialogDescription>
            Create a new conversation session with the AI agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="session-name">Session Name</Label>
            <Input
              autoFocus
              id="session-name"
              onChange={e => setNewSessionName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Feature Implementation, Bug Fix..."
              value={newSessionName}
            />
          </div>
        </div>

        <DialogFooter>
          <Button disabled={isCreating} onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={!newSessionName.trim() || isCreating}
            onClick={onCreate}
          >
            {isCreating ? (
              <>
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Session'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Delete session confirmation dialog
 */
interface DeleteSessionDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  session: AgentSessionInfo | null
}

function DeleteSessionDialog({
  isOpen,
  onClose,
  onConfirm,
  session,
}: DeleteSessionDialogProps) {
  return (
    <AlertDialog onOpenChange={open => !open && onClose()} open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Session</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{session?.name}"? This will
            permanently remove the session and all its messages. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Compact session selector for use in headers/toolbars
 */
export const CompactSessionSelector = memo(function CompactSessionSelector(
  props: SessionSelectorProps
): React.JSX.Element {
  return <SessionSelector {...props} compact />
})
