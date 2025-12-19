/**
 * ProjectsPanel Component
 *
 * Sidebar panel for project management - list, add, and switch projects.
 */

import { useState, useMemo, useCallback, memo } from 'react'
import {
  IconPlus,
  IconFolderPlus,
  IconFolderOpen,
  IconSearch,
  IconTag,
  IconTrash,
  IconChevronRight,
  IconChevronDown,
} from '@tabler/icons-react'
import {
  useProjects,
  useCreateProject,
  useDeleteProject,
} from 'renderer/hooks/use-projects'
import { useTags, useCreateTag } from 'renderer/hooks/use-tags'
import { useAppStore } from 'renderer/stores/app-store'
import { Button } from 'renderer/components/ui/button'
import { Input } from 'renderer/components/ui/input'
import { Label } from 'renderer/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from 'renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'renderer/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'renderer/components/ui/collapsible'
import { cn } from 'renderer/lib/utils'
import type { ProjectFilter, Project } from 'shared/models'

interface ProjectItemProps {
  project: Project
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

const ProjectItem = memo(function ProjectItem({
  project,
  isActive,
  onSelect,
  onDelete,
}: ProjectItemProps) {
  return (
    <button
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer transition-colors w-full text-left',
        isActive
          ? 'bg-primary/20 text-primary'
          : 'hover:bg-muted/50 text-foreground'
      )}
      onClick={onSelect}
      type="button"
    >
      <IconFolderOpen
        className={cn('h-4 w-4 shrink-0', project.isMissing && 'opacity-50')}
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm truncate',
            project.isMissing && 'line-through opacity-50'
          )}
        >
          {project.name}
        </p>
      </div>
      <span
        className="opacity-0 group-hover:opacity-100 h-6 w-6 inline-flex items-center justify-center"
        onClick={e => {
          e.stopPropagation()
          onDelete()
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
            onDelete()
          }
        }}
        role="button"
        tabIndex={0}
        title="Remove project"
      >
        <IconTrash className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
      </span>
    </button>
  )
})

