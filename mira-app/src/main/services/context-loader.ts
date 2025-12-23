/**
 * Context Loader - Loads project context files for agent prompts
 *
 * Searches for context files in multiple locations:
 * 1. Project root: CLAUDE.md, README.md, and other common context files
 * 2. .mira/context/: Custom project context files
 *
 * Context files contain project-specific rules, conventions, and guidelines
 * that agents must follow when working on the project.
 */

import path from 'node:path'
import fs from 'node:fs/promises'

/**
 * Default context file patterns to search for in project root
 */
export const DEFAULT_CONTEXT_PATTERNS = [
  'CLAUDE.md',
  'CLAUDE.txt',
  'README.md',
  'README.txt',
  'CONTRIBUTING.md',
  'AGENTS.md',
  '.claude/settings.md',
]

/**
 * Metadata structure for context files in .mira/context/
 */
export interface ContextMetadata {
  files: Record<string, { description: string }>
}

/** Individual context file with metadata */
export interface ContextFileInfo {
  name: string
  path: string
  content: string
  description?: string
  source: 'root' | 'mira-context'
}

/** Result of loading context files */
export interface ContextFilesResult {
  files: ContextFileInfo[]
  formattedPrompt: string | null
}

export interface LoadContextFilesOptions {
  /** Project path to load context from */
  projectPath: string
  /**
   * Optional custom context file patterns to search for in project root.
   * Defaults to DEFAULT_CONTEXT_PATTERNS.
   */
  contextPatterns?: string[]
  /**
   * Optional custom fs module (for dependency injection in tests).
   */
  fsModule?: {
    access: (p: string) => Promise<void>
    readdir: (p: string) => Promise<string[]>
    readFile: (p: string, encoding: BufferEncoding) => Promise<string>
  }
}

/**
 * Combine multiple system prompt parts into a single prompt.
 * Filters out empty/undefined parts and joins with double newlines.
 */
export function combineSystemPrompts(
  ...parts: Array<string | undefined | null>
): string | undefined {
  const normalized = parts
    .map(p => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)

  return normalized.length > 0 ? normalized.join('\n\n') : undefined
}

/**
 * Check if a file exists at the given path
 */
