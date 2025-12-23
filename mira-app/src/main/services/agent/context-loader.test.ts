import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

import {
  loadContextFiles,
  getContextFilesSummary,
  combineSystemPrompts,
} from './context-loader'

async function mkdirp(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true })
}

describe('context-loader', () => {
  let tmpRoot: string

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-context-loader-'))
  })

  afterEach(async () => {
    // Best-effort cleanup
    await fs.rm(tmpRoot, { recursive: true, force: true })
  })

  it('returns empty result when no context directories exist', async () => {
    const result = await loadContextFiles({ projectPath: tmpRoot })
    expect(result.files).toEqual([])
    expect(result.formattedPrompt).toBe('')
  })

  it('loads .mira/context files and includes descriptions from metadata', async () => {
    const contextDir = path.join(tmpRoot, '.mira', 'context')
    await mkdirp(contextDir)

    await fs.writeFile(path.join(contextDir, 'CLAUDE.md'), 'Rule A')
    await fs.writeFile(path.join(contextDir, 'CODE_QUALITY.txt'), 'Rule B')
    await fs.writeFile(path.join(contextDir, 'IGNORED.bin'), 'binary-ish')
    await fs.writeFile(
      path.join(contextDir, 'context-metadata.json'),
      JSON.stringify({
        files: {
          'CLAUDE.md': { description: 'Project rules' },
          'CODE_QUALITY.txt': { description: 'Quality rules' },
        },
      })
    )

    const result = await loadContextFiles({ projectPath: tmpRoot })

    expect(result.files.map(f => f.name).sort()).toEqual(
      ['CLAUDE.md', 'CODE_QUALITY.txt'].sort()
    )

    const cl = result.files.find(f => f.name === 'CLAUDE.md')
    expect(cl?.description).toBe('Project rules')

    expect(result.formattedPrompt).toContain('# Project Context Files')
    expect(result.formattedPrompt).toContain('## CLAUDE.md')
    expect(result.formattedPrompt).toContain('**Purpose:** Project rules')
    expect(result.formattedPrompt).toContain('Rule A')
  })

  it('getContextFilesSummary returns names and descriptions only', async () => {
    const contextDir = path.join(tmpRoot, '.mira', 'context')
    await mkdirp(contextDir)

    await fs.writeFile(path.join(contextDir, 'RULES.md'), 'Do X')
    await fs.writeFile(
      path.join(contextDir, 'context-metadata.json'),
      JSON.stringify({ files: { 'RULES.md': { description: 'Rules' } } })
    )

    const summary = await getContextFilesSummary({ projectPath: tmpRoot })
    expect(summary).toEqual([
      {
        name: 'RULES.md',
        path: path.join(contextDir, 'RULES.md'),
        description: 'Rules',
      },
    ])
  })

  it('combineSystemPrompts joins non-empty parts with blank lines', () => {
    expect(combineSystemPrompts(undefined, '  ', 'A', null, 'B')).toBe('A\n\nB')
    expect(combineSystemPrompts(undefined, '', '   ')).toBeUndefined()
  })
})
