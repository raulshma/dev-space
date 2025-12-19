/**
 * CLI Detector Service
 *
 * Platform-agnostic service for detecting installed CLIs and executables.
 * Automatically finds Python, Node.js, Git, and other common development tools.
 *
 * @module cli-detector-service
 */

import { exec as execCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, platform } from 'node:os'

const exec = promisify(execCallback)

/**
 * Information about a detected CLI/executable
 */
export interface DetectedCLI {
  /** Name of the CLI (e.g., 'python', 'node') */
  name: string
  /** Full path to the executable */
  path: string
  /** Version string if available */
  version?: string
  /** Whether this is the recommended/default option */
  isDefault: boolean
}

/**
 * Result of CLI detection for a specific tool
 */
export interface CLIDetectionResult {
  /** Whether the CLI was found */
  found: boolean
  /** All detected installations */
  installations: DetectedCLI[]
  /** The recommended installation to use */
  recommended?: DetectedCLI
  /** Error message if detection failed */
  error?: string
}

/**
 * Supported CLI types for detection
 */
export type CLIType =
  | 'python'
  | 'node'
  | 'git'
  | 'npm'
  | 'pnpm'
  | 'yarn'
  | 'bun'
  | 'claude-code'
  | 'uv'
  | 'uvx'

/**
 * CLI detection configuration
 */
interface CLIConfig {
  /** Command names to search for */
  commands: string[]
  /** Version flag (e.g., '--version') */
  versionFlag: string
  /** Regex to extract version from output */
  versionRegex: RegExp
  /** Additional paths to check (platform-specific) */
  additionalPaths?: {
    win32?: string[]
    darwin?: string[]
    linux?: string[]
  }
}

/**
 * Configuration for each CLI type
 */
const CLI_CONFIGS: Record<CLIType, CLIConfig> = {
  python: {
    commands: ['python3', 'python', 'py'],
    versionFlag: '--version',
    versionRegex: /Python\s+(\d+\.\d+\.\d+)/i,
    additionalPaths: {
      win32: [
        join(homedir(), 'AppData', 'Local', 'Programs', 'Python'),
        'C:\\Python311',
        'C:\\Python310',
        'C:\\Python39',
        'C:\\Python38',
      ],
      darwin: [
        '/usr/local/bin',
        '/opt/homebrew/bin',
        join(homedir(), '.pyenv', 'shims'),
      ],
      linux: ['/usr/bin', '/usr/local/bin', join(homedir(), '.pyenv', 'shims')],
    },
  },
  node: {
    commands: ['node'],
    versionFlag: '--version',
    versionRegex: /v?(\d+\.\d+\.\d+)/,
    additionalPaths: {
      win32: [
        join(homedir(), 'AppData', 'Roaming', 'nvm'),
        'C:\\Program Files\\nodejs',
      ],
      darwin: [
        '/usr/local/bin',
        '/opt/homebrew/bin',
        join(homedir(), '.nvm', 'versions', 'node'),
      ],
      linux: ['/usr/bin', join(homedir(), '.nvm', 'versions', 'node')],
    },
  },
  git: {
    commands: ['git'],
    versionFlag: '--version',
    versionRegex: /git version (\d+\.\d+\.\d+)/i,
    additionalPaths: {
      win32: [
        'C:\\Program Files\\Git\\bin',
        'C:\\Program Files (x86)\\Git\\bin',
      ],
      darwin: ['/usr/bin', '/usr/local/bin', '/opt/homebrew/bin'],
      linux: ['/usr/bin'],
    },
  },
  npm: {
    commands: ['npm'],
    versionFlag: '--version',
    versionRegex: /(\d+\.\d+\.\d+)/,
  },
  pnpm: {
    commands: ['pnpm'],
    versionFlag: '--version',
    versionRegex: /(\d+\.\d+\.\d+)/,
  },
  yarn: {
    commands: ['yarn'],
    versionFlag: '--version',
    versionRegex: /(\d+\.\d+\.\d+)/,
  },
  bun: {
    commands: ['bun'],
    versionFlag: '--version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    additionalPaths: {
      win32: [join(homedir(), '.bun', 'bin')],
      darwin: [join(homedir(), '.bun', 'bin')],
      linux: [join(homedir(), '.bun', 'bin')],
    },
  },
  'claude-code': {
    commands: ['claude'],
    versionFlag: '--version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    additionalPaths: {
      win32: [join(homedir(), 'AppData', 'Roaming', 'npm')],
      darwin: ['/usr/local/bin', join(homedir(), '.npm-global', 'bin')],
      linux: ['/usr/local/bin', join(homedir(), '.npm-global', 'bin')],
    },
  },
  uv: {
    commands: ['uv'],
    versionFlag: '--version',
    versionRegex: /uv\s+(\d+\.\d+\.\d+)/i,
    additionalPaths: {
      win32: [join(homedir(), '.cargo', 'bin')],
      darwin: [join(homedir(), '.cargo', 'bin'), '/usr/local/bin'],
      linux: [join(homedir(), '.cargo', 'bin'), '/usr/local/bin'],
    },
  },
  uvx: {
    commands: ['uvx'],
    versionFlag: '--version',
    versionRegex: /uvx\s+(\d+\.\d+\.\d+)/i,
    additionalPaths: {
      win32: [join(homedir(), '.cargo', 'bin')],
      darwin: [join(homedir(), '.cargo', 'bin'), '/usr/local/bin'],
      linux: [join(homedir(), '.cargo', 'bin'), '/usr/local/bin'],
    },
  },
}

