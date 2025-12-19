import { create } from 'zustand'
import type { SidebarTab } from 'renderer/components/LeftSidebar/ActivityBar'

interface SidebarState {
  activeTab: SidebarTab
  expandedFolderPaths: Set<string>
  setActiveTab: (tab: SidebarTab) => void
  setExpandedFolderPaths: (paths: Set<string>) => void
  toggleFolderExpanded: (path: string) => void
  hydrateSidebarState: (tab: SidebarTab, expandedPaths?: string[]) => void
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  activeTab: 'files',
  expandedFolderPaths: new Set(),

  setActiveTab: (tab: SidebarTab) => set({ activeTab: tab }),

  setExpandedFolderPaths: (paths: Set<string>) =>
    set({ expandedFolderPaths: paths }),

  toggleFolderExpanded: (path: string) => {
    const { expandedFolderPaths } = get()
    const newPaths = new Set(expandedFolderPaths)
    if (newPaths.has(path)) {
      newPaths.delete(path)
    } else {
      newPaths.add(path)
    }
    set({ expandedFolderPaths: newPaths })
  },

  hydrateSidebarState: (tab: SidebarTab, expandedPaths?: string[]) =>
    set({
      activeTab: tab,
      expandedFolderPaths: expandedPaths ? new Set(expandedPaths) : new Set(),
    }),
}))
