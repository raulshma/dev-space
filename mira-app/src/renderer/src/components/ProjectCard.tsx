/**
 * ProjectCard Component
 *
 * Displays a project card with name, path, git telemetry, tags, and missing indicator.
 * Requirements: 1.3, 1.4, 2.1, 2.2, 2.4, 3.2
 */

import { Trash2 } from 'lucide-react'
import { useGitTelemetry } from 'renderer/hooks/use-git-telemetry'
import type { Project } from 'shared/models'

interface ProjectCardProps {
  project: Project
  onClick?: () => void
  onDelete?: () => void
}

export function ProjectCard({
  project,
  onClick,
  onDelete,
}: ProjectCardProps): React.JSX.Element {
  const { data: gitTelemetry, isLoading: gitLoading } = useGitTelemetry(
    project.isMissing ? null : project.path
  )

  // Get tag category colors
  const getTagColor = (category: 'tech_stack' | 'status'): string => {
    return category === 'tech_stack'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-green-100 text-green-800'
  }

  const handleDelete = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (onDelete) {
      onDelete()
    }
  }

  return (
    <div
      className="border rounded-sm p-4 hover:border-amber-500 cursor-pointer transition-colors bg-white text-left w-full relative group"
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Delete button - shown on hover */}
      {onDelete && (
        <button
          className="absolute top-2 right-2 p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDelete}
          title="Remove project from dashboard"
        >
          <Trash2 size={16} />
        </button>
      )}
      {/* Project Name and Missing Indicator */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-neutral-900">
          {project.name}
        </h3>
        {project.isMissing && (
          <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-sm">
            Missing
          </span>
        )}
      </div>

      {/* Project Path */}
      <p
        className="text-sm text-neutral-600 mb-3 truncate"
        title={project.path}
      >
        {project.path}
      </p>

      {/* Git Telemetry */}
      <div className="mb-3">
        {project.isMissing ? (
          <span className="text-xs text-neutral-500">Path not found</span>
        ) : gitLoading ? (
          <span className="text-xs text-neutral-500">
            Loading git status...
          </span>
        ) : gitTelemetry?.isGitRepo ? (
          <div className="flex gap-3 text-xs text-neutral-700">
            {gitTelemetry.ahead > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-green-600">↑</span>
                {gitTelemetry.ahead}
              </span>
            )}
            {gitTelemetry.behind > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-red-600">↓</span>
                {gitTelemetry.behind}
              </span>
            )}
            {gitTelemetry.modified > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-amber-600">●</span>
                {gitTelemetry.modified} modified
              </span>
            )}
            {gitTelemetry.ahead === 0 &&
              gitTelemetry.behind === 0 &&
              gitTelemetry.modified === 0 && (
                <span className="text-green-600">✓ Up to date</span>
              )}
          </div>
        ) : (
          <span className="text-xs text-neutral-500">No Git</span>
        )}
      </div>

      {/* Tags */}
      {project.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {project.tags.map(tag => (
            <span
              className={`text-xs px-2 py-1 rounded-sm ${getTagColor(tag.category)}`}
              key={tag.id}
              style={tag.color ? { backgroundColor: tag.color } : undefined}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