async function fileExists(
  filePath: string,
  fsModule: typeof fs
): Promise<boolean> {
  try {
    await fsModule.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Load context files from project root based on patterns
 */
async function loadRootContextFiles(
  projectPath: string,
  patterns: string[],
  fsModule: typeof fs
): Promise<ContextFileInfo[]> {
  const files: ContextFileInfo[] = []

  for (const pattern of patterns) {
    const filePath = path.join(projectPath, pattern)

    if (await fileExists(filePath, fsModule)) {
      try {
        const content = await fsModule.readFile(filePath, 'utf-8')
        const fileName = path.basename(pattern)

        files.push({
          name: fileName,
          path: filePath,
          content,
          description: getDefaultDescription(fileName),
          source: 'root',
        })
      } catch (error) {
        console.warn(
          `[ContextLoader] Failed to read root context file ${pattern}:`,
          error
        )
      }
    }
  }

  return files
}

/**
 * Get default description for common context files
 */
function getDefaultDescription(fileName: string): string | undefined {
  const lower = fileName.toLowerCase()

  if (lower === 'claude.md' || lower === 'claude.txt') {
    return 'Claude-specific project rules and conventions'
  }
  if (lower === 'readme.md' || lower === 'readme.txt') {
    return 'Project overview and documentation'
  }
  if (lower === 'contributing.md') {
    return 'Contribution guidelines'
  }
  if (lower === 'agents.md') {
    return 'Agent-specific instructions'
  }
  if (lower === 'settings.md') {
    return 'Claude settings and configuration'
  }

  return undefined
}

/**
 * Load context metadata from .mira/context/context-metadata.json
 */
async function loadContextMetadata(
  contextDir: string,
  fsModule: typeof fs
): Promise<ContextMetadata> {
  const metadataPath = path.join(contextDir, 'context-metadata.json')
  try {
    const content = await fsModule.readFile(metadataPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return { files: {} }
  }
}

/**
 * Load context files from .mira/context/ directory
 */
async function loadMiraContextFiles(
  projectPath: string,
  fsModule: typeof fs
): Promise<ContextFileInfo[]> {
  const contextDir = path.join(projectPath, '.mira', 'context')

  if (!(await fileExists(contextDir, fsModule))) {
    return []
  }

  let allFiles: string[]
  try {
    allFiles = await fsModule.readdir(contextDir)
  } catch {
    return []
  }

  // Filter for .md and .txt files, excluding metadata
  const textFiles = allFiles
    .filter(f => {
      const lower = f.toLowerCase()
      return (
        (lower.endsWith('.md') || lower.endsWith('.txt')) &&
        lower !== 'context-metadata.json'
      )
    })
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))

  if (textFiles.length === 0) {
    return []
  }

  const metadata = await loadContextMetadata(contextDir, fsModule)
  const files: ContextFileInfo[] = []

  for (const fileName of textFiles) {
    const filePath = path.join(contextDir, fileName)
    try {
      const content = await fsModule.readFile(filePath, 'utf-8')
      files.push({
        name: fileName,
        path: filePath,
        content,
        description: metadata.files[fileName]?.description,
        source: 'mira-context',
      })
    } catch (error) {
      console.warn(
        `[ContextLoader] Failed to read context file ${fileName}:`,
        error
      )
    }
  }

  return files
}

/**
 * Format a single context file entry for the prompt
 */
function formatContextFileEntry(file: ContextFileInfo): string {
  const header = `## ${file.name}`
  const pathInfo = `**Path:** \`${file.path}\``
  const sourceInfo = `**Source:** ${file.source === 'root' ? 'Project Root' : '.mira/context'}`

  const descriptionInfo = file.description
    ? `\n**Purpose:** ${file.description}`
    : ''

  return `${header}\n${pathInfo}\n${sourceInfo}${descriptionInfo}\n\n${file.content}`
}

/**
 * Build the formatted context prompt from loaded files
 */
function buildContextPrompt(files: ContextFileInfo[]): string | null {
  if (files.length === 0) return null

  const formattedFiles = files.map(formatContextFileEntry)

  return `# Project Context Files

The following context files provide project-specific rules, conventions, and guidelines.
Each file serves a specific purpose - use the description to understand when to reference it.
If you need more details about a context file, you can read the full file at the path provided.

**IMPORTANT**: You MUST follow the rules and conventions specified in these files.
- Follow ALL commands exactly as shown (e.g., if the project uses \`pnpm\`, NEVER use \`npm\` or \`npx\`)
- Follow ALL coding conventions, commit message formats, and architectural patterns specified
- Reference these rules before running ANY shell commands or making commits

---

${formattedFiles.join('\n\n---\n\n')}

---

**REMINDER**: Before taking any action, verify you are following the conventions specified above.
`
}

/**
 * Load context files from project root and .mira/context/ directory.
 *
 * Searches for:
 * 1. Common context files in project root (CLAUDE.md, README.md, etc.)
 * 2. Custom context files in .mira/context/
 *
 * Returns formatted prompt suitable for use as system prompt prefix.
 */
export async function loadContextFiles(
  options: LoadContextFilesOptions
): Promise<ContextFilesResult> {
  const {
    projectPath,
    contextPatterns = DEFAULT_CONTEXT_PATTERNS,
    fsModule = fs,
  } = options

  // Load from both sources
  const [rootFiles, miraFiles] = await Promise.all([
    loadRootContextFiles(projectPath, contextPatterns, fsModule as typeof fs),
    loadMiraContextFiles(projectPath, fsModule as typeof fs),
  ])

  // Combine files, root files first, then mira context files
  // Deduplicate by name (root files take precedence)
  const seenNames = new Set<string>()
  const allFiles: ContextFileInfo[] = []

  for (const file of rootFiles) {
    if (!seenNames.has(file.name.toLowerCase())) {
      seenNames.add(file.name.toLowerCase())
      allFiles.push(file)
    }
  }

  for (const file of miraFiles) {
    if (!seenNames.has(file.name.toLowerCase())) {
      seenNames.add(file.name.toLowerCase())
      allFiles.push(file)
    }
  }

  const formattedPrompt = buildContextPrompt(allFiles)
  return { files: allFiles, formattedPrompt }
}

/**
 * Get a summary of available context files (names and descriptions only)
 */
export async function getContextFilesSummary(
  options: LoadContextFilesOptions
): Promise<
  Array<{
    name: string
    path: string
    description?: string
    source: 'root' | 'mira-context'
  }>
> {
  const result = await loadContextFiles(options)

  return result.files.map(file => ({
    name: file.name,
    path: file.path,
    description: file.description,
    source: file.source,
  }))
}
