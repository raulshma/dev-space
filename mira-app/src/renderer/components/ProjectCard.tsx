/**
 * ProjectCard Component
 *
 * Displays a project card with name, path, git telemetry, tags, and missing indicator.
 * Requirements: 1.3, 1.4, 2.1, 2.2, 2.4, 3.2
 */

import { Trash2 } from 'lucide-react'
import { useGitTelemetry } from 'renderer/hooks/use-git-telemetry'
import { Card, CardHeader, CardContent } from 'renderer/components/ui/card'
import { Badge } from 'renderer/components/ui/badge'
import { Button } from 'renderer/components/ui/button'
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

  const handleDelete = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (onDelete) {
      onDelete()
    }
  }

  return (
    <Card
      className="hover:border-primary cursor-pointer transition-colors relative group"
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
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDelete}
          title="Remove project from dashboard"
        >
          <Trash2 size={16} />
        </Button>
      )}

      <CardHeader className="pb-3">
        {/* Project Name and Missing Indicator */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold truncate">
            {project.name}
          </h3>
          {project.isMissing && (
            <Badge variant="destructive" className="shrink-0">
              Missing
            </Badge>
          )}
        </div>

        {/* Project Path */}
        <p
          className="text-sm text-muted-foreground truncate"
          title={project.path}
        >
          {project.path}
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Git Telemetry */}
        <div>
          {project.isMissing ? (
            <span className="text-xs text-muted-foreground">Path not found</span>
          ) : gitLoading ? (
            <span className="text-xs text-muted-foreground">
              Loading git status...
            </span>
          ) : gitTelemetry?.isGitRepo ? (
            <div className="flex gap-3 text-xs">
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
            <span className="text-xs text-muted-foreground">No Git</span>
          )}
        </div>

        {/* Tags */}
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.tags.map(tag => (
              <Badge
                key={tag.id}
                variant={tag.category === 'tech_stack' ? 'default' : 'secondary'}
                style={tag.color ? { backgroundColor: tag.color } : undefined}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