export function ProjectsPanel(): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false)
  const [showAddTagDialog, setShowAddTagDialog] = useState(false)
  const [tagsExpanded, setTagsExpanded] = useState(false)

  // Form state for adding project
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectPath, setNewProjectPath] = useState('')

  // Form state for adding tag
  const [newTagName, setNewTagName] = useState('')
  const [newTagCategory, setNewTagCategory] = useState<'tech_stack' | 'status'>(
    'tech_stack'
  )
  const [newTagColor, setNewTagColor] = useState('')

  const activeProjectId = useAppStore(state => state.activeProjectId)
  const setActiveProject = useAppStore(state => state.setActiveProject)
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()
  const createTag = useCreateTag()

  // Build filter from UI state
  const filter: ProjectFilter = useMemo(() => {
    const f: ProjectFilter = {}
    if (searchQuery.trim()) {
      f.searchQuery = searchQuery.trim()
    }
    if (selectedTagIds.length > 0) {
      f.tagFilter = selectedTagIds
    }
    return f
  }, [searchQuery, selectedTagIds])

  // Fetch projects with filter
  const { data: projects = [], isLoading: projectsLoading } =
    useProjects(filter)

  // Fetch all tags for filter
  const { data: tags = [] } = useTags()

  // Handle tag filter toggle
  const toggleTagFilter = useCallback((tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }, [])

  // Extract folder name from path
  const getFolderName = (path: string): string => {
    const normalized = path.replace(/\\/g, '/')
    const parts = normalized.split('/').filter(Boolean)
    return parts[parts.length - 1] || ''
  }

  // Handle browse for project path
  const handleBrowsePath = async (): Promise<void> => {
    try {
      const result = await window.api.dialog.openDirectory({
        title: 'Select Project Directory',
      })
      if (!result.canceled && result.path) {
        setNewProjectPath(result.path)
        if (!newProjectName.trim()) {
          setNewProjectName(getFolderName(result.path))
        }
      }
    } catch (error) {
      console.error('Failed to open directory dialog:', error)
    }
  }

  // Handle add project
  const handleAddProject = async (): Promise<void> => {
    if (!newProjectName.trim() || !newProjectPath.trim()) return

    try {
      const newProject = await createProject.mutateAsync({
        name: newProjectName.trim(),
        path: newProjectPath.trim(),
      })
      setNewProjectName('')
      setNewProjectPath('')
      setShowAddProjectDialog(false)
      // Auto-select the new project
      if (newProject) {
        setActiveProject(newProject.id)
      }
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  // Handle delete project
  const handleDeleteProject = async (
    projectId: string,
    projectName: string
  ): Promise<void> => {
    if (
      !confirm(
        `Remove "${projectName}" from the list? This won't delete the project files.`
      )
    ) {
      return
    }

    try {
      await deleteProject.mutateAsync(projectId)
      if (activeProjectId === projectId) {
        setActiveProject(null)
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  // Handle add tag
  const handleAddTag = async (): Promise<void> => {
    if (!newTagName.trim()) return

    try {
      await createTag.mutateAsync({
        name: newTagName.trim(),
        category: newTagCategory,
        color: newTagColor || undefined,
      })
      setNewTagName('')
      setNewTagCategory('tech_stack')
      setNewTagColor('')
      setShowAddTagDialog(false)
    } catch (error) {
      console.error('Failed to create tag:', error)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium">Projects</span>
        <Button
          onClick={() => setShowAddProjectDialog(true)}
          size="icon-sm"
          title="Add project"
          variant="ghost"
        >
          <IconPlus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-7 pl-7 text-xs"
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            value={searchQuery}
          />
        </div>
      </div>

      {/* Tags filter (collapsible) */}
      {tags.length > 0 && (
        <Collapsible onOpenChange={setTagsExpanded} open={tagsExpanded}>
          <CollapsibleTrigger className="flex items-center gap-1 px-3 py-1.5 w-full text-xs text-muted-foreground hover:text-foreground border-b border-border">
            {tagsExpanded ? (
              <IconChevronDown className="h-3 w-3" />
            ) : (
              <IconChevronRight className="h-3 w-3" />
            )}
            <IconTag className="h-3 w-3" />
            <span>Filter by tags</span>
            {selectedTagIds.length > 0 && (
              <span className="ml-auto text-primary">
                ({selectedTagIds.length})
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 py-2 border-b border-border">
            <div className="flex flex-wrap gap-1">
              {tags.map(tag => {
                const isSelected = selectedTagIds.includes(tag.id)
                return (
                  <button
                    className={cn(
                      'px-2 py-0.5 rounded text-xs transition-colors',
                      isSelected
                        ? 'bg-primary/20 text-primary border border-primary/50'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                    key={tag.id}
                    onClick={() => toggleTagFilter(tag.id)}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
            {selectedTagIds.length > 0 && (
              <Button
                className="mt-2 h-6 text-xs"
                onClick={() => setSelectedTagIds([])}
                size="sm"
                variant="link"
              >
                Clear filters
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {projectsLoading ? (
          <p className="text-xs text-muted-foreground px-2">Loading...</p>
        ) : projects.length === 0 ? (
          <div className="text-center py-4">
            <IconFolderPlus className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground mb-2">
              {searchQuery || selectedTagIds.length > 0
                ? 'No projects found'
                : 'No projects yet'}
            </p>
            {!searchQuery && selectedTagIds.length === 0 && (
              <Button
                className="text-xs"
                onClick={() => setShowAddProjectDialog(true)}
                size="sm"
                variant="link"
              >
                Add your first project
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {projects.map(project => (
              <ProjectItem
                isActive={activeProjectId === project.id}
                key={project.id}
                onDelete={() => handleDeleteProject(project.id, project.name)}
                onSelect={() => setActiveProject(project.id)}
                project={project}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Project Dialog */}
      <Dialog
        onOpenChange={setShowAddProjectDialog}
        open={showAddProjectDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-project-name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-project-name"
                onChange={e => setNewProjectName(e.target.value)}
                placeholder="My Awesome Project"
                value={newProjectName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-project-path">
                Project Path <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  id="new-project-path"
                  onChange={e => setNewProjectPath(e.target.value)}
                  placeholder="/path/to/project"
                  value={newProjectPath}
                />
                <Button
                  onClick={handleBrowsePath}
                  type="button"
                  variant="outline"
                >
                  <IconFolderOpen className="mr-2" size={16} />
                  Browse
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowAddProjectDialog(false)
                setNewProjectName('')
                setNewProjectPath('')
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                !newProjectName.trim() ||
                !newProjectPath.trim() ||
                createProject.isPending
              }
              onClick={handleAddProject}
            >
              {createProject.isPending ? 'Adding...' : 'Add Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Tag Dialog */}
      <Dialog onOpenChange={setShowAddTagDialog} open={showAddTagDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconTag size={20} />
              Create Tag
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-tag-name">
                Tag Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-tag-name"
                onChange={e => setNewTagName(e.target.value)}
                placeholder="React, In Progress, etc."
                value={newTagName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-tag-category">Category</Label>
              <Select
                onValueChange={value =>
                  setNewTagCategory(value as 'tech_stack' | 'status')
                }
                value={newTagCategory}
              >
                <SelectTrigger id="new-tag-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tech_stack">Tech Stack</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-tag-color">Color (optional)</Label>
              <Input
                id="new-tag-color"
                onChange={e => setNewTagColor(e.target.value)}
                placeholder="#3b82f6"
                value={newTagColor}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowAddTagDialog(false)
                setNewTagName('')
                setNewTagCategory('tech_stack')
                setNewTagColor('')
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!newTagName.trim() || createTag.isPending}
              onClick={handleAddTag}
            >
              {createTag.isPending ? 'Creating...' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
