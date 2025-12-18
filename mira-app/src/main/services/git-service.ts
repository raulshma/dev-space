import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { GitTelemetry, GitFileStatus } from 'shared/models'

const execAsync = promisify(exec)

export class GitService {
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map()
  private telemetryCache: Map<string, GitTelemetry> = new Map()

  /**
   * Check if a directory is a git repository
   */
  async isGitRepo(path: string): Promise<boolean> {
    try {
      const gitDir = join(path, '.git')
      if (!existsSync(gitDir)) {
        return false
      }

      const { stdout } = await execAsync(
        'git rev-parse --is-inside-work-tree',
        {
          cwd: path,
          timeout: 5000,
        }
      )
      return stdout.trim() === 'true'
    } catch {
      return false
    }
  }

  /**
   * Get git telemetry for a project path
   */
  async getTelemetry(projectPath: string): Promise<GitTelemetry> {
    const isRepo = await this.isGitRepo(projectPath)

    if (!isRepo) {
      return {
        isGitRepo: false,
        branch: '',
        ahead: 0,
        behind: 0,
        modified: 0,
        staged: 0,
        untracked: 0,
        files: [],
      }
    }

    try {
      // Get current branch
      const branchResult = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
        timeout: 5000,
      })
      const branch = branchResult.stdout.trim()

      // Get ahead/behind counts
      let ahead = 0
      let behind = 0
      try {
        const revListResult = await execAsync(
          `git rev-list --left-right --count HEAD...@{upstream}`,
          {
            cwd: projectPath,
            timeout: 5000,
          }
        )
        const [aheadStr, behindStr] = revListResult.stdout.trim().split(/\s+/)
        ahead = parseInt(aheadStr, 10) || 0
        behind = parseInt(behindStr, 10) || 0
      } catch {
        // No upstream configured or other error - leave as 0
      }

      // Get status counts and file list
      const statusResult = await execAsync('git status --porcelain', {
        cwd: projectPath,
        timeout: 5000,
      })

      const statusLines = statusResult.stdout
        .split('\n')
        .filter(line => line.trim())
      let modified = 0
      let staged = 0
      let untracked = 0
      const files: GitFileStatus[] = []

      for (const line of statusLines) {
        const status = line.substring(0, 2)
        const filePath = line.substring(3).trim()
        const x = status[0]
        const y = status[1]

        // X shows the status of the index (staged)
        if (x !== ' ' && x !== '?') {
          staged++
        }

        // Y shows the status of the work tree
        if (y === 'M' || y === 'D') {
          modified++
        }

        // ?? means untracked
        if (status === '??') {
          untracked++
        }

        // Build file status
        let fileStatus: GitFileStatus['status'] = 'modified'
        let isStaged = false

        if (status === '??') {
          fileStatus = 'untracked'
        } else if (x === 'A') {
          fileStatus = 'added'
          isStaged = true
        } else if (x === 'D' || y === 'D') {
          fileStatus = 'deleted'
          isStaged = x === 'D'
        } else if (x === 'R') {
          fileStatus = 'renamed'
          isStaged = true
        } else if (x === 'M') {
          fileStatus = 'staged'
          isStaged = true
        } else if (y === 'M') {
          fileStatus = 'modified'
        }

        files.push({
          path: filePath,
          status: fileStatus,
          staged: isStaged,
        })
      }

      const telemetry: GitTelemetry = {
        isGitRepo: true,
        branch,
        ahead,
        behind,
        modified,
        staged,
        untracked,
        files,
      }

      // Cache the result
      this.telemetryCache.set(projectPath, telemetry)

      return telemetry
    } catch (error) {
      console.error('Error getting git telemetry:', error)
      return {
        isGitRepo: true,
        branch: 'unknown',
        ahead: 0,
        behind: 0,
        modified: 0,
        staged: 0,
        untracked: 0,
        files: [],
      }
    }
  }

  /**
   * Start background refresh for a project
   */
  startBackgroundRefresh(
    projectId: string,
    projectPath: string,
    interval: number,
    onUpdate?: (telemetry: GitTelemetry) => void
  ): void {
    // Stop any existing refresh for this project
    this.stopBackgroundRefresh(projectId)

    // Create new interval
    const intervalId = setInterval(async () => {
      try {
        const telemetry = await this.getTelemetry(projectPath)
        if (onUpdate) {
          onUpdate(telemetry)
        }
      } catch (error) {
        console.error(
          `Error refreshing git telemetry for project ${projectId}:`,
          error
        )
      }
    }, interval)

    this.refreshIntervals.set(projectId, intervalId)

    // Do an immediate fetch
    this.getTelemetry(projectPath)
      .then(telemetry => {
        if (onUpdate) {
          onUpdate(telemetry)
        }
      })
      .catch(error => {
        console.error(
          `Error in initial git telemetry fetch for project ${projectId}:`,
          error
        )
      })
  }

  /**
   * Stop background refresh for a project
   */
  stopBackgroundRefresh(projectId: string): void {
    const intervalId = this.refreshIntervals.get(projectId)
    if (intervalId) {
      clearInterval(intervalId)
      this.refreshIntervals.delete(projectId)
    }
  }

  /**
   * Stop all background refreshes
   */
  stopAllRefreshes(): void {
    for (const intervalId of this.refreshIntervals.values()) {
      clearInterval(intervalId)
    }
    this.refreshIntervals.clear()
  }

  /**
   * Get cached telemetry if available
   */
  getCachedTelemetry(projectPath: string): GitTelemetry | null {
    return this.telemetryCache.get(projectPath) || null
  }

  /**
   * Clear telemetry cache
   */
  clearCache(): void {
    this.telemetryCache.clear()
  }
}