/**
 * CLI Detector Service
 *
 * Provides platform-agnostic detection of installed CLIs and executables.
 */
export class CLIDetectorService {
  private cache: Map<CLIType, CLIDetectionResult> = new Map()
  private cacheTimeout = 60000 // 1 minute cache
  private cacheTimestamps: Map<CLIType, number> = new Map()

  /**
   * Detect a specific CLI
   *
   * @param cliType - The type of CLI to detect
   * @param useCache - Whether to use cached results (default: true)
   * @returns Detection result with all found installations
   */
  async detect(cliType: CLIType, useCache = true): Promise<CLIDetectionResult> {
    // Check cache
    if (useCache) {
      const cached = this.cache.get(cliType)
      const timestamp = this.cacheTimestamps.get(cliType)
      if (cached && timestamp && Date.now() - timestamp < this.cacheTimeout) {
        return cached
      }
    }

    const config = CLI_CONFIGS[cliType]
    if (!config) {
      return {
        found: false,
        installations: [],
        error: `Unknown CLI type: ${cliType}`,
      }
    }

    const installations: DetectedCLI[] = []
    const seenPaths = new Set<string>()

    // Try each command variant
    for (const command of config.commands) {
      // Try finding via PATH (which/where)
      const pathResult = await this.findInPath(command)
      if (pathResult && !seenPaths.has(pathResult)) {
        seenPaths.add(pathResult)
        const version = await this.getVersion(pathResult, config)
        installations.push({
          name: command,
          path: pathResult,
          version,
          isDefault: installations.length === 0,
        })
      }

      // Try additional platform-specific paths
      const currentPlatform = platform()
      const additionalPaths =
        config.additionalPaths?.[
          currentPlatform as 'win32' | 'darwin' | 'linux'
        ] ?? []

      for (const basePath of additionalPaths) {
        const candidates = this.getExecutableCandidates(command, basePath)
        for (const candidate of candidates) {
          if (existsSync(candidate) && !seenPaths.has(candidate)) {
            seenPaths.add(candidate)
            const version = await this.getVersion(candidate, config)
            if (version) {
              installations.push({
                name: command,
                path: candidate,
                version,
                isDefault: installations.length === 0,
              })
            }
          }
        }
      }
    }

    // Sort by version (newest first) and mark recommended
    if (installations.length > 0) {
      installations.sort((a, b) => {
        if (!a.version || !b.version) return 0
        return this.compareVersions(b.version, a.version)
      })
      installations[0].isDefault = true
      for (let i = 1; i < installations.length; i++) {
        installations[i].isDefault = false
      }
    }

    const result: CLIDetectionResult = {
      found: installations.length > 0,
      installations,
      recommended: installations[0],
    }

    // Update cache
    this.cache.set(cliType, result)
    this.cacheTimestamps.set(cliType, Date.now())

    return result
  }

