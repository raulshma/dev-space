/**
 * ProjectDashboard Component
 *
 * Main dashboard view with project grid, tag filter sidebar, and search.
 * Requirements: 1.1, 1.2, 3.2, 3.3
 */

import { useState, useMemo } from 'react'
import {
  IconPlus,
  IconFolderPlus,
  IconTag,
  IconFolderOpen,
  IconSettings,
  IconRocket,
  IconRobot,
  IconChevronRight,
} from '@tabler/icons-react'
import { TaskCreationDialog } from 'renderer/components/Agent/TaskCreationDialog'
import {
  useProjects,
  useCreateProject,
  useDeleteProject,
} from 'renderer/hooks/use-projects'
import { useTags, useCreateTag } from 'renderer/hooks/use-tags'
import { useAppStore } from 'renderer/stores/app-store'
import { ProjectCard } from 'renderer/components/ProjectCard'
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
import type { ProjectFilter } from 'shared/models'

export function ProjectDashboard(): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false)
  const [showAddTagDialog, setShowAddTagDialog] = useState(false)
  const [showCreateWithAgentDialog, setShowCreateWithAgentDialog] =
    useState(false)

  // Form state for adding project
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectPath, setNewProjectPath] = useState('')

  // Form state for adding tag
  const [newTagName, setNewTagName] = useState('')
  const [newTagCategory, setNewTagCategory] = useState<'tech_stack' | 'status'>(
    'tech_stack'
  )
  const [newTagColor, setNewTagColor] = useState('')

  const setActiveProject = useAppStore(state => state.setActiveProject)
  const setActiveView = useAppStore(state => state.setActiveView)
  const openTasksWithTask = useAppStore(state => state.openTasksWithTask)
  const openSettingsPanel = useAppStore(state => state.openSettingsPanel)
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

  // Fetch all tags for filter sidebar
  const { data: tags = [], isLoading: tagsLoading } = useTags()

  // Handle tag filter toggle
  const toggleTagFilter = (tagId: string): void => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  // Handle project click
  const handleProjectClick = (projectId: string): void => {
    setActiveProject(projectId)
  }

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
        // Auto-fill project name from folder name if empty
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
    if (!newProjectName.trim() || !newProjectPath.trim()) {
      alert('Please provide both a project name and path')
      return
    }

    try {
      await createProject.mutateAsync({
        name: newProjectName.trim(),
        path: newProjectPath.trim(),
      })
      setNewProjectName('')
      setNewProjectPath('')
      setShowAddProjectDialog(false)
    } catch (error) {
      console.error('Failed to create project:', error)
      alert('Failed to create project. Please check the path and try again.')
    }
  }

  // Handle delete project
  const handleDeleteProject = async (
    projectId: string,
    projectName: string
  ): Promise<void> => {
    if (
      !confirm(
        `Are you sure you want to remove "${projectName}" from the dashboard? This will not delete the project files.`
      )
    ) {
      return
    }

    try {
      await deleteProject.mutateAsync(projectId)
    } catch (error) {
      console.error('Failed to delete project:', error)
      alert('Failed to remove project. Please try again.')
    }
  }

  // Handle add tag
  const handleAddTag = async (): Promise<void> => {
    if (!newTagName.trim()) {
      alert('Please provide a tag name')
      return
    }

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
      alert('Failed to create tag. Please try again.')
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Tag Filter Sidebar */}
      <aside className="w-64 bg-card border-r border-border p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">
            Filter by Tags
          </h2>
          <Button
            onClick={() => setShowAddTagDialog(true)}
            size="icon"
            title="Add new tag"
            variant="ghost"
          >
            <IconPlus size={16} />
          </Button>
        </div>

        {tagsLoading ? (
          <p className="text-sm text-muted-foreground">Loading tags...</p>
        ) : tags.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">
              No tags available
            </p>
            <Button
              onClick={() => setShowAddTagDialog(true)}
              size="sm"
              variant="link"
            >
              Create your first tag
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tags.map(tag => {
              const isSelected = selectedTagIds.includes(tag.id)
              return (
                <button
                  className={`w-full text-left px-3 py-2 rounded-sm text-sm transition-colors ${
                    isSelected
                      ? 'bg-primary/20 text-primary-foreground dark:text-primary border border-primary/50'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                  key={tag.id}
                  onClick={() => toggleTagFilter(tag.id)}
                >
                  {tag.name}
                  <span className="text-xs ml-2 text-muted-foreground">
                    ({tag.category === 'tech_stack' ? 'Tech' : 'Status'})
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {selectedTagIds.length > 0 && (
          <Button
            className="mt-4 w-full"
            onClick={() => setSelectedTagIds([])}
            size="sm"
            variant="link"
          >
            Clear filters
          </Button>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header with Search and Add Button */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-foreground">Projects</h1>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setActiveView('tasks')}
                  variant="outline"
                >
                  <IconRocket className="mr-2" size={18} />
                  Tasks
                </Button>
                <Button onClick={() => setShowAddProjectDialog(true)}>
                  <IconFolderPlus className="mr-2" size={18} />
                  Add Project
                </Button>
                <Button
                  onClick={openSettingsPanel}
                  size="icon"
                  title="Settings (Mod+,)"
                  variant="outline"
                >
                  <IconSettings size={18} />
                </Button>
              </div>
            </div>
            <Input
              className="w-full max-w-md"
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              type="text"
              value={searchQuery}
            />
          </div>

          {/* Project Grid */}
          {projectsLoading ? (
            <p className="text-muted-foreground">Loading projects...</p>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <IconFolderPlus className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-2">
                {searchQuery || selectedTagIds.length > 0
                  ? 'No projects found'
                  : 'No projects yet'}
              </p>
              {searchQuery || selectedTagIds.length > 0 ? (
                <p className="text-sm text-muted-foreground/70">
                  Try adjusting your filters
                </p>
              ) : (
                <Button
                  onClick={() => setShowAddProjectDialog(true)}
                  variant="link"
                >
                  Add your first project
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projects.map(project => (
                <ProjectCard
                  key={project.id}
                  onClick={() => handleProjectClick(project.id)}
                  onDelete={() => handleDeleteProject(project.id, project.name)}
                  project={project}
                />
              ))}
            </div>
          )}
        </div>
      </main>

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
                type="text"
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
                  type="text"
                  value={newProjectPath}
                />
                <Button
                  onClick={handleBrowsePath}
                  title="Browse for directory"
                  type="button"
                  variant="outline"
                >
                  <IconFolderOpen className="mr-2" size={16} />
                  Browse
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the full path or browse to your project directory
              </p>
            </div>

            {/* Divider with AI Agent option */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            <button
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left group"
              onClick={() => {
                setShowAddProjectDialog(false)
                setNewProjectName('')
                setNewProjectPath('')
                setShowCreateWithAgentDialog(true)
              }}
              type="button"
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <IconRobot size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Create with AI Agent</p>
                <p className="text-xs text-muted-foreground">
                  Let an autonomous agent create a new project from scratch
                </p>
              </div>
              <IconChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
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
                type="text"
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
                type="text"
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

      {/* Create Project with AI Agent Dialog */}
      <TaskCreationDialog
        defaultAgentType="autonomous"
        defaultDirectory=""
        onOpenChange={setShowCreateWithAgentDialog}
        onTaskCreated={taskId => {
          console.log('Task created:', taskId)
          // Close the dialog
          setShowCreateWithAgentDialog(false)
          // Navigate to tasks view to see the created task
          openTasksWithTask(taskId)
        }}
        open={showCreateWithAgentDialog}
      />
    </div>
  )
}
