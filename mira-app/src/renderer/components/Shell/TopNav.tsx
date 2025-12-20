/**
 * TopNav Component
 *
 * Top navigation bar showing project info, git status, and controls.
 */

import { memo, useState, useCallback } from 'react'
import {
  IconTag,
  IconPlus,
  IconX,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarRightExpand,
  IconPalette,
} from '@tabler/icons-react'
import { PREDEFINED_THEMES } from 'shared/themes'
import { useProject, useUpdateProject } from 'renderer/hooks/use-projects'
import { useCustomThemes } from 'renderer/hooks/use-custom-themes'
import {
  useGitTelemetry,
  useGitTelemetryRefresh,
} from 'renderer/hooks/use-git-telemetry'
import {
  useTags,
  useAddTagToProject,
  useRemoveTagFromProject,
} from 'renderer/hooks/use-tags'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import { cn } from 'renderer/lib/utils'

interface TopNavProps {
  projectId: string | null
  leftSidebarCollapsed: boolean
  rightSidebarCollapsed: boolean
  zenMode: boolean
  onToggleLeftSidebar: () => void
  onToggleRightSidebar: () => void
  onToggleZenMode: () => void
}

export const TopNav = memo(function TopNav({
  projectId,
  leftSidebarCollapsed,
  rightSidebarCollapsed,
  zenMode,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onToggleZenMode,
}: TopNavProps) {
  const [showTagMenu, setShowTagMenu] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)

  const { data: project } = useProject(projectId)
  const { data: allTags = [] } = useTags()
  const { data: gitTelemetry } = useGitTelemetry(
    project?.isMissing ? null : project?.path || null
  )
  useGitTelemetryRefresh(
    projectId || '',
    project?.path || null,
    !!project && !project.isMissing
  )

  const addTagToProject = useAddTagToProject()
  const removeTagFromProject = useRemoveTagFromProject()
  const updateProject = useUpdateProject()
  const { themes: customThemes } = useCustomThemes()

  const availableTags = allTags.filter(
    tag => !project?.tags.some(t => t.id === tag.id)
  )

  const handleAddTag = useCallback(
    async (tagId: string) => {
      if (!projectId) return
      try {
        await addTagToProject.mutateAsync({ projectId, tagId })
        setShowTagMenu(false)
      } catch (error) {
        console.error('Failed to add tag:', error)
      }
    },
    [addTagToProject, projectId]
  )

  const handleRemoveTag = useCallback(
    async (tagId: string) => {
      if (!projectId) return
      try {
        await removeTagFromProject.mutateAsync({ projectId, tagId })
      } catch (error) {
        console.error('Failed to remove tag:', error)
      }
    },
    [removeTagFromProject, projectId]
  )

  const handleSelectTheme = useCallback(
    async (themeId: string) => {
      if (!projectId) return
      try {
        await updateProject.mutateAsync({
          id: projectId,
          data: { themeId },
        })
        setShowThemeMenu(false)
      } catch (error) {
        console.error('Failed to update theme:', error)
      }
    },
    [updateProject, projectId]
  )

  return (
    <header className="h-10 bg-card border-b border-border flex items-center justify-between px-3 shrink-0">
      {/* Left section - Project info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {project ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">
                {project.name}
              </span>
              {gitTelemetry?.isGitRepo && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <span className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-xs">
                    {gitTelemetry.branch || 'main'}
                  </span>
                  {gitTelemetry.ahead > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      ↑{gitTelemetry.ahead}
                    </span>
                  )}
                  {gitTelemetry.behind > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      ↓{gitTelemetry.behind}
                    </span>
                  )}
                  {gitTelemetry.modified > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      ●{gitTelemetry.modified}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="flex items-center gap-1 shrink-0">
              {project.tags.slice(0, 3).map(tag => (
                <span
                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary"
                  key={tag.id}
                  style={tag.color ? { backgroundColor: tag.color } : undefined}
                >
                  {tag.name}
                  <button
                    className="hover:text-destructive"
                    onClick={() => handleRemoveTag(tag.id)}
                    title="Remove tag"
                  >
                    <IconX size={10} />
                  </button>
                </span>
              ))}
              {project.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{project.tags.length - 3}
                </span>
              )}
              <div className="relative">
                <button
                  className="p-0.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded"
                  onClick={() => setShowTagMenu(prev => !prev)}
                  title="Add tag"
                >
                  <IconPlus size={12} />
                </button>
                {showTagMenu && (
                  <>
                    <button
                      aria-label="Close tag menu"
                      className="fixed inset-0 z-10 cursor-default bg-transparent border-none"
                      onClick={() => setShowTagMenu(false)}
                      tabIndex={-1}
                      type="button"
                    />
                    <div className="absolute left-0 top-full mt-1 z-20 bg-popover border border-border rounded shadow-lg py-1 min-w-[120px]">
                      {availableTags.length > 0 ? (
                        availableTags.map(tag => (
                          <button
                            className="w-full text-left px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent flex items-center gap-2"
                            key={tag.id}
                            onClick={() => handleAddTag(tag.id)}
                          >
                            <IconTag size={12} />
                            {tag.name}
                          </button>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground px-3 py-2">
                          No more tags
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <span className="text-xs text-muted-foreground truncate hidden lg:block">
              {project.path}
            </span>

            {/* Theme Selector */}
            <div className="relative ml-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      className={cn(
                        'p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded',
                        showThemeMenu && 'text-primary bg-primary/10'
                      )}
                      onClick={() => setShowThemeMenu(prev => !prev)}
                      type="button"
                    >
                      <IconPalette size={14} />
                    </button>
                  }
                />
                <TooltipContent>Project Theme</TooltipContent>
              </Tooltip>

              {showThemeMenu && (
                <>
                  <button
                    aria-label="Close theme menu"
                    className="fixed inset-0 z-10 cursor-default bg-transparent border-none"
                    onClick={() => setShowThemeMenu(false)}
                    tabIndex={-1}
                    type="button"
                  />
                  <div className="absolute left-0 top-full mt-1 z-20 bg-popover border border-border rounded shadow-lg py-1 min-w-[180px] max-h-[300px] overflow-y-auto">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-muted-foreground/50 flex items-center gap-2">
                       <div className="h-px flex-1 bg-border" />
                       Predefined
                       <div className="h-px flex-1 bg-border" />
                    </div>
                    {PREDEFINED_THEMES.map(theme => (
                      <button
                        className={cn(
                          'w-full text-left px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent flex items-center justify-between gap-3',
                          project.themeId === theme.id &&
                            'bg-accent/50 font-medium'
                        )}
                        key={theme.id}
                        onClick={() => handleSelectTheme(theme.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full border border-border shrink-0"
                            style={{
                              backgroundColor:
                                theme.colors.primary || 'var(--primary)',
                            }}
                          />
                          <span>{theme.name}</span>
                        </div>
                        {project.themeId === theme.id && (
                          <div className="w-1 h-1 rounded-full bg-primary" />
                        )}
                      </button>
                    ))}

                    {customThemes.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-muted-foreground/50 flex items-center gap-2 mt-1">
                           <div className="h-px flex-1 bg-border" />
                           Custom
                           <div className="h-px flex-1 bg-border" />
                        </div>
                        {customThemes.map(theme => (
                          <button
                            className={cn(
                              'w-full text-left px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent flex items-center justify-between gap-3',
                              project.themeId === theme.id &&
                                'bg-accent/50 font-medium'
                            )}
                            key={theme.id}
                            onClick={() => handleSelectTheme(theme.id)}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full border border-border shrink-0"
                                style={{
                                  backgroundColor:
                                    (theme.colors as any).primary || 'var(--primary)',
                                }}
                              />
                              <span>{theme.name}</span>
                            </div>
                            {project.themeId === theme.id && (
                              <div className="w-1 h-1 rounded-full bg-primary" />
                            )}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            Select a project to get started
          </span>
        )}
      </div>

      {/* Right section - Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                className={cn(
                  'p-1.5 rounded-sm text-sm transition-colors',
                  zenMode
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
                onClick={onToggleZenMode}
                type="button"
              >
                🧘
              </button>
            }
          />
          <TooltipContent>
            {zenMode ? 'Exit Zen Mode (Mod+Shift+Z)' : 'Zen Mode (Mod+Shift+Z)'}
          </TooltipContent>
        </Tooltip>

        {!zenMode && (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    onClick={onToggleLeftSidebar}
                    type="button"
                  >
                    {leftSidebarCollapsed ? (
                      <IconLayoutSidebarLeftExpand className="h-4 w-4" />
                    ) : (
                      <IconLayoutSidebarLeftCollapse className="h-4 w-4" />
                    )}
                  </button>
                }
              />
              <TooltipContent>Toggle Left Sidebar (Mod+B)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    onClick={onToggleRightSidebar}
                    type="button"
                  >
                    {rightSidebarCollapsed ? (
                      <IconLayoutSidebarRightExpand className="h-4 w-4" />
                    ) : (
                      <IconLayoutSidebarRightCollapse className="h-4 w-4" />
                    )}
                  </button>
                }
              />
              <TooltipContent>Toggle Right Sidebar</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </header>
  )
})
