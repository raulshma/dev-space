/**
 * ProjectDashboard Component
 *
 * Main dashboard view with project grid, tag filter sidebar, and search.
 * Requirements: 1.1, 1.2, 3.2, 3.3
 */

import { useState, useMemo } from 'react'
import { IconPlus, IconFolderPlus, IconTag, IconFolderOpen } from '@tabler/icons-react'
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
            variant="ghost"
            size="icon"
            onClick={() => setShowAddTagDialog(true)}
            title="Add new tag"
          >
            <IconPlus size={16} />
          </Button>
        </div>

        {tagsLoading ? (
          <p className="text-sm text-muted-foreground">Loading tags...</p>
        ) : tags.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">No tags available</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setShowAddTagDialog(true)}
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
            variant="link"
            size="sm"
            className="mt-4 w-full"
            onClick={() => setSelectedTagIds([])}
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
              <Button onClick={() => setShowAddProjectDialog(true)}>
                <IconFolderPlus size={18} className="mr-2" />
                Add Project
              </Button>
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
                  variant="link"
                  onClick={() => setShowAddProjectDialog(true)}
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
      <Dialog open={showAddProjectDialog} onOpenChange={setShowAddProjectDialog}>
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
                  variant="outline"
                  onClick={handleBrowsePath}
                  title="Browse for directory"
                  type="button"
                >
                  <IconFolderOpen size={16} className="mr-2" />
                  Browse
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the full path or browse to your project directory
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddProjectDialog(false)
                setNewProjectName('')
                setNewProjectPath('')
              }}
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
      <Dialog open={showAddTagDialog} onOpenChange={setShowAddTagDialog}>
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
                value={newTagCategory}
                onValueChange={value =>
                  setNewTagCategory(value as 'tech_stack' | 'status')
                }
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
              variant="outline"
              onClick={() => {
                setShowAddTagDialog(false)
                setNewTagName('')
                setNewTagCategory('tech_stack')
                setNewTagColor('')
              }}
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
