/**
 * ProjectDashboard Component
 *
 * Main dashboard view with project grid, tag filter sidebar, and search.
 * Requirements: 1.1, 1.2, 3.2, 3.3
 */

import { useState, useMemo } from 'react'
import { Plus, FolderPlus, Tag as TagIcon } from 'lucide-react'
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
    <div className="flex h-screen bg-neutral-50">
      {/* Tag Filter Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-900">
            Filter by Tags
          </h2>
          <button
            className="p-1 text-neutral-500 hover:text-amber-600 hover:bg-amber-50 rounded"
            onClick={() => setShowAddTagDialog(true)}
            title="Add new tag"
          >
            <Plus size={16} />
          </button>
        </div>

        {tagsLoading ? (
          <p className="text-sm text-neutral-500">Loading tags...</p>
        ) : tags.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-neutral-500 mb-2">No tags available</p>
            <button
              className="text-xs text-amber-600 hover:text-amber-700"
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
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                  key={tag.id}
                  onClick={() => toggleTagFilter(tag.id)}
                >
                  {tag.name}
                  <span className="text-xs ml-2 text-neutral-500">
                    ({tag.category === 'tech_stack' ? 'Tech' : 'Status'})
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {selectedTagIds.length > 0 && (
          <button
            className="mt-4 w-full text-sm text-amber-600 hover:text-amber-700"
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
              <h1 className="text-2xl font-bold text-neutral-900">Projects</h1>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-sm hover:bg-amber-600 transition-colors"
                onClick={() => setShowAddProjectDialog(true)}
              >
                <FolderPlus size={18} />
                Add Project
              </button>
            </div>
            <input
              className="w-full max-w-md px-4 py-2 border border-neutral-300 rounded-sm focus:outline-none focus:border-amber-500"
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              type="text"
              value={searchQuery}
            />
          </div>

          {/* Project Grid */}
          {projectsLoading ? (
            <p className="text-neutral-500">Loading projects...</p>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderPlus className="mx-auto h-12 w-12 text-neutral-400 mb-4" />
              <p className="text-neutral-500 mb-2">
                {searchQuery || selectedTagIds.length > 0
                  ? 'No projects found'
                  : 'No projects yet'}
              </p>
              {searchQuery || selectedTagIds.length > 0 ? (
                <p className="text-sm text-neutral-400">
                  Try adjusting your filters
                </p>
              ) : (
                <button
                  className="text-sm text-amber-600 hover:text-amber-700"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-neutral-900">
              Add Project
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1 text-neutral-700"
                  htmlFor="new-project-name"
                >
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  id="new-project-name"
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="My Awesome Project"
                  type="text"
                  value={newProjectName}
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1 text-neutral-700"
                  htmlFor="new-project-path"
                >
                  Project Path <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  id="new-project-path"
                  onChange={e => setNewProjectPath(e.target.value)}
                  placeholder="/path/to/project"
                  type="text"
                  value={newProjectPath}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Enter the full path to your project directory
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="px-4 py-2 text-sm border border-neutral-300 text-neutral-700 rounded-sm hover:bg-neutral-100"
                onClick={() => {
                  setShowAddProjectDialog(false)
                  setNewProjectName('')
                  setNewProjectPath('')
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm bg-amber-500 text-white rounded-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-neutral-900 flex items-center gap-2">
              <TagIcon size={20} />
              Create Tag
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1 text-neutral-700"
                  htmlFor="new-tag-name"
                >
                  Tag Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  id="new-tag-name"
                  onChange={e => setNewTagName(e.target.value)}
                  placeholder="React, In Progress, etc."
                  type="text"
                  value={newTagName}
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1 text-neutral-700"
                  htmlFor="new-tag-category"
                >
                  Category
                </label>
                <select
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                  className="block text-sm font-medium mb-1 text-neutral-700"
                  htmlFor="new-tag-color"
                >
                  Color (optional)
                </label>
                <input
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                className="px-4 py-2 text-sm border border-neutral-300 text-neutral-700 rounded-sm hover:bg-neutral-100"
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
                className="px-4 py-2 text-sm bg-amber-500 text-white rounded-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
