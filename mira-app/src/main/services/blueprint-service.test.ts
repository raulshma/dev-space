import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BlueprintService } from './blueprint-service'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

describe('BlueprintService', () => {
  let blueprintService: BlueprintService
  let testDir: string

  beforeEach(() => {
    blueprintService = new BlueprintService()
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blueprint-test-'))
  })

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('captureBlueprint', () => {
    it('should capture a simple directory structure', () => {
      // Create test structure
      fs.mkdirSync(path.join(testDir, 'src'))
      fs.writeFileSync(path.join(testDir, 'package.json'), '{"name": "test"}')
      fs.writeFileSync(
        path.join(testDir, 'src', 'index.ts'),
        'console.log("test")'
      )

      const blueprint = blueprintService.captureBlueprint(testDir)

      expect(blueprint.files).toBeDefined()
      expect(blueprint.files.length).toBeGreaterThan(0)
      expect(blueprint.excludePatterns).toBeDefined()

      // Check that package.json was captured with content
      const packageJson = blueprint.files.find(
        f => f.relativePath === 'package.json'
      )
      expect(packageJson).toBeDefined()
      expect(packageJson?.content).toBe('{"name": "test"}')

      // Check that src directory was captured
      const srcDir = blueprint.files.find(f => f.relativePath === 'src')
      expect(srcDir).toBeDefined()
      expect(srcDir?.isDirectory).toBe(true)
    })

    it('should exclude node_modules by default', () => {
      // Create test structure with node_modules
      fs.mkdirSync(path.join(testDir, 'node_modules'))
      fs.writeFileSync(path.join(testDir, 'node_modules', 'package.json'), '{}')
      fs.writeFileSync(path.join(testDir, 'package.json'), '{"name": "test"}')

      const blueprint = blueprintService.captureBlueprint(testDir)

      // node_modules should not be in the captured files
      const nodeModules = blueprint.files.find(f =>
        f.relativePath.includes('node_modules')
      )
      expect(nodeModules).toBeUndefined()
    })

    it('should throw error for non-existent path', () => {
      expect(() => {
        blueprintService.captureBlueprint('/non/existent/path')
      }).toThrow()
    })
  })

  describe('applyBlueprint', () => {
    it('should apply a blueprint to a target directory', () => {
      // Create a blueprint structure
      const blueprint = {
        files: [
          { relativePath: 'src', isDirectory: true },
          {
            relativePath: 'package.json',
            isDirectory: false,
            content: '{"name": "test"}',
          },
          {
            relativePath: 'src/index.ts',
            isDirectory: false,
            content: 'console.log("test")',
          },
        ],
        excludePatterns: [],
      }

      const targetDir = path.join(testDir, 'target')
      blueprintService.applyBlueprint(blueprint, targetDir)

      // Check that files were created
      expect(fs.existsSync(path.join(targetDir, 'package.json'))).toBe(true)
      expect(fs.existsSync(path.join(targetDir, 'src'))).toBe(true)
      expect(fs.existsSync(path.join(targetDir, 'src', 'index.ts'))).toBe(true)

      // Check content
      const packageContent = fs.readFileSync(
        path.join(targetDir, 'package.json'),
        'utf-8'
      )
      expect(packageContent).toBe('{"name": "test"}')
    })

    it('should create target directory if it does not exist', () => {
      const blueprint = {
        files: [
          { relativePath: 'test.txt', isDirectory: false, content: 'test' },
        ],
        excludePatterns: [],
      }

      const targetDir = path.join(testDir, 'new', 'nested', 'dir')
      blueprintService.applyBlueprint(blueprint, targetDir)

      expect(fs.existsSync(targetDir)).toBe(true)
      expect(fs.existsSync(path.join(targetDir, 'test.txt'))).toBe(true)
    })
  })
})
