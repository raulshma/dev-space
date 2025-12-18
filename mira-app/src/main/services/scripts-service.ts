import * as fs from 'node:fs'
import * as path from 'node:path'

export interface ProjectScript {
  name: string
  command: string
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
}

export interface ScriptsResult {
  scripts: ProjectScript[]
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
  hasPackageJson: boolean
}

/**
 * Service for detecting and managing project scripts from package.json
 */
export class ScriptsService {
  /**
   * Detect the package manager used in a project
   */
  detectPackageManager(projectPath: string): 'npm' | 'pnpm' | 'yarn' | 'bun' {
    if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
      return 'pnpm'
    }
    if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) {
      return 'yarn'
    }
    if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) {
      return 'bun'
    }
    return 'npm'
  }

  /**
   * Get scripts from a project's package.json
   */
  getScripts(projectPath: string): ScriptsResult {
    const packageJsonPath = path.join(projectPath, 'package.json')

    if (!fs.existsSync(packageJsonPath)) {
      return {
        scripts: [],
        packageManager: 'npm',
        hasPackageJson: false,
      }
    }

    try {
      const content = fs.readFileSync(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)
      const packageManager = this.detectPackageManager(projectPath)

      const scripts: ProjectScript[] = []

      if (packageJson.scripts && typeof packageJson.scripts === 'object') {
        for (const [name, command] of Object.entries(packageJson.scripts)) {
          if (typeof command === 'string') {
            scripts.push({
              name,
              command,
              packageManager,
            })
          }
        }
      }

      return {
        scripts,
        packageManager,
        hasPackageJson: true,
      }
    } catch {
      return {
        scripts: [],
        packageManager: 'npm',
        hasPackageJson: true,
      }
    }
  }

  /**
   * Build the run command for a script
   */
  buildRunCommand(
    scriptName: string,
    packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
  ): string {
    switch (packageManager) {
      case 'pnpm':
        return `pnpm ${scriptName}`
      case 'yarn':
        return `yarn ${scriptName}`
      case 'bun':
        return `bun run ${scriptName}`
      default:
        return `npm run ${scriptName}`
    }
  }
}
