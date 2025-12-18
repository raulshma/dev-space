import { readdir, stat, readFile, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

// Patterns to ignore in file explorer
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.DS_Store',
  'Thumbs.db',
  '.idea',
  '.vscode',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  '.turbo',
  '.cache',
]

export class FilesService {
  /**
   * List directory contents recursively up to a max depth
   */
  async listDirectory(
    dirPath: string,
    maxDepth = 3,
    currentDepth = 0
  ): Promise<FileNode[]> {
    if (currentDepth >= maxDepth) {
      return []
    }

    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      const nodes: FileNode[] = []

      // Sort: directories first, then files, both alphabetically
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })

      for (const entry of sorted) {
        // Skip ignored patterns
        if (IGNORE_PATTERNS.includes(entry.name)) {
          continue
        }

        // Skip hidden files (starting with .)
        if (entry.name.startsWith('.') && entry.name !== '.env') {
          continue
        }

        const fullPath = join(dirPath, entry.name)

        if (entry.isDirectory()) {
          const children = await this.listDirectory(
            fullPath,
            maxDepth,
            currentDepth + 1
          )
          nodes.push({
            name: entry.name,
            path: fullPath,
            isDirectory: true,
            children,
          })
        } else {
          nodes.push({
            name: entry.name,
            path: fullPath,
            isDirectory: false,
          })
        }
      }

      return nodes
    } catch (error) {
      console.error(`Error listing directory ${dirPath}:`, error)
      return []
    }
  }

  /**
   * List only immediate children of a directory (for lazy loading)
   */
  async listDirectoryShallow(dirPath: string): Promise<FileNode[]> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      const nodes: FileNode[] = []

      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })

      for (const entry of sorted) {
        if (IGNORE_PATTERNS.includes(entry.name)) {
          continue
        }

        if (entry.name.startsWith('.') && entry.name !== '.env') {
          continue
        }

        const fullPath = join(dirPath, entry.name)

        nodes.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          children: entry.isDirectory() ? [] : undefined,
        })
      }

      return nodes
    } catch (error) {
      console.error(`Error listing directory ${dirPath}:`, error)
      return []
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(filePath: string): Promise<{
    exists: boolean
    isDirectory: boolean
    size: number
    modifiedAt: Date
  } | null> {
    try {
      const stats = await stat(filePath)
      return {
        exists: true,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modifiedAt: stats.mtime,
      }
    } catch {
      return null
    }
  }

  /**
   * Read file content with size limit
   */
  async readFileContent(
    filePath: string,
    maxSize = 1024 * 1024 // 1MB default
  ): Promise<{
    content: string
    size: number
    isTruncated: boolean
    language: string
  }> {
    const stats = await stat(filePath)
    const size = stats.size
    const isTruncated = size > maxSize

    // For files within limit, use simple readFile
    if (!isTruncated) {
      const content = await readFile(filePath, 'utf-8')
      return {
        content,
        size,
        isTruncated: false,
        language: this.detectLanguage(filePath),
      }
    }

    // For large files, read only up to maxSize
    const { createReadStream } = await import('node:fs')

    return new Promise((resolve, reject) => {
      const stream = createReadStream(filePath, {
        start: 0,
        end: maxSize - 1,
        encoding: 'utf-8',
      })
      let content = ''

      stream.on('data', (chunk: string | Buffer) => {
        content += typeof chunk === 'string' ? chunk : chunk.toString('utf-8')
      })
      stream.on('end', () => {
        resolve({
          content,
          size,
          isTruncated: true,
          language: this.detectLanguage(filePath),
        })
      })
      stream.on('error', reject)
    })
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase().slice(1)
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      json: 'json',
      md: 'markdown',
      mdx: 'markdown',
      css: 'css',
      scss: 'css',
      sass: 'css',
      less: 'css',
      html: 'html',
      htm: 'html',
      xml: 'xml',
      svg: 'xml',
      py: 'python',
      rb: 'ruby',
      rs: 'rust',
      go: 'go',
      java: 'java',
      kt: 'kotlin',
      swift: 'swift',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      php: 'php',
      sql: 'sql',
      sh: 'bash',
      bash: 'bash',
      zsh: 'bash',
      yml: 'yaml',
      yaml: 'yaml',
      toml: 'toml',
      ini: 'ini',
      env: 'ini',
      dockerfile: 'dockerfile',
      graphql: 'graphql',
      gql: 'graphql',
    }
    return languageMap[ext] || 'plaintext'
  }

  /**
   * Write content to a file
   */
  async writeFileContent(
    filePath: string,
    content: string
  ): Promise<{ success: boolean; size: number }> {
    await writeFile(filePath, content, 'utf-8')
    const stats = await stat(filePath)
    return { success: true, size: stats.size }
  }
}
