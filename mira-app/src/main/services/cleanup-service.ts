/**
 * Cleanup Service
 *
 * Handles cleanup of working directories during the task review workflow.
 * Terminates running processes before deleting directories to ensure clean removal.
 *
 * Implements Requirements:
 * - 6.1: Delete working directory after changes are copied
 * - 6.2: Terminate any running processes in the working directory first
 * - 6.3: Log errors and notify user on cleanup failure
 * - 6.4: Allow cleanup without copying changes (discard changes)
 *
 * @module cleanup-service
 */

import { existsSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync, execSync } from 'node:child_process'

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  success: boolean
  deletedFiles: number
  terminatedProcesses: number
  error?: string
}

/**
 * Interface for the Cleanup Service
 */
export interface ICleanupService {
  /**
   * Clean up a working directory
   * Terminates processes first, then deletes the directory
   */
  cleanup(workingDirectory: string): Promise<CleanupResult>

  /**
   * Terminate all processes running in a working directory
   * @returns Number of processes terminated
   */
  terminateProcesses(workingDirectory: string): Promise<number>

  /**
   * Force cleanup a working directory
   * Attempts cleanup even if normal cleanup fails
   */
  forceCleanup(workingDirectory: string): Promise<CleanupResult>
}

/**
 * Cleanup Service Implementation
 */
