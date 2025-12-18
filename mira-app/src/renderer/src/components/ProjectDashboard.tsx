/**
 * ProjectDashboard Component
 *
 * Main dashboard view with project grid, tag filter sidebar, and search.
 * Requirements: 1.1, 1.2, 3.2, 3.3
 */

import { useState, useMemo } from 'react'
import { Plus, FolderPlus, Tag as TagIcon, FolderOpen } from 'lucide-react'
import {
  useProjects,
  useCreateProject,
  useDeleteProject,
} from 'renderer/hooks/use-projects'
import { useTags, useCreateTag } from 'renderer/hooks/use-tags'
import { useAppStore } from 'renderer/stores/app-store'
import { ProjectCard } from 'renderer/components/ProjectCard'
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
          <button
            className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded"
            onClick={() => setShowAddTagDialog(true)}
            title="Add new tag"
          >
            <Plus size={16} />
          </button>
        </div>

        {tagsLoading ? (
          <p className="text-sm text-muted-foreground">Loading tags...</p>
        ) : tags.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">No tags available</p>
            <button
              className="text-xs text-primary hover:text-primary/80"
              onClick={() => setShowAddTagDialog(true)}
            >
              Create your first tag
            </button>
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
          <button
            className="mt-4 w-full text-sm text-primary hover:text-primary/80"
            onClick={() => setSelectedTagIds([])}
          >
            Clear filters
          </button>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header with Search and Add Button */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-foreground">Projects</h1>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-colors"
                onClick={() => setShowAddProjectDialog(true)}
              >
                <FolderPlus size={18} />
                Add Project
              </button>
            </div>
            <input
              className="w-full max-w-md px-4 py-2 bg-background text-foreground border border-input rounded-sm focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
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
              <FolderPlus className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
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
                <button
                  className="text-sm text-primary hover:text-primary/80"
                  onClick={() => setShowAddProjectDialog(true)}
                >
                  Add your first project
                </button>
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
      {showAddProjectDialog && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card text-card-foreground rounded-lg p-6 w-full max-w-md shadow-xl border border-border">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              Add Project
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1 text-foreground"
                  htmlFor="new-project-name"
                >
                  Project Name <span className="text-destructive">*</span>
                </label>
                <input
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                  id="new-project-name"
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="My Awesome Project"
                  type="text"
                  value={newProjectName}
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1 text-foreground"
                  htmlFor="new-project-path"
                >
                  Project Path <span className="text-destructive">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 text-sm bg-background text-foreground border border-input rounded-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                    id="new-project-path"
                    onChange={e => setNewProjectPath(e.target.value)}
                    placeholder="/path/to/project"
                    type="text"
                    value={newProjectPath}
                  />
                  <button
                    className="px-3 py-2 text-sm border border-input text-foreground rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-1 transition-colors"
                    onClick={handleBrowsePath}
                    title="Browse for directory"
                    type="button"
                  >
                    <FolderOpen size={16} />
                    Browse
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the full path or browse to your project directory
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="px-4 py-2 text-sm border border-input text-foreground rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => {
                  setShowAddProjectDialog(false)
                  setNewProjectName('')
                  setNewProjectPath('')
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={
                  !newProjectName.trim() ||
                  !newProjectPath.trim() ||
                  createProject.isPending
                }
                onClick={handleAddProject}
              >
                {createProject.isPending ? 'Adding...' : 'Add Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tag Dialog */}
      {showAddTagDialog && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card text-card-foreground rounded-lg p-6 w-full max-w-md shadow-xl border border-border">
            <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
              <TagIcon size={20} />
              Create Tag
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1 text-foreground"
                  htmlFor="new-tag-name"
                >
                  Tag Name <span className="text-destructive">*</span>
                </label>
                <input
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                  id="new-tag-name"
                  onChange={e => setNewTagName(e.target.value)}
                  placeholder="React, In Progress, etc."
                  type="text"
                  value={newTagName}
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1 text-foreground"
                  htmlFor="new-tag-category"
                >
                  Category
                </label>
                <select
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  id="new-tag-category"
                  onChange={e =>
                    setNewTagCategory(e.target.value as 'tech_stack' | 'status')
                  }
                  value={newTagCategory}
                >
                  <option value="tech_stack">Tech Stack</option>
                  <option value="status">Status</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1 text-foreground"
                  htmlFor="new-tag-color"
                >
                  Color (optional)
                </label>
                <input
                  className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                  id="new-tag-color"
                  onChange={e => setNewTagColor(e.target.value)}
                  placeholder="#3b82f6"
                  type="text"
                  value={newTagColor}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="px-4 py-2 text-sm border border-input text-foreground rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => {
                  setShowAddTagDialog(false)
                  setNewTagName('')
                  setNewTagCategory('tech_stack')
                  setNewTagColor('')
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={!newTagName.trim() || createTag.isPending}
                onClick={handleAddTag}
              >
                {createTag.isPending ? 'Creating...' : 'Create Tag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
