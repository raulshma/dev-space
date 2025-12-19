/**
 * Working Directory Service
 *
 * Manages working directories for agent task execution.
 * Copies projects to isolated working directories and syncs changes back.
 *
 * Key features:
 * - Copy project to working directory before agent runs
 * - Preserve git history and state
 * - Sync changes back to original project after completion
 * - Clean up working directories
 *
 * @module working-directory-service
 */

import {
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { join, basename } from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'

const execAsync = promisify(exec)

/**
 * Progress callback for copy operations
 */
export type CopyProgressCallback = (message: string) => void

/**
 * Result of a copy operation
 */
export interface CopyResult {
  workingDirectory: string
  filesCopied: number
  totalSize: number
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  filesCreated: string[]
  filesModified: string[]
  filesDeleted: string[]
}

/**
 * Interface for the Working Directory Service
 */
export interface IWorkingDirectoryService {
  /**
   * Copy a project to a new working directory
   * @param sourceDir - Original project directory
   * @param taskId - Task ID for naming the working directory
   * @param onProgress - Optional progress callback
   * @returns Copy result with working directory path
   */
  copyToWorkingDirectory(
    sourceDir: string,
    taskId: string,
    onProgress?: CopyProgressCallback
  ): Promise<CopyResult>

  /**
   * Sync changes from working directory back to original project
   * @param workingDir - Working directory with changes
   * @param targetDir - Original project directory
   * @param onProgress - Optional progress callback
   * @returns Sync result with changed files
   */
  syncChangesBack(
    workingDir: string,
    targetDir: string,
    onProgress?: CopyProgressCallback
  ): Promise<SyncResult>

  /**
   * Clean up a working directory
   * @param workingDir - Working directory to remove
   */
  cleanup(workingDir: string): Promise<void>

  /**
   * Get the base path for working directories
   */
  getWorkingDirectoriesBasePath(): string

  /**
   * List all working directories
   */
  listWorkingDirectories(): string[]
}

/**
 * Patterns to exclude when copying (node_modules, build artifacts, etc.)
 */
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git/objects',
  '.git/lfs',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'venv',
  '.venv',
  'env',
  '.env.local',
  '*.log',
  '.DS_Store',
  'Thumbs.db',
]

/**
 * Check if a path should be excluded from copy
 */
function shouldExclude(relativePath: string): boolean {
  const parts = relativePath.split(/[/\\]/)
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.startsWith('*')) {
      // Wildcard pattern
      const ext = pattern.slice(1)
      if (relativePath.endsWith(ext)) return true
    } else {
      // Exact match or directory
      if (parts.includes(pattern)) return true
    }
  }
  return false
}

/**
 * Recursively count files and size in a directory
 */
function countFilesAndSize(
  dir: string,
  relativePath = ''
): { count: number; size: number } {
  let count = 0
  let size = 0

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const entryRelativePath = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name

      if (shouldExclude(entryRelativePath)) continue

      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        const sub = countFilesAndSize(fullPath, entryRelativePath)
        count += sub.count
        size += sub.size
      } else if (entry.isFile()) {
        count++
        try {
          size += statSync(fullPath).size
        } catch {
          // Ignore stat errors
        }
      }
    }
  } catch {
    // Ignore read errors
  }

  return { count, size }
}

/**
 * Recursively copy directory with exclusions
 */
function copyDirectoryWithExclusions(
  src: string,
  dest: string,
  relativePath = '',
  onProgress?: CopyProgressCallback
): number {
  let filesCopied = 0

  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true })
  }

  const entries = readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const entryRelativePath = relativePath
      ? `${relativePath}/${entry.name}`
      : entry.name

    if (shouldExclude(entryRelativePath)) {
      onProgress?.(`Skipping: ${entryRelativePath}`)
      continue
    }

    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      filesCopied += copyDirectoryWithExclusions(
        srcPath,
        destPath,
        entryRelativePath,
        onProgress
      )
    } else if (entry.isFile()) {
      try {
        cpSync(srcPath, destPath)
        filesCopied++
        if (filesCopied % 100 === 0) {
          onProgress?.(`Copied ${filesCopied} files...`)
        }
      } catch (error) {
        onProgress?.(`Warning: Could not copy ${entryRelativePath}: ${error}`)
      }
    }
  }

  return filesCopied
}

/**
 * Working Directory Service Implementation
 */
export class WorkingDirectoryService implements IWorkingDirectoryService {
  private basePath: string

