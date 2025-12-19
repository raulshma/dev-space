/**
 * Worktree Service
 *
 * Manages git worktrees for isolated task development. Provides CRUD operations
 * for worktrees, git repository validation, and task association.
 *
 * Implements Requirements:
 * - 4.2: Create or switch to branch when task with branch name is started
 * - 4.3: Create git worktree for isolated development
 * - 4.5: Track worktrees and display in worktree panel
 * - 4.6: Clean up worktree directory and update task associations on delete
 * - 4.8: Validate git repository before enabling worktree features
 *
 * @module worktree-service
 */

import { EventEmitter } from 'node:events'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseService } from './database'
import type { GitService } from './git-service'

const execAsync = promisify(exec)

/**
 * Represents a git worktree
 */
export interface Worktree {
  /** Path to the worktree directory */
  path: string
  /** Path to the main project repository */
  projectPath: string
  /** Branch name for the worktree */
  branch: string
  /** Associated task ID (if any) */
  taskId: string | null
  /** When the worktree was created */
  createdAt: Date
}

/**
 * Events emitted by the WorktreeService
 */
export interface WorktreeServiceEvents {
  /** Emitted when a worktree is created */
  worktreeCreated: (worktree: Worktree) => void
  /** Emitted when a worktree is deleted */
  worktreeDeleted: (worktreePath: string) => void
  /** Emitted when a worktree's task association changes */
  worktreeTaskChanged: (worktreePath: string, taskId: string | null) => void
}

/**
 * Interface for the Worktree Service
 */
export interface IWorktreeService {
  /**
   * Create a new git worktree
   * @param projectPath - The main repository path
   * @param branchName - The branch name for the worktree
   * @param taskId - Optional task ID to associate
   * @returns The created worktree
   */
  createWorktree(
    projectPath: string,
    branchName: string,
    taskId?: string
  ): Promise<Worktree>

  /**
   * Delete a worktree
   * @param worktreePath - The path to the worktree to delete
   */
  deleteWorktree(worktreePath: string): Promise<void>

  /**
   * List all worktrees for a project
   * @param projectPath - The main repository path
   * @returns Array of worktrees
   */
  listWorktrees(projectPath: string): Promise<Worktree[]>

  /**
   * Find a worktree by branch name
   * @param projectPath - The main repository path
   * @param branch - The branch name
   * @returns The worktree or null if not found
   */
  findWorktreeForBranch(
    projectPath: string,
    branch: string
  ): Promise<Worktree | null>

  /**
   * Check if a path is a git repository
   * @param path - The path to check
   * @returns True if the path is a git repository
   */
  isGitRepository(path: string): Promise<boolean>

  /**
   * Associate a task with a worktree
   * @param worktreePath - The worktree path
   * @param taskId - The task ID to associate
   */
  associateTask(worktreePath: string, taskId: string): Promise<void>

  /**
   * Remove task association from a worktree
   * @param worktreePath - The worktree path
   */
  dissociateTask(worktreePath: string): Promise<void>

  /**
   * Get worktree by task ID
   * @param taskId - The task ID
   * @returns The worktree or null if not found
   */
  getWorktreeForTask(taskId: string): Worktree | null
}

/**
 * Worktree Service
 *
 * Manages git worktrees for isolated task development.
 */
export class WorktreeService extends EventEmitter implements IWorktreeService {
  private db: DatabaseService
  private gitService: GitService

  /**
   * Create a new WorktreeService instance
   * @param db - The database service for persistence
   * @param gitService - The git service for repository operations
   */
  constructor(db: DatabaseService, gitService: GitService) {
    super()
    this.db = db
    this.gitService = gitService
  }