  /**
   * Detect all supported CLIs
   *
   * @returns Map of CLI type to detection result
   */
  async detectAll(): Promise<Map<CLIType, CLIDetectionResult>> {
    const results = new Map<CLIType, CLIDetectionResult>()
    const cliTypes = Object.keys(CLI_CONFIGS) as CLIType[]

    // Run detections in parallel
    const detections = await Promise.all(
      cliTypes.map(async cliType => ({
        type: cliType,
        result: await this.detect(cliType),
      }))
    )

    for (const { type, result } of detections) {
      results.set(type, result)
    }

    return results
  }

  /**
   * Get the recommended path for a CLI
   *
   * @param cliType - The type of CLI
   * @returns The recommended path or undefined if not found
   */
  async getRecommendedPath(cliType: CLIType): Promise<string | undefined> {
    const result = await this.detect(cliType)
    return result.recommended?.path
  }

  /**
   * Verify a specific path is a valid executable for a CLI type
   *
   * @param cliType - The type of CLI
   * @param path - The path to verify
   * @returns Whether the path is valid
   */
  async verifyPath(cliType: CLIType, path: string): Promise<boolean> {
    if (!existsSync(path)) {
      return false
    }

    const config = CLI_CONFIGS[cliType]
    if (!config) {
      return false
    }

    const version = await this.getVersion(path, config)
    return version !== undefined
  }

  /**
   * Clear the detection cache
   */
  clearCache(): void {
    this.cache.clear()
    this.cacheTimestamps.clear()
  }

  /**
   * Find an executable in the system PATH
   */
  private async findInPath(command: string): Promise<string | undefined> {
    const isWindows = platform() === 'win32'
    const whichCommand = isWindows ? 'where' : 'which'

    try {
      const { stdout } = await exec(`${whichCommand} ${command}`, {
        timeout: 5000,
      })
      const paths = stdout.trim().split(/\r?\n/)
      return paths[0] || undefined
    } catch {
      return undefined
    }
  }

  /**
   * Get version string for an executable
   */
  private async getVersion(
    execPath: string,
    config: CLIConfig
  ): Promise<string | undefined> {
    try {
      // Quote the path to handle spaces
      const quotedPath =
        platform() === 'win32' ? `"${execPath}"` : `'${execPath}'`
      const { stdout, stderr } = await exec(
        `${quotedPath} ${config.versionFlag}`,
        {
          timeout: 10000,
        }
      )
      const output = stdout || stderr
      const match = output.match(config.versionRegex)
      return match?.[1]
    } catch {
      return undefined
    }
  }

  /**
   * Get executable candidates for a command in a base path
   */
  private getExecutableCandidates(command: string, basePath: string): string[] {
    const isWindows = platform() === 'win32'
    const candidates: string[] = []

    if (isWindows) {
      // Windows: check for .exe, .cmd, .bat
      candidates.push(
        join(basePath, `${command}.exe`),
        join(basePath, `${command}.cmd`),
        join(basePath, `${command}.bat`),
        join(basePath, command)
      )
    } else {
      // Unix: just the command name
      candidates.push(join(basePath, command))
    }

    return candidates
  }

  /**
   * Compare two version strings
   * Returns positive if a > b, negative if a < b, 0 if equal
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number)
    const partsB = b.split('.').map(Number)
    const maxLen = Math.max(partsA.length, partsB.length)

    for (let i = 0; i < maxLen; i++) {
      const numA = partsA[i] ?? 0
      const numB = partsB[i] ?? 0
      if (numA !== numB) {
        return numA - numB
      }
    }

    return 0
  }
}

/**
 * Singleton instance for convenience
 */
let instance: CLIDetectorService | null = null

/**
 * Get the singleton CLI detector service instance
 */
export function getCLIDetectorService(): CLIDetectorService {
  if (!instance) {
    instance = new CLIDetectorService()
  }
  return instance
}
