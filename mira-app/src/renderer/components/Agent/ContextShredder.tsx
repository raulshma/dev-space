import { useState, useEffect, useCallback } from 'react'
import { Upload, X } from 'lucide-react'
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from 'renderer/components/ui/progress'
import { Button } from 'renderer/components/ui/button'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import { Separator } from 'renderer/components/ui/separator'
import { Spinner } from 'renderer/components/ui/spinner'
import { Alert, AlertDescription } from 'renderer/components/ui/alert'
import type { ContextFile, TokenUsage } from 'shared/models'

/**
 * ContextShredder Component
 *
 * Visual utility for managing AI context files with drag-and-drop support.
 * Displays file list with token counts and total usage percentage bar.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

interface ContextShredderProps {
  projectId: string
}

export function ContextShredder({ projectId }: ContextShredderProps) {
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([])
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    used: 0,
    limit: 128000,
    percentage: 0,
  })
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load context files on mount and when projectId changes
  useEffect(() => {
    loadContextFiles()
  }, [projectId])

  const loadContextFiles = async () => {
    try {
      const [filesResponse, usageResponse] = await Promise.all([
        window.api.agent.getContextFiles({ projectId }),
        window.api.agent.getTokenUsage({ projectId }),
      ])

      setContextFiles(filesResponse.files)
      setTokenUsage(usageResponse.usage)
    } catch (error) {
      console.error('Failed to load context files:', error)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      setLoading(true)

      try {
        for (const file of files) {
          const filePath = (file as { path?: string }).path
          if (filePath) {
            await window.api.agent.addContextFile({ projectId, filePath })
          }
        }
        await loadContextFiles()
      } catch (error) {
        console.error('Failed to add files to context:', error)
        alert('Failed to add some files. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    [projectId]
  )

  const handleRemoveFile = async (filePath: string) => {
    try {
      await window.api.agent.removeContextFile({ projectId, filePath })
      await loadContextFiles()
    } catch (error) {
      console.error('Failed to remove file:', error)
      alert('Failed to remove file. Please try again.')
    }
  }

  const formatTokenCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold">Context Files</h3>
        <p className="text-xs text-muted-foreground">
          Drag and drop files to add them to the AI context
        </p>
      </div>
      <Separator />

      {/* Token usage bar */}
      <div className="px-4 py-3">
        <Progress value={tokenUsage.percentage}>
          <ProgressLabel>Token Usage</ProgressLabel>
          <ProgressValue />
        </Progress>
        <p className="text-xs text-muted-foreground mt-1">
          {formatTokenCount(tokenUsage.used)} /{' '}
          {formatTokenCount(tokenUsage.limit)} (
          {tokenUsage.percentage.toFixed(1)}%)
        </p>
        {tokenUsage.percentage >= 90 && (
          <Alert className="mt-2" variant="destructive">
            <AlertDescription>
              Context is nearly full. Consider removing some files.
            </AlertDescription>
          </Alert>
        )}
      </div>
      <Separator />

      {/* Drop zone */}
      <section
        aria-label="Drop zone for context files"
        className={`flex-1 overflow-hidden relative ${
          isDragging ? 'bg-primary/5' : ''
        } transition-colors`}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {contextFiles.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                {isDragging ? 'Drop files here' : 'No files in context'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Drag and drop files to add them
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="divide-y divide-border">
              {contextFiles.map(file => (
                <div
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
                  key={file.path}
                >
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">
                      {file.path.split('/').pop() || file.path}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {file.path}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {formatTokenCount(file.tokenCount)} tokens
                    </span>
                    <Button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveFile(file.path)}
                      size="icon-xs"
                      title="Remove file"
                      variant="ghost"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/75">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" />
              Adding files...
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