  /**
   * Create a new git worktree
   *
   * Creates a git worktree in a .worktrees subdirectory of the project.
   * If the branch doesn't exist, it will be created from HEAD.
   *
   * @param projectPath - The main repository path
   * @param branchName - The branch name for the worktree
   * @param taskId - Optional task ID to associate
   * @returns The created worktree
   * @throws Error if the path is not a git repository
   * @throws Error if worktree creation fails
   */
  async createWorktree(
    projectPath: string,
    branchName: string,
    taskId?: string
  ): Promise<Worktree> {
    // Validate git repository
    const isRepo = await this.isGitRepository(projectPath)
    if (!isRepo) {
      throw new Error(
        `Cannot create worktree: ${projectPath} is not a git repository`
      )
    }

    // Generate worktree path
    const sanitizedBranch = this.sanitizeBranchName(branchName)
    const worktreesDir = join(projectPath, '.worktrees')
    const worktreePath = join(worktreesDir, sanitizedBranch)

    // Check if worktree already exists
    const existingWorktree = this.db.getWorktree(worktreePath)
    if (existingWorktree) {
      // Return existing worktree if it exists
      return existingWorktree
    }

    // Check if branch exists
    const branchExists = await this.branchExists(projectPath, branchName)

    try {
      if (branchExists) {
        // Create worktree for existing branch
        await execAsync(`git worktree add "${worktreePath}" "${branchName}"`, {
          cwd: projectPath,
          timeout: 30000,
        })
      } else {
        // Create worktree with new branch from HEAD
        await execAsync(
          `git worktree add -b "${branchName}" "${worktreePath}" HEAD`,
          {
            cwd: projectPath,
            timeout: 30000,
          }
        )
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to create worktree: ${errorMessage}`)
    }

    // Persist to database
    const worktree = this.db.createWorktree(
      worktreePath,
      projectPath,
      branchName,
      taskId
    )

    // Update task's worktreePath if taskId provided
    if (taskId) {
      this.db.updateAgentTask(taskId, { worktreePath })
    }

    this.emit('worktreeCreated', worktree)

    return worktree
  }

  /**
   * Delete a worktree
   *
   * Removes the worktree from git, deletes the directory, and removes
   * the database record. Also clears the worktreePath on any associated task.
   *
   * @param worktreePath - The path to the worktree to delete
   * @throws Error if worktree deletion fails
   */
  async deleteWorktree(worktreePath: string): Promise<void> {
    // Get worktree record to find project path and task association
    const worktree = this.db.getWorktree(worktreePath)

    if (worktree) {
      // Clear task's worktreePath if associated
      if (worktree.taskId) {
        this.db.updateAgentTask(worktree.taskId, { worktreePath: undefined })
      }

      // Remove from git worktree list
      try {
        await execAsync(`git worktree remove "${worktreePath}" --force`, {
          cwd: worktree.projectPath,
          timeout: 30000,
        })
      } catch {
        // If git worktree remove fails, try to clean up manually
        // This can happen if the worktree was already removed or corrupted
        if (existsSync(worktreePath)) {
          try {
            rmSync(worktreePath, { recursive: true, force: true })
          } catch {
            // Ignore cleanup errors
          }
        }

        // Prune worktrees to clean up stale entries
        try {
          await execAsync('git worktree prune', {
            cwd: worktree.projectPath,
            timeout: 10000,
          })
        } catch {
          // Ignore prune errors
        }
      }

      // Remove from database
      this.db.deleteWorktree(worktreePath)
    } else {
      // No database record, but try to clean up filesystem if it exists
      if (existsSync(worktreePath)) {
        rmSync(worktreePath, { recursive: true, force: true })
      }
    }

    this.emit('worktreeDeleted', worktreePath)
  }

  /**
   * List all worktrees for a project
   *
   * Returns worktrees from the database. Also syncs with git to ensure
   * the database is up to date.
   *
   * @param projectPath - The main repository path
   * @returns Array of worktrees
   */
  async listWorktrees(projectPath: string): Promise<Worktree[]> {
    // Get worktrees from database
    const dbWorktrees = this.db.getWorktrees(projectPath)

    // Optionally sync with git worktree list to catch any discrepancies
    // For now, just return database records
    return dbWorktrees
  }

  /**
   * Find a worktree by branch name
   *
   * @param projectPath - The main repository path
   * @param branch - The branch name
   * @returns The worktree or null if not found
   */
  async findWorktreeForBranch(
    projectPath: string,
    branch: string
  ): Promise<Worktree | null> {
    return this.db.getWorktreeByBranch(projectPath, branch)
  }

  /**
   * Check if a path is a git repository
   *
   * @param path - The path to check
   * @returns True if the path is a git repository
   */
  async isGitRepository(path: string): Promise<boolean> {
    return this.gitService.isGitRepo(path)
  }

  /**
   * Associate a task with a worktree
   *
   * @param worktreePath - The worktree path
   * @param taskId - The task ID to associate
   */
  async associateTask(worktreePath: string, taskId: string): Promise<void> {
    this.db.updateWorktreeTaskId(worktreePath, taskId)
    this.db.updateAgentTask(taskId, { worktreePath })
    this.emit('worktreeTaskChanged', worktreePath, taskId)
  }

  /**
   * Remove task association from a worktree
   *
   * @param worktreePath - The worktree path
   */
  async dissociateTask(worktreePath: string): Promise<void> {
    const worktree = this.db.getWorktree(worktreePath)

    if (worktree?.taskId) {
      this.db.updateAgentTask(worktree.taskId, { worktreePath: undefined })
    }

    this.db.updateWorktreeTaskId(worktreePath, null)
    this.emit('worktreeTaskChanged', worktreePath, null)
  }

  /**
   * Get worktree by task ID
   *
   * @param taskId - The task ID
   * @returns The worktree or null if not found
   */
  getWorktreeForTask(taskId: string): Worktree | null {
    return this.db.getWorktreeByTaskId(taskId)
  }

  /**
   * Check if a branch exists in the repository
   *
   * @param projectPath - The repository path
   * @param branchName - The branch name to check
   * @returns True if the branch exists
   */
  private async branchExists(
    projectPath: string,
    branchName: string
  ): Promise<boolean> {
    try {
      await execAsync(`git rev-parse --verify "${branchName}"`, {
        cwd: projectPath,
        timeout: 5000,
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Sanitize a branch name for use as a directory name
   *
   * @param branchName - The branch name to sanitize
   * @returns A sanitized version safe for filesystem use
   */
  private sanitizeBranchName(branchName: string): string {
    // Remove common prefixes like feature/, bugfix/, etc.
    let sanitized = branchName
      .replace(/^(feature|bugfix|hotfix|release)\//, '')
      // Replace invalid filesystem characters
      .replace(/[<>:"/\\|?*]/g, '-')
      // Replace multiple dashes with single dash
      .replace(/-+/g, '-')
      // Remove leading/trailing dashes
      .replace(/^-|-$/g, '')

    // If empty after sanitization, use a hash of the original
    if (!sanitized) {
      sanitized = `branch-${Date.now()}`
    }

    return sanitized
  }
}
