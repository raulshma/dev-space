/**
 * Unidiff Parser Utility
 *
 * Parses unified diff format (unidiff) patches to extract file changes
 * and provide structured data for display.
 */

export interface DiffFile {
  /** Original file path (before changes) */
  oldPath: string
  /** New file path (after changes) */
  newPath: string
  /** Type of change */
  type: 'added' | 'deleted' | 'modified' | 'renamed'
  /** Number of lines added */
  additions: number
  /** Number of lines deleted */
  deletions: number
  /** Individual hunks/chunks of changes */
  hunks: DiffHunk[]
}

export interface DiffHunk {
  /** Starting line in old file */
  oldStart: number
  /** Number of lines in old file */
  oldLines: number
  /** Starting line in new file */
  newStart: number
  /** Number of lines in new file */
  newLines: number
  /** Header line (e.g., @@ -1,5 +1,6 @@) */
  header: string
  /** Lines in this hunk */
  lines: DiffLine[]
}

export interface DiffLine {
  /** Type of line change */
  type: 'context' | 'addition' | 'deletion' | 'header'
  /** Line content (without the prefix +/-/space) */
  content: string
  /** Original line with prefix */
  raw: string
  /** Line number in old file (for context and deletion) */
  oldLineNumber?: number
  /** Line number in new file (for context and addition) */
  newLineNumber?: number
}

export interface ParsedDiff {
  files: DiffFile[]
  totalAdditions: number
  totalDeletions: number
}

/**
 * Parse a unified diff string into structured data
 */
export function parseUnidiff(diffString: string): ParsedDiff {
  const files: DiffFile[] = []
  let totalAdditions = 0
  let totalDeletions = 0

  if (!diffString || diffString.trim() === '') {
    return { files, totalAdditions, totalDeletions }
  }

  const lines = diffString.split('\n')
  let currentFile: DiffFile | null = null
  let currentHunk: DiffHunk | null = null
  let oldLineNum = 0
  let newLineNum = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match diff header: diff --git a/path b/path
    if (line.startsWith('diff --git')) {
      // Save previous file if exists
      if (currentFile) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk)
        }
        files.push(currentFile)
      }

      // Extract paths from diff --git a/path b/path
      const match = line.match(/diff --git a\/(.+) b\/(.+)/)
      const oldPath = match?.[1] ?? ''
      const newPath = match?.[2] ?? ''

      currentFile = {
        oldPath,
        newPath,
        type: 'modified',
        additions: 0,
        deletions: 0,
        hunks: [],
      }
      currentHunk = null
      continue
    }

    // Match new file mode (indicates file was added)
    if (line.startsWith('new file mode') && currentFile) {
      currentFile.type = 'added'
      continue
    }

    // Match deleted file mode
    if (line.startsWith('deleted file mode') && currentFile) {
      currentFile.type = 'deleted'
      continue
    }

    // Match rename from/to
    if (line.startsWith('rename from') && currentFile) {
      currentFile.type = 'renamed'
      continue
    }

    // Match --- (old file path)
    if (line.startsWith('--- ') && currentFile) {
      const path = line.slice(4)
      if (path === '/dev/null') {
        currentFile.type = 'added'
      }
      continue
    }

    // Match +++ (new file path)
    if (line.startsWith('+++ ') && currentFile) {
      const path = line.slice(4)
      if (path === '/dev/null') {
        currentFile.type = 'deleted'
      }
      continue
    }

    // Match hunk header: @@ -start,count +start,count @@
    const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
    if (hunkMatch && currentFile) {
      if (currentHunk) {
        currentFile.hunks.push(currentHunk)
      }

      oldLineNum = Number.parseInt(hunkMatch[1], 10)
      newLineNum = Number.parseInt(hunkMatch[3], 10)

      currentHunk = {
        oldStart: oldLineNum,
        oldLines: Number.parseInt(hunkMatch[2] ?? '1', 10),
        newStart: newLineNum,
        newLines: Number.parseInt(hunkMatch[4] ?? '1', 10),
        header: line,
        lines: [],
      }
      continue
    }

    // Process diff lines within a hunk
    if (currentHunk && currentFile) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.lines.push({
          type: 'addition',
          content: line.slice(1),
          raw: line,
          newLineNumber: newLineNum++,
        })
        currentFile.additions++
        totalAdditions++
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.lines.push({
          type: 'deletion',
          content: line.slice(1),
          raw: line,
          oldLineNumber: oldLineNum++,
        })
        currentFile.deletions++
        totalDeletions++
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'context',
          content: line.slice(1),
          raw: line,
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        })
      }
    }
  }

  // Don't forget the last file
  if (currentFile) {
    if (currentHunk) {
      currentFile.hunks.push(currentHunk)
    }
    files.push(currentFile)
  }

  return { files, totalAdditions, totalDeletions }
}

/**
 * Extract just the list of changed files from a diff
 */
export function extractChangedFiles(diffString: string): {
  added: string[]
  modified: string[]
  deleted: string[]
  renamed: Array<{ from: string; to: string }>
} {
  const parsed = parseUnidiff(diffString)

  const added: string[] = []
  const modified: string[] = []
  const deleted: string[] = []
  const renamed: Array<{ from: string; to: string }> = []

  for (const file of parsed.files) {
    switch (file.type) {
      case 'added':
        added.push(file.newPath)
        break
      case 'deleted':
        deleted.push(file.oldPath)
        break
      case 'renamed':
        renamed.push({ from: file.oldPath, to: file.newPath })
        break
      default:
        modified.push(file.newPath)
    }
  }

  return { added, modified, deleted, renamed }
}