  constructor() {
    // Use app's userData directory for working directories
    this.basePath = join(app.getPath('userData'), 'agent-workspaces')

    // Ensure base directory exists
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true })
    }
  }

  getWorkingDirectoriesBasePath(): string {
    return this.basePath
  }

  listWorkingDirectories(): string[] {
    try {
      return readdirSync(this.basePath, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => join(this.basePath, entry.name))
    } catch {
      return []
    }
  }

  async copyToWorkingDirectory(
    sourceDir: string,
    taskId: string,
    onProgress?: CopyProgressCallback
  ): Promise<CopyResult> {
    // Create unique working directory name
    const projectName = basename(sourceDir)
    const shortId = taskId.slice(0, 8)
    const timestamp = Date.now()
    const workingDirName = `${projectName}-${shortId}-${timestamp}`
    const workingDirectory = join(this.basePath, workingDirName)

    onProgress?.(`Creating working directory: ${workingDirName}`)

    // Count files first for progress reporting
    onProgress?.('Analyzing project structure...')
    const { count: totalFiles, size: totalSize } = countFilesAndSize(sourceDir)
    onProgress?.(`Found ${totalFiles} files (${this.formatSize(totalSize)})`)

    // Create working directory
    mkdirSync(workingDirectory, { recursive: true })

    // Copy files with exclusions
    onProgress?.('Copying project files...')
    const filesCopied = copyDirectoryWithExclusions(
      sourceDir,
      workingDirectory,
      '',
      onProgress
    )

    onProgress?.(`Copied ${filesCopied} files to working directory`)

    // If it's a git repo, ensure git is properly set up
    const gitDir = join(sourceDir, '.git')
    if (existsSync(gitDir)) {
      onProgress?.('Setting up git in working directory...')
      try {
        // Copy .git directory (excluding large objects if needed)
        const workingGitDir = join(workingDirectory, '.git')
        if (!existsSync(workingGitDir)) {
          cpSync(gitDir, workingGitDir, { recursive: true })
        }

        // Reset any staged changes in working copy
        await execAsync('git reset --mixed HEAD', { cwd: workingDirectory })
        onProgress?.('Git repository initialized in working directory')
      } catch (error) {
        onProgress?.(`Warning: Git setup issue: ${error}`)
      }
    }

    return {
      workingDirectory,
      filesCopied,
      totalSize,
    }
  }

  async syncChangesBack(
    workingDir: string,
    targetDir: string,
    onProgress?: CopyProgressCallback
  ): Promise<SyncResult> {
    const result: SyncResult = {
      filesCreated: [],
      filesModified: [],
      filesDeleted: [],
    }

    onProgress?.('Analyzing changes in working directory...')

    // Use git to detect changes if available
    const workingGitDir = join(workingDir, '.git')
    if (existsSync(workingGitDir)) {
      try {
        // Get list of changed files from git
        const { stdout } = await execAsync('git status --porcelain', {
          cwd: workingDir,
        })
        const lines = stdout.split('\n').filter(line => line.trim())

        for (const line of lines) {
          const status = line.substring(0, 2)
          let filePath = line.substring(3).trim()

          // Handle renamed files
          if (filePath.includes(' -> ')) {
            const [oldPath, newPath] = filePath.split(' -> ')
            result.filesDeleted.push(oldPath)
            filePath = newPath
          }

          if (status.includes('A') || status === '??') {
            result.filesCreated.push(filePath)
          } else if (status.includes('M')) {
            result.filesModified.push(filePath)
          } else if (status.includes('D')) {
            result.filesDeleted.push(filePath)
          }
        }

        onProgress?.(
          `Found ${result.filesCreated.length} new, ${result.filesModified.length} modified, ${result.filesDeleted.length} deleted files`
        )

        // Copy changed files back to target
        const allChangedFiles = [
          ...result.filesCreated,
          ...result.filesModified,
        ]
        for (const file of allChangedFiles) {
          const srcPath = join(workingDir, file)
          const destPath = join(targetDir, file)

          if (existsSync(srcPath)) {
            // Ensure parent directory exists
            const parentDir = join(destPath, '..')
            if (!existsSync(parentDir)) {
              mkdirSync(parentDir, { recursive: true })
            }
            cpSync(srcPath, destPath)
            onProgress?.(`Synced: ${file}`)
          }
        }

        // Handle deleted files
        for (const file of result.filesDeleted) {
          const destPath = join(targetDir, file)
          if (existsSync(destPath)) {
            rmSync(destPath)
            onProgress?.(`Deleted: ${file}`)
          }
        }

        onProgress?.('Changes synced back to original project')
      } catch (error) {
        onProgress?.(
          `Warning: Git-based sync failed, falling back to full copy: ${error}`
        )
        // Fallback: copy everything back
        copyDirectoryWithExclusions(workingDir, targetDir, '', onProgress)
      }
    } else {
      // No git, copy everything back
      onProgress?.('No git repository, copying all files back...')
      copyDirectoryWithExclusions(workingDir, targetDir, '', onProgress)
    }

    return result
  }

  async cleanup(workingDir: string): Promise<void> {
    if (existsSync(workingDir) && workingDir.startsWith(this.basePath)) {
      rmSync(workingDir, { recursive: true, force: true })
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }
}
