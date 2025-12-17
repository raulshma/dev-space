import { useState } from 'react'
import { useBlueprints, useCreateBlueprint } from '../../hooks/use-blueprints'
import type { Blueprint } from '../../../../shared/models'

/**
 * BlueprintManager Component
 *
 * Manages scaffold blueprints for quick project setup.
 * Displays saved blueprints and provides actions to save and apply templates.
 *
 * Requirements: 15.1, 15.2, 15.3
 */
export function BlueprintManager(): React.JSX.Element {
  const { data: blueprints, isLoading, error } = useBlueprints()
  const createBlueprint = useCreateBlueprint()

  const [showCaptureDialog, setShowCaptureDialog] = useState(false)
  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null)

  // Form state for capturing blueprint
  const [capturePath, setCapturePath] = useState('')
  const [captureName, setCaptureName] = useState('')
  const [captureDescription, setCaptureDescription] = useState('')
  const [captureExcludePatterns, setCaptureExcludePatterns] = useState('')

  // Form state for applying blueprint
  const [applyTargetPath, setApplyTargetPath] = useState('')

  const handleSaveAsTemplate = async (): Promise<void> => {
    if (!capturePath || !captureName) {
      alert('Please provide both a project path and blueprint name')
      return
    }

    try {
      // Capture the blueprint structure
      const captureResponse = await window.api.blueprints.capture({
        projectPath: capturePath,
        customExcludePatterns: captureExcludePatterns
          ? captureExcludePatterns.split(',').map((p) => p.trim())
          : undefined
      })

      // Create the blueprint in database
      await createBlueprint.mutateAsync({
        name: captureName,
        description: captureDescription || undefined,
        structure: captureResponse.structure
      })

      // Reset form and close dialog
      setCapturePath('')
      setCaptureName('')
      setCaptureDescription('')
      setCaptureExcludePatterns('')
      setShowCaptureDialog(false)

      alert('Blueprint saved successfully!')
    } catch (err) {
      console.error('Failed to save blueprint:', err)
      alert(`Failed to save blueprint: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleApplyBlueprint = async (): Promise<void> => {
    if (!selectedBlueprint || !applyTargetPath) {
      alert('Please select a blueprint and provide a target path')
      return
    }

    try {
      await window.api.blueprints.apply({
        blueprintId: selectedBlueprint.id,
        targetPath: applyTargetPath
      })

      // Reset form and close dialog
      setApplyTargetPath('')
      setShowApplyDialog(false)
      setSelectedBlueprint(null)

      alert('Blueprint applied successfully!')
    } catch (err) {
      console.error('Failed to apply blueprint:', err)
      alert(`Failed to apply blueprint: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const openApplyDialog = (blueprint: Blueprint): void => {
    setSelectedBlueprint(blueprint)
    setShowApplyDialog(true)
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <p className="text-sm text-neutral-400">Loading blueprints...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-400">Failed to load blueprints</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100">Scaffold Blueprints</h2>
            <p className="text-sm text-neutral-400">Save and reuse project templates</p>
          </div>
          <button
            onClick={() => setShowCaptureDialog(true)}
            className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700"
          >
            Save as Template
          </button>
        </div>
      </div>

      {/* Blueprint List */}
      <div className="flex-1 overflow-y-auto">
        {!blueprints || blueprints.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-neutral-400">No blueprints saved yet</p>
            <p className="text-xs text-neutral-500 mt-1">
              Click &quot;Save as Template&quot; to create your first blueprint
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {blueprints.map((blueprint) => (
              <div
                key={blueprint.id}
                className="p-3 border border-neutral-700 rounded-lg hover:bg-neutral-800/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-sm text-neutral-100">{blueprint.name}</h3>
                    {blueprint.description && (
                      <p className="text-xs text-neutral-400 mt-1">{blueprint.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500">
                      <span>{blueprint.structure.files.length} files</span>
                      <span>•</span>
                      <span>Created {new Date(blueprint.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => openApplyDialog(blueprint)}
                    className="ml-3 px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Capture Dialog */}
      {showCaptureDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-neutral-100">Save Project as Template</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-200">
                  Project Path <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={capturePath}
                  onChange={(e) => setCapturePath(e.target.value)}
                  placeholder="/path/to/project"
                  className="w-full px-3 py-2 text-sm border border-neutral-600 bg-neutral-900 text-neutral-100 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-200">
                  Blueprint Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={captureName}
                  onChange={(e) => setCaptureName(e.target.value)}
                  placeholder="My Project Template"
                  className="w-full px-3 py-2 text-sm border border-neutral-600 bg-neutral-900 text-neutral-100 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-200">Description</label>
                <textarea
                  value={captureDescription}
                  onChange={(e) => setCaptureDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-neutral-600 bg-neutral-900 text-neutral-100 rounded focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-200">
                  Additional Exclude Patterns
                </label>
                <input
                  type="text"
                  value={captureExcludePatterns}
                  onChange={(e) => setCaptureExcludePatterns(e.target.value)}
                  placeholder="*.log, temp, cache"
                  className="w-full px-3 py-2 text-sm border border-neutral-600 bg-neutral-900 text-neutral-100 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Comma-separated patterns (node_modules, .git, build are excluded by default)
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCaptureDialog(false)
                  setCapturePath('')
                  setCaptureName('')
                  setCaptureDescription('')
                  setCaptureExcludePatterns('')
                }}
                className="px-3 py-1.5 text-sm border border-neutral-600 text-neutral-300 rounded hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsTemplate}
                disabled={!capturePath || !captureName || createBlueprint.isPending}
                className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createBlueprint.isPending ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Dialog */}
      {showApplyDialog && selectedBlueprint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-neutral-100">Apply Blueprint</h3>

            <div className="mb-4">
              <p className="text-sm text-neutral-400">
                Applying: <span className="font-medium text-neutral-100">{selectedBlueprint.name}</span>
              </p>
              {selectedBlueprint.description && (
                <p className="text-xs text-neutral-500 mt-1">
                  {selectedBlueprint.description}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-200">
                  Target Directory <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={applyTargetPath}
                  onChange={(e) => setApplyTargetPath(e.target.value)}
                  placeholder="/path/to/new-project"
                  className="w-full px-3 py-2 text-sm border border-neutral-600 bg-neutral-900 text-neutral-100 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  The blueprint structure will be created in this directory
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowApplyDialog(false)
                  setApplyTargetPath('')
                  setSelectedBlueprint(null)
                }}
                className="px-3 py-1.5 text-sm border border-neutral-600 text-neutral-300 rounded hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyBlueprint}
                disabled={!applyTargetPath}
                className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Blueprint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
