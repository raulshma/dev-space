import { create } from 'zustand'

interface OpenFile {
  path: string
  name: string
  content: string
  originalContent: string
  language: string
  size: number
  isTruncated: boolean
  isDirty: boolean
  // Diff-specific fields
  isDiff?: boolean
  diffOriginal?: string
  diffModified?: string
  diffStaged?: boolean
}

interface EditorState {
  openFiles: OpenFile[]
  activeFilePath: string | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
}

interface EditorActions {
  openFile: (filePath: string) => Promise<void>
  openDiff: (
    projectPath: string,
    filePath: string,
    staged?: boolean
  ) => Promise<void>
  closeFile: (filePath: string) => void
  setActiveFile: (filePath: string) => void
  closeAllFiles: () => void
  updateFileContent: (filePath: string, content: string) => void
  saveFile: (filePath: string) => Promise<boolean>
  saveActiveFile: () => Promise<boolean>
  revertFile: (filePath: string) => void
  getActiveFile: () => OpenFile | undefined
}

export const useEditorStore = create<EditorState & EditorActions>(
  (set, get) => ({
    openFiles: [],
    activeFilePath: null,
    isLoading: false,
    isSaving: false,
    error: null,

    openFile: async (filePath: string) => {
      const { openFiles } = get()

      // Check if already open
      const existing = openFiles.find(f => f.path === filePath)
      if (existing) {
        set({ activeFilePath: filePath })
        return
      }

      set({ isLoading: true, error: null })

      try {
        const result = await window.api.files.read({ path: filePath })

        if ('error' in result) {
          set({ error: result.error as string, isLoading: false })
          return
        }

        const fileName = filePath.split(/[/\\]/).pop() || 'untitled'
        const newFile: OpenFile = {
          path: filePath,
          name: fileName,
          content: result.content,
          originalContent: result.content,
          language: result.language,
          size: result.size,
          isTruncated: result.isTruncated,
          isDirty: false,
        }

        set(state => ({
          openFiles: [...state.openFiles, newFile],
          activeFilePath: filePath,
          isLoading: false,
        }))
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to open file',
          isLoading: false,
        })
      }
    },

    openDiff: async (projectPath: string, filePath: string, staged = false) => {
      // Create a unique path for the diff tab
      const diffPath = `diff://${filePath}${staged ? '?staged' : ''}`
      const { openFiles } = get()

      // Check if already open
      const existing = openFiles.find(f => f.path === diffPath)
      if (existing) {
        set({ activeFilePath: diffPath })
        return
      }

      set({ isLoading: true, error: null })

      try {
        const result = await window.api.git.getFileDiff({
          projectPath,
          filePath,
          staged,
        })

        if ('error' in result) {
          set({ error: (result as { error: string }).error, isLoading: false })
          return
        }

        const fileName = filePath.split(/[/\\]/).pop() || 'untitled'
        const newFile: OpenFile = {
          path: diffPath,
          name: `${fileName} (Diff)`,
          content: result.modified,
          originalContent: result.original,
          language: result.language,
          size: result.modified.length + result.original.length,
          isTruncated: false,
          isDirty: false,
          isDiff: true,
          diffOriginal: result.original,
          diffModified: result.modified,
          diffStaged: staged,
        }

        set(state => ({
          openFiles: [...state.openFiles, newFile],
          activeFilePath: diffPath,
          isLoading: false,
        }))
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to load diff',
          isLoading: false,
        })
      }
    },

    closeFile: (filePath: string) => {
      set(state => {
        const newFiles = state.openFiles.filter(f => f.path !== filePath)
        let newActivePath = state.activeFilePath

        if (state.activeFilePath === filePath) {
          newActivePath =
            newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null
        }

        return {
          openFiles: newFiles,
          activeFilePath: newActivePath,
        }
      })
    },

    setActiveFile: (filePath: string) => {
      set({ activeFilePath: filePath })
    },

    closeAllFiles: () => {
      set({ openFiles: [], activeFilePath: null })
    },

    updateFileContent: (filePath: string, content: string) => {
      set(state => ({
        openFiles: state.openFiles.map(f =>
          f.path === filePath
            ? { ...f, content, isDirty: content !== f.originalContent }
            : f
        ),
      }))
    },

    saveFile: async (filePath: string) => {
      const { openFiles } = get()
      const file = openFiles.find(f => f.path === filePath)
      if (!file || !file.isDirty) return true

      set({ isSaving: true, error: null })

      try {
        const result = await window.api.files.write({
          path: filePath,
          content: file.content,
        })

        if ('error' in result) {
          set({ error: result.error as string, isSaving: false })
          return false
        }

        set(state => ({
          openFiles: state.openFiles.map(f =>
            f.path === filePath
              ? {
                  ...f,
                  originalContent: f.content,
                  isDirty: false,
                  size: result.size,
                }
              : f
          ),
          isSaving: false,
        }))
        return true
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to save file',
          isSaving: false,
        })
        return false
      }
    },

    saveActiveFile: async () => {
      const { activeFilePath, saveFile } = get()
      if (!activeFilePath) return false
      return saveFile(activeFilePath)
    },

    revertFile: (filePath: string) => {
      set(state => ({
        openFiles: state.openFiles.map(f =>
          f.path === filePath
            ? { ...f, content: f.originalContent, isDirty: false }
            : f
        ),
      }))
    },

    getActiveFile: () => {
      const { openFiles, activeFilePath } = get()
      return openFiles.find(f => f.path === activeFilePath)
    },
  })
)
