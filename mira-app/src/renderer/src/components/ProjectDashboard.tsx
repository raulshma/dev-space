/**
 * ProjectDashboard Component
 *
 * Main dashboard view with project grid, tag filter sidebar, and search.
 * Requirements: 1.1, 3.3
 */

import { useState, useMemo } from 'react'
import { useProjects } from 'renderer/hooks/use-projects'
import { useTags } from 'renderer/hooks/use-tags'
import { useAppStore } from 'renderer/stores/app-store'
import { ProjectCard } from 'renderer/components/ProjectCard'
import type { ProjectFilter } from 'shared/models'

export function ProjectDashboard(): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  const setActiveProject = useAppStore(state => state.setActiveProject)

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

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Tag Filter Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 p-4 overflow-y-auto">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">
          Filter by Tags
        </h2>

        {tagsLoading ? (
          <p className="text-sm text-neutral-500">Loading tags...</p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-neutral-500">No tags available</p>
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
          {/* Header with Search */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-neutral-900 mb-4">
              Projects
            </h1>
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
              <p className="text-neutral-500 mb-2">No projects found</p>
              {(searchQuery || selectedTagIds.length > 0) && (
                <p className="text-sm text-neutral-400">
                  Try adjusting your filters
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projects.map(project => (
                <ProjectCard
                  key={project.id}
                  onClick={() => handleProjectClick(project.id)}
                  project={project}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
