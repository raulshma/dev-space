/**
 * Error Detection Utility
 *
 * Detects non-zero exit codes and error patterns in terminal output.
 * Requirements: 7.1, 7.4
 */

import type { ErrorContext } from 'shared/models'

export interface DetectedError {
  id: string
  terminalId: string
  command: string
  exitCode: number
  errorOutput: string
  timestamp: Date
  lineNumber: number
}

/**
 * Parse command from terminal output
 * Looks for the last command before the error
 */
export function parseCommand(output: string): string {
  const lines = output.split('\n')

  // Look for common shell prompts and extract command
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()

    // Skip empty lines and error messages
    if (!line || line.startsWith('Error:') || line.startsWith('error:')) {
      continue
    }

    // Look for prompt patterns ($ or > at start)
    const promptMatch = line.match(/^[$>]\s*(.+)/)
    if (promptMatch) {
      return promptMatch[1].trim()
    }

    // If no prompt, return the first non-empty line
    if (line.length > 0 && !line.includes('exited with code')) {
      return line
    }
  }

  return 'unknown command'
}

/**
 * Extract error output from terminal buffer
 * Gets the last N lines before the exit code message
 */
export function extractErrorOutput(
  terminalBuffer: string,
  maxLines: number = 20
): string {
  const lines = terminalBuffer.split('\n')
  const errorLines: string[] = []

  // Find the exit code line
  let exitLineIndex = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (
      lines[i].includes('exited with code') ||
      lines[i].includes('Process exited')
    ) {
      exitLineIndex = i
      break
    }
  }

  // If no exit line found, take last N lines
  if (exitLineIndex === -1) {
    exitLineIndex = lines.length
  }

  // Extract lines before exit
  const startIndex = Math.max(0, exitLineIndex - maxLines)
  for (let i = startIndex; i < exitLineIndex; i++) {
    const line = lines[i].trim()
    if (line.length > 0) {
      errorLines.push(lines[i])
    }
  }

  return errorLines.join('\n')
}

/**
 * Detect relevant files from error output
 * Looks for file paths in error messages
 */
export function detectRelevantFiles(errorOutput: string): string[] {
  const files: Set<string> = new Set()

  // Common file path patterns in error messages
  const patterns = [
    // Unix paths with line numbers: /path/to/file.ts:10:5
    /(?:\/[\w.-]+)+\.\w+:\d+:\d+/g,
    // Unix paths: /path/to/file.ts
    /(?:\/[\w.-]+)+\.\w+/g,
    // Relative paths: ./path/to/file.ts
    /\.\/(?:[\w.-]+\/)*[\w.-]+\.\w+/g,
    // Windows paths: C:\path\to\file.ts
    /[a-zA-Z]:\\(?:[\w.-]+\\)*[\w.-]+\.\w+/g,
  ]

  for (const pattern of patterns) {
    const matches = errorOutput.matchAll(pattern)
    for (const match of matches) {
      // Remove line/column numbers
      const filePath = match[0].replace(/:\d+:\d+$/, '').replace(/:\d+$/, '')
      files.add(filePath)
    }
  }

  return Array.from(files)
}

/**
 * Create error context from detected error
 */
export function createErrorContext(error: DetectedError): ErrorContext {
  const relevantFiles = detectRelevantFiles(error.errorOutput)

  return {
    terminalId: error.terminalId,
    errorOutput: error.errorOutput,
    command: error.command,
    exitCode: error.exitCode,
    relevantFiles,
  }
}

/**
 * Check if exit code indicates an error
 */
export function isErrorExitCode(exitCode: number): boolean {
  return exitCode !== 0
}
