import * as fs from 'fs'
import * as path from 'path'
import type { BlueprintStructure, BlueprintFile } from '../../shared/models'

/**
 * Service for capturing and applying project blueprints
 * Requirements: 15.1, 15.3, 15.4
 */
export class BlueprintService {
  // Default patterns to exclude when capturing blueprints
  private static readonly DEFAULT_EXCLUDE_PATTERNS = [
    'node_modules',
    '.git',
    'build',
    'dist',
    'out',
    '.next',
    'coverage',
    '.cache',
    '.vscode',
    '.idea',
    '*.log',
    '.DS_Store',
    'Thumbs.db'
  ]

  // Config file extensions to capture content for
  private static readonly CONFIG_FILE_EXTENSIONS = [
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.ini',
    '.env',
    '.config.js',
    '.config.ts',
    '.rc'
  ]

  // Config file names to capture (exact matches)
  private static readonly CONFIG_FILE_NAMES = [
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'vite.config.js',
    'webpack.config.js',
    'rollup.config.js',
    '.eslintrc',
    '.prettierrc',
    '.babelrc',
    'jest.config.js',
    'vitest.config.ts',
    'tailwind.config.js',
    'postcss.config.js',
    'Dockerfile',
    'docker-compose.yml',
    '.gitignore',
    '.npmrc',
    '.nvmrc',
    'README.md'
  ]

  /**
   * Capture a project directory structure as a blueprint
   * Requirements: 15.1, 15.4
   */
  captureBlueprint(projectPath: string, customExcludePatterns?: string[]): BlueprintStructure {
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`)
    }

    const stats = fs.statSync(projectPath)
    if (!stats.isDirectory()) {
      throw new Error(`Project path is not a directory: ${projectPath}`)
    }

    const excludePatterns = [
      ...BlueprintService.DEFAULT_EXCLUDE_PATTERNS,
      ...(customExcludePatterns || [])
    ]

    const files: BlueprintFile[] = []
    this.scanDirectory(projectPath, projectPath, files, excludePatterns)

    return {
      files,
      excludePatterns
    }
  }

  /**
   * Recursively scan a directory and capture its structure
   */
  private scanDirectory(
    basePath: string,
    currentPath: string,
    files: BlueprintFile[],
    excludePatterns: string[]
  ): void {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)
      const relativePath = path.relative(basePath, fullPath)

      // Check if this entry should be excluded
      if (this.shouldExclude(relativePath, entry.name, excludePatterns)) {
        continue
      }

      if (entry.isDirectory()) {
        // Add directory entry
        files.push({
          relativePath,
          isDirectory: true
        })

        // Recursively scan subdirectory
        this.scanDirectory(basePath, fullPath, files, excludePatterns)
      } else if (entry.isFile()) {
        // Check if this is a config file that should have content captured
        const shouldCaptureContent = this.isConfigFile(entry.name)

        files.push({
          relativePath,
          isDirectory: false,
          content: shouldCaptureContent ? this.readFileContent(fullPath) : undefined
        })
      }
    }
  }

  /**
   * Check if a path should be excluded based on patterns
   */
  private shouldExclude(relativePath: string, fileName: string, excludePatterns: string[]): boolean {
    for (const pattern of excludePatterns) {
      // Handle wildcard patterns
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
        if (regex.test(fileName) || regex.test(relativePath)) {
          return true
        }
      }
      // Handle exact matches
      else if (relativePath === pattern || fileName === pattern || relativePath.startsWith(pattern + path.sep)) {
        return true
      }
    }
    return false
  }

  /**
   * Check if a file is a config file that should have its content captured
   */
  private isConfigFile(fileName: string): boolean {
    // Check exact name matches
    if (BlueprintService.CONFIG_FILE_NAMES.includes(fileName)) {
      return true
    }

    // Check extension matches
    const ext = path.extname(fileName)
    if (BlueprintService.CONFIG_FILE_EXTENSIONS.includes(ext)) {
      return true
    }

    // Check if filename ends with any config extension pattern
    for (const configExt of BlueprintService.CONFIG_FILE_EXTENSIONS) {
      if (fileName.endsWith(configExt)) {
        return true
      }
    }

    return false
  }

  /**
   * Read file content safely
   */
  private readFileContent(filePath: string): string | undefined {
    try {
      return fs.readFileSync(filePath, 'utf-8')
    } catch (error) {
      console.error(`Failed to read file content: ${filePath}`, error)
      return undefined
    }
  }

  /**
   * Apply a blueprint to a target directory
   * Requirements: 15.3
   */
  applyBlueprint(blueprint: BlueprintStructure, targetPath: string): void {
    // Ensure target directory exists
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true })
    }

    // Create directories first, then files
    const directories = blueprint.files.filter((f) => f.isDirectory)
    const files = blueprint.files.filter((f) => !f.isDirectory)

    // Create all directories
    for (const dir of directories) {
      const dirPath = path.join(targetPath, dir.relativePath)
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
      }
    }

    // Create all files
    for (const file of files) {
      const filePath = path.join(targetPath, file.relativePath)

      // If file has content, write it
      if (file.content !== undefined) {
        fs.writeFileSync(filePath, file.content, 'utf-8')
      } else {
        // Create empty file
        fs.writeFileSync(filePath, '', 'utf-8')
      }
    }
  }
}

