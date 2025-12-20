/**
 * File Copy Service
 *
 * Handles copying files from working directory to target directory
 * during the task review workflow. Supports conflict detection and resolution.
 *
 * @module file-copy-service
 */

import {
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  statSync,
  renameSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import type { FileChangeSummary } from 'shared/ai-types'

/**
 * Result of a file copy operation
 */
export interface CopyResult {
  success: boolean
  copiedFiles: string[]
  skippedFiles: string[]
  errors: CopyError[]
}

/**
 * Error during file copy
 */
export interface CopyError {
  filePath: string
  error: string
}

/**
 * File conflict information
 */
export interface FileConflict {
  filePath: string
  reason: 'modified' | 'deleted' | 'permission'
  sourceModified: Date
  targetModified?: Date
}

/**
 * Resolution options for file conflicts
 */
export type ConflictResolution = 'overwrite' | 'skip' | 'backup'

/**
 * Interface for the File Copy Service
 */
export interface IFileCopyService {
  /**
   * Copy changed files from source to target directory
   */
  copyChanges(
    sourceDir: string,
    targetDir: string,
    fileChanges: FileChangeSummary
  ): Promise<CopyResult>

  /**
   * Detect conflicts between source and target directories
   */
  detectConflicts(
    sourceDir: string,
    targetDir: string,
    fileChanges: FileChangeSummary
  ): Promise<FileConflict[]>

  /**
   * Resolve a file conflict with the specified resolution
   */
  resolveConflict(
    sourceDir: string,
    targetDir: string,
    conflict: FileConflict,
    resolution: ConflictResolution
  ): Promise<void>
}

/**
 * File Copy Service Implementation
 */
export class FileCopyService implements IFileCopyService {
  /**
   * Copy changed files from source to target directory
   * Preserves file permissions and directory structure
   */
  async copyChanges(
    sourceDir: string,
    targetDir: string,
    fileChanges: FileChangeSummary
  ): Promise<CopyResult> {
    const result: CopyResult = {
      success: true,
      copiedFiles: [],
      skippedFiles: [],
      errors: [],
    }

    // Process created files
    for (const filePath of fileChanges.created) {
      const copyResult = this.copyFile(sourceDir, targetDir, filePath)
      if (copyResult.success) {
        result.copiedFiles.push(filePath)
      } else {
        result.errors.push({ filePath, error: copyResult.error! })
        result.success = false
      }
    }

    // Process modified files
    for (const filePath of fileChanges.modified) {
      const copyResult = this.copyFile(sourceDir, targetDir, filePath)
      if (copyResult.success) {
        result.copiedFiles.push(filePath)
      } else {
        result.errors.push({ filePath, error: copyResult.error! })
        result.success = false
      }
    }

    // Process deleted files
    for (const filePath of fileChanges.deleted) {
      const deleteResult = this.deleteFile(targetDir, filePath)
      if (!deleteResult.success) {
        result.errors.push({ filePath, error: deleteResult.error! })
        // Don't mark as failure for delete errors - file might already be gone
      }
    }

    return result
  }

  /**
   * Detect conflicts between source and target directories
   */
  async detectConflicts(
    sourceDir: string,
    targetDir: string,
    fileChanges: FileChangeSummary
  ): Promise<FileConflict[]> {
    const conflicts: FileConflict[] = []

    // Check modified files for conflicts
    for (const filePath of fileChanges.modified) {
      const sourcePath = join(sourceDir, filePath)
      const targetPath = join(targetDir, filePath)

      if (!existsSync(sourcePath)) {
        continue
      }

      if (!existsSync(targetPath)) {
        // Target was deleted - this is a conflict
        conflicts.push({
          filePath,
          reason: 'deleted',
          sourceModified: this.getModifiedTime(sourcePath),
        })
        continue
      }

      // Check if target was modified after source was created
      const sourceStats = statSync(sourcePath)
      const targetStats = statSync(targetPath)

      // If target was modified more recently than source, it's a conflict
      if (targetStats.mtime > sourceStats.mtime) {
        conflicts.push({
          filePath,
          reason: 'modified',
          sourceModified: sourceStats.mtime,
          targetModified: targetStats.mtime,
        })
      }
    }

    // Check created files for conflicts (file already exists in target)
    for (const filePath of fileChanges.created) {
      const sourcePath = join(sourceDir, filePath)
      const targetPath = join(targetDir, filePath)

      if (existsSync(targetPath)) {
        const sourceStats = statSync(sourcePath)
        const targetStats = statSync(targetPath)

        conflicts.push({
          filePath,
          reason: 'modified',
          sourceModified: sourceStats.mtime,
          targetModified: targetStats.mtime,
        })
      }
    }

    return conflicts
  }

  /**
   * Resolve a file conflict with the specified resolution
   */
  async resolveConflict(
    sourceDir: string,
    targetDir: string,
    conflict: FileConflict,
    resolution: ConflictResolution
  ): Promise<void> {
    const targetPath = join(targetDir, conflict.filePath)

    switch (resolution) {
      case 'overwrite':
        // Simply copy the source file over the target
        this.copyFile(sourceDir, targetDir, conflict.filePath)
        break

      case 'skip':
        // Do nothing - keep the target file as is
        break

      case 'backup':
        // Create a backup of the target file, then copy source
        if (existsSync(targetPath)) {
          const backupPath = this.generateBackupPath(targetPath)
          renameSync(targetPath, backupPath)
        }
        this.copyFile(sourceDir, targetDir, conflict.filePath)
        break
    }
  }

  /**
   * Copy a single file from source to target directory
   * Preserves file permissions and creates parent directories
   */
  private copyFile(
    sourceDir: string,
    targetDir: string,
    filePath: string
  ): { success: boolean; error?: string } {
    const sourcePath = join(sourceDir, filePath)
    const targetPath = join(targetDir, filePath)

    try {
      // Check if source file exists
      if (!existsSync(sourcePath)) {
        return { success: false, error: `Source file not found: ${sourcePath}` }
      }

      // Ensure parent directory exists
      const parentDir = dirname(targetPath)
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true })
      }

      // Copy file preserving mode (permissions)
      cpSync(sourcePath, targetPath, { preserveTimestamps: true })

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  }

  /**
   * Delete a file from the target directory
   */
  private deleteFile(
    targetDir: string,
    filePath: string
  ): { success: boolean; error?: string } {
    const targetPath = join(targetDir, filePath)

    try {
      if (existsSync(targetPath)) {
        rmSync(targetPath)
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  }

  /**
   * Get the modified time of a file
   */
  private getModifiedTime(filePath: string): Date {
    try {
      return statSync(filePath).mtime
    } catch {
      return new Date(0)
    }
  }

  /**
   * Generate a backup path for a file
   */
  private generateBackupPath(filePath: string): string {
    const timestamp = Date.now()
    return `${filePath}.backup-${timestamp}`
  }
}
