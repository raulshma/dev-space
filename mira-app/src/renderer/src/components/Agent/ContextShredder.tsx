import { useState, useEffect, useCallback } from 'react'
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

      // Get file paths from drag event
      const files = Array.from(e.dataTransfer.files)

      if (files.length === 0) {
        return
      }

      setLoading(true)

      try {
        // Add each file to context
        for (const file of files) {
          // Electron provides the full path on the file object
          const filePath = (file as { path?: string }).path
          if (filePath) {
            await window.api.agent.addContextFile({ projectId, filePath })
          }
        }

        // Reload context files and usage
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

  const getUsageColor = (): string => {
    if (tokenUsage.percentage >= 90) return 'bg-red-500'
    if (tokenUsage.percentage >= 70) return 'bg-amber-500'
    return 'bg-green-500'
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-neutral-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">
          Context Files
        </h3>
        <p className="text-xs text-neutral-500">
          Drag and drop files to add them to the AI context
        </p>
      </div>

      {/* Token usage bar */}
      <div className="border-b border-neutral-200 px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-neutral-600">Token Usage</span>
          <span className="font-medium text-neutral-900">
            {formatTokenCount(tokenUsage.used)} /{' '}
            {formatTokenCount(tokenUsage.limit)} (
            {tokenUsage.percentage.toFixed(1)}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className={`h-full transition-all duration-300 ${getUsageColor()}`}
            style={{ width: `${Math.min(tokenUsage.percentage, 100)}%` }}
          />
        </div>
        {tokenUsage.percentage >= 90 && (
          <p className="mt-2 text-xs text-red-600">
            Warning: Context is nearly full. Consider removing some files.
          </p>
        )}
      </div>

      {/* Drop zone */}
      <section
        aria-label="Drop zone for context files"
        className={`flex-1 overflow-y-auto ${
          isDragging ? 'bg-amber-50' : ''
        } transition-colors`}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {contextFiles.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
              <p className="mt-2 text-sm text-neutral-600">
                {isDragging ? 'Drop files here' : 'No files in context'}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Drag and drop files to add them
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {contextFiles.map(file => (
              <div
                className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
                key={file.path}
              >
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {file.path.split('/').pop() || file.path}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {file.path}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <span className="text-xs text-neutral-600">
                    {formatTokenCount(file.tokenCount)} tokens
                  </span>
                  <button
                    className="rounded-sm p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => handleRemoveFile(file.path)}
                    title="Remove file"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        clipRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        fillRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-amber-500" />
              Adding files...
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