export class CleanupService implements ICleanupService {
  /**
   * Clean up a working directory
   * Terminates processes first, then deletes the directory
   */
  async cleanup(workingDirectory: string): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: false,
      deletedFiles: 0,
      terminatedProcesses: 0,
    }

    // Check if directory exists
    if (!existsSync(workingDirectory)) {
      // Directory doesn't exist - consider this a success
      result.success = true
      return result
    }

    try {
      // First, terminate any running processes
      result.terminatedProcesses =
        await this.terminateProcesses(workingDirectory)

      // Count files before deletion
      result.deletedFiles = this.countFiles(workingDirectory)

      // Delete the directory
      rmSync(workingDirectory, { recursive: true, force: true })

      // Verify deletion
      if (!existsSync(workingDirectory)) {
        result.success = true
      } else {
        result.success = false
        result.error = 'Directory still exists after deletion attempt'
      }
    } catch (error) {
      result.success = false
      result.error = error instanceof Error ? error.message : String(error)
    }

    return result
  }

  /**
   * Terminate all processes running in a working directory
   * @returns Number of processes terminated
   */
  async terminateProcesses(workingDirectory: string): Promise<number> {
    if (!existsSync(workingDirectory)) {
      return 0
    }

    const pids = this.findProcessesInDirectory(workingDirectory)
    let terminatedCount = 0

    for (const pid of pids) {
      const killed = this.killProcess(pid)
      if (killed) {
        terminatedCount++
      }
    }

    // Give processes time to terminate
    if (terminatedCount > 0) {
      await this.delay(500)
    }

    return terminatedCount
  }

  /**
   * Force cleanup a working directory
   * Attempts cleanup even if normal cleanup fails
   */
  async forceCleanup(workingDirectory: string): Promise<CleanupResult> {
    // First try normal cleanup
    const result = await this.cleanup(workingDirectory)

    if (result.success) {
      return result
    }

    // If normal cleanup failed, try more aggressive approach
    try {
      // Wait a bit for any file handles to be released
      await this.delay(1000)

      // Try to terminate processes again
      const additionalTerminated =
        await this.terminateProcesses(workingDirectory)
      result.terminatedProcesses += additionalTerminated

      // Wait for processes to fully terminate
      await this.delay(500)

      // Try deletion again with force
      if (existsSync(workingDirectory)) {
        rmSync(workingDirectory, {
          recursive: true,
          force: true,
          maxRetries: 3,
        })
      }

      // Verify deletion
      if (!existsSync(workingDirectory)) {
        result.success = true
        result.error = undefined
      }
    } catch (error) {
      result.success = false
      result.error = error instanceof Error ? error.message : String(error)
    }

    return result
  }

  /**
   * Find all processes running in a directory
   * @returns Array of process IDs
   */
  private findProcessesInDirectory(directory: string): number[] {
    const pids: number[] = []

    try {
      if (process.platform === 'win32') {
        // On Windows, use WMIC to find processes with working directory
        const result = spawnSync(
          'wmic',
          [
            'process',
            'where',
            `ExecutablePath like '%${directory.replace(/\\/g, '\\\\')}%'`,
            'get',
            'ProcessId',
          ],
          { encoding: 'utf-8', timeout: 5000 }
        )

        if (result.stdout) {
          const lines = result.stdout.split('\n')
          for (const line of lines) {
            const pid = Number.parseInt(line.trim(), 10)
            if (!Number.isNaN(pid) && pid > 0) {
              pids.push(pid)
            }
          }
        }

        // Also try PowerShell for more comprehensive search
        const psResult = spawnSync(
          'powershell',
          [
            '-Command',
            `Get-Process | Where-Object { $_.Path -like '*${directory.replace(/\\/g, '\\\\')}*' } | Select-Object -ExpandProperty Id`,
          ],
          { encoding: 'utf-8', timeout: 5000 }
        )

        if (psResult.stdout) {
          const lines = psResult.stdout.split('\n')
          for (const line of lines) {
            const pid = Number.parseInt(line.trim(), 10)
            if (!Number.isNaN(pid) && pid > 0 && !pids.includes(pid)) {
              pids.push(pid)
            }
          }
        }
      } else {
        // On Unix-like systems, use lsof to find processes with files open in directory
        try {
          const result = execSync(
            `lsof +D "${directory}" 2>/dev/null || true`,
            {
              encoding: 'utf-8',
              timeout: 5000,
            }
          )

          if (result) {
            const lines = result.split('\n').slice(1) // Skip header
            for (const line of lines) {
              const parts = line.split(/\s+/)
              if (parts.length >= 2) {
                const pid = Number.parseInt(parts[1], 10)
                if (!Number.isNaN(pid) && pid > 0 && !pids.includes(pid)) {
                  pids.push(pid)
                }
              }
            }
          }
        } catch {
          // lsof might not be available or might fail - that's OK
        }

        // Also try fuser as a fallback
        try {
          const result = execSync(
            `fuser -c "${directory}" 2>/dev/null || true`,
            {
              encoding: 'utf-8',
              timeout: 5000,
            }
          )

          if (result) {
            const pidStrings = result.trim().split(/\s+/)
            for (const pidStr of pidStrings) {
              // fuser output might have suffixes like 'c' for current directory
              const pid = Number.parseInt(pidStr.replace(/[^0-9]/g, ''), 10)
              if (!Number.isNaN(pid) && pid > 0 && !pids.includes(pid)) {
                pids.push(pid)
              }
            }
          }
        } catch {
          // fuser might not be available - that's OK
        }
      }
    } catch {
      // If process detection fails, return empty array
      // Cleanup will still attempt to delete the directory
    }

    return pids
  }

  /**
   * Kill a process by PID
   * @returns true if process was killed, false if it was already dead
   */
  private killProcess(pid: number): boolean {
    try {
      if (process.platform === 'win32') {
        // On Windows, use taskkill with /T to kill process tree
        const result = spawnSync(
          'taskkill',
          ['/pid', pid.toString(), '/T', '/F'],
          { timeout: 5000 }
        )
        // Exit code 0 = success, 128 = process not found (already dead)
        return result.status === 0
      }
      // On Unix, try to kill process group first, then individual process
      try {
        process.kill(-pid, 'SIGKILL')
        return true
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException
        if (error.code === 'ESRCH') {
          // Process group not found, try individual process
          try {
            process.kill(pid, 'SIGKILL')
            return true
          } catch (innerErr: unknown) {
            const innerError = innerErr as NodeJS.ErrnoException
            if (innerError.code === 'ESRCH') {
              return false // Already dead
            }
            throw innerError
          }
        }
        throw error
      }
    } catch {
      return false
    }
  }

  /**
   * Count files in a directory recursively
   */
  private countFiles(directory: string): number {
    let count = 0

    try {
      const entries = readdirSync(directory, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(directory, entry.name)

        if (entry.isDirectory()) {
          count += this.countFiles(fullPath)
        } else {
          count++
        }
      }
    } catch {
      // If we can't read the directory, return 0
    }

    return count
  }

  /**
   * Delay execution for a specified number of milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
