/**
 * Context Loader - Loads project context files for agent prompts
 *
 * Loads Mira project context from `.mira/context/`.
 *
 * Context files contain project-specific rules, conventions, and guidelines
 * that agents must follow when working on the project.
 */

import path from 'node:path'
import fs from 'node:fs/promises'

/**
 * Metadata structure for context files
 * Stored in `{projectPath}/.mira/context/context-metadata.json`
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
}

/** Result of loading context files */
export interface ContextFilesResult {
  files: ContextFileInfo[]
  formattedPrompt: string
}

export interface LoadContextFilesOptions {
  /** Project path to load context from */
  projectPath: string
  /**
   * Optional custom fs module (for dependency injection in tests).
   * Should match the subset of fs/promises we rely on.
   */
  fsModule?: {
    access: (p: string) => Promise<void>
    readdir: (p: string) => Promise<string[]>
    readFile: (p: string, encoding: BufferEncoding) => Promise<string>
  }
}

export function combineSystemPrompts(
  ...parts: Array<string | undefined | null>
): string | undefined {
  const normalized = parts
    .map(p => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)

  return normalized.length > 0 ? normalized.join('\n\n') : undefined
}

function getContextDirCandidates(projectPath: string): string[] {
  return [path.join(projectPath, '.mira', 'context')]
}

async function resolveFirstExistingDir(
  candidates: string[],
  fsModule: typeof fs
): Promise<string | null> {
  for (const dir of candidates) {
    try {
      await fsModule.access(path.resolve(dir))
      return path.resolve(dir)
    } catch {
      // continue
    }
  }
  return null
}

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

function formatContextFileEntry(file: ContextFileInfo): string {
  const header = `## ${file.name}`
  const pathInfo = `**Path:** \`${file.path}\``

  const descriptionInfo = file.description
    ? `\n**Purpose:** ${file.description}`
    : ''

  return `${header}\n${pathInfo}${descriptionInfo}\n\n${file.content}`
}

function buildContextPrompt(files: ContextFileInfo[]): string {
  if (files.length === 0) return ''

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
 * Load context files from `.mira/context/`.
 *
 * Loads all `.md` and `.txt` files (case-insensitive), excluding `context-metadata.json`.
 */
export async function loadContextFiles(
  options: LoadContextFilesOptions
): Promise<ContextFilesResult> {
  const { projectPath, fsModule = fs } = options

  const contextDir = await resolveFirstExistingDir(
    getContextDirCandidates(projectPath),
    fsModule as typeof fs
  )

  if (!contextDir) {
    return { files: [], formattedPrompt: '' }
  }

  // Read directory contents
  let allFiles: string[]
  try {
    allFiles = await fsModule.readdir(contextDir)
  } catch {
    return { files: [], formattedPrompt: '' }
  }

  const textFiles = allFiles
    .filter(f => {
    const lower = f.toLowerCase()
    return (
      (lower.endsWith('.md') || lower.endsWith('.txt')) &&
      lower !== 'context-metadata.json'
    )
    })
    // deterministic ordering for stable prompts and tests
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))

  if (textFiles.length === 0) {
    return { files: [], formattedPrompt: '' }
  }

  const metadata = await loadContextMetadata(contextDir, fsModule as typeof fs)

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
      })
    } catch (error) {
      console.warn(
        `[ContextLoader] Failed to read context file ${fileName}:`,
        error
      )
    }
  }

  const formattedPrompt = buildContextPrompt(files)
  return { files, formattedPrompt }
}

/**
 * Get a summary of available context files (names and descriptions only)
 */
export async function getContextFilesSummary(
  options: LoadContextFilesOptions
): Promise<Array<{ name: string; path: string; description?: string }>> {
  const { projectPath, fsModule = fs } = options

  const contextDir = await resolveFirstExistingDir(
    getContextDirCandidates(projectPath),
    fsModule as typeof fs
  )

  if (!contextDir) return []

  try {
    const allFiles = await fsModule.readdir(contextDir)
    const textFiles = allFiles
      .filter(f => {
        const lower = f.toLowerCase()
        return (
          (lower.endsWith('.md') || lower.endsWith('.txt')) &&
          lower !== 'context-metadata.json'
        )
      })
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))

    if (textFiles.length === 0) return []

    const metadata = await loadContextMetadata(contextDir, fsModule as typeof fs)

    return textFiles.map(fileName => ({
      name: fileName,
      path: path.join(contextDir, fileName),
      description: metadata.files[fileName]?.description,
    }))
  } catch {
    return []
  }
}
