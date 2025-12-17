import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'node:path'
import * as fs from 'node:fs'
import type {
  Project,
  Tag,
  SessionState,
  Command,
  Blueprint,
  CreateProjectInput,
  UpdateProjectInput,
  CreateTagInput,
  CreateCommandInput,
  CreateBlueprintInput,
  ProjectFilter,
} from 'shared/models'

// Database row interfaces
interface ProjectRow {
  id: string
  name: string
  path: string
  created_at: number
  updated_at: number
  last_opened_at: number | null
  is_missing: number
}

interface TagRow {
  id: string
  name: string
  category: 'tech_stack' | 'status'
  color: string | null
}

interface CommandRow {
  id: string
  name: string
  command: string
  category: string | null
  is_custom: number
}

interface BlueprintRow {
  id: string
  name: string
  description: string | null
  structure_json: string
  created_at: number
}

export class DatabaseService {
  private db: Database.Database | null = null
  private dbPath: string

  constructor(dbPath?: string) {
    // Use provided path or default to user data directory
    this.dbPath = dbPath || path.join(app.getPath('userData'), 'mira.db')
  }

  /**
   * Initialize the database connection and schema
   */
  initialize(): void {
    // Ensure the directory exists
    const dbDir = path.dirname(this.dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    // Open database connection
    this.db = new Database(this.dbPath)

    // Enable WAL mode for non-blocking operations
    this.db.pragma('journal_mode = WAL')

    // Create schema
    this.createSchema()

    // Seed default commands if none exist
    this.seedDefaultCommands()
  }

  /**
   * Create database schema with all tables
   */
  private createSchema(): void {
    if (!this.db) throw new Error('Database not initialized')

    // Projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_opened_at INTEGER,
        is_missing INTEGER DEFAULT 0
      )
    `)

    // Tags table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL CHECK (category IN ('tech_stack', 'status')),
        color TEXT
      )
    `)

    // Project-Tag junction table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_tags (
        project_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (project_id, tag_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `)

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        project_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // Commands library table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS commands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        command TEXT NOT NULL,
        category TEXT,
        is_custom INTEGER DEFAULT 0
      )
    `)

    // Blueprints table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS blueprints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        structure_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)

    // Settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    // Keyboard shortcuts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shortcuts (
        action TEXT PRIMARY KEY,
        binding TEXT NOT NULL
      )
    `)

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
      CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
      CREATE INDEX IF NOT EXISTS idx_project_tags_project_id ON project_tags(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_tags_tag_id ON project_tags(tag_id);
    `)
  }

  /**
   * Apply database migrations (placeholder for future schema changes)
   */
  migrate(): void {
    if (!this.db) throw new Error('Database not initialized')

    // Get current schema version (for future use)
    // const versionRow = this.db
    //   .prepare('SELECT value FROM settings WHERE key = ?')
    //   .get('schema_version') as { value: string } | undefined
    // const currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0

    // Apply migrations based on version
    // Future migrations will be added here

    // Set schema version
    this.db
      .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run('schema_version', '1')
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  /**
   * Get the database instance (for internal use)
   */
  private getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    return this.db
  }

  // ============================================================================
  // PROJECT CRUD OPERATIONS
  // ============================================================================

  /**
   * Get all projects with optional filtering
   */
  getProjects(filter?: ProjectFilter): Project[] {
    const db = this.getDb()

    let query = `
      SELECT DISTINCT p.* FROM projects p
    `
    const params: (string | number)[] = []

    // Add tag filtering if specified
    if (filter?.tagFilter && filter.tagFilter.length > 0) {
      query += `
        INNER JOIN project_tags pt ON p.id = pt.project_id
        WHERE pt.tag_id IN (${filter.tagFilter.map(() => '?').join(',')})
      `
      params.push(...filter.tagFilter)
    }

    // Add search query filtering
    if (filter?.searchQuery) {
      const searchCondition =
        filter.tagFilter && filter.tagFilter.length > 0 ? 'AND' : 'WHERE'
      query += `
        ${searchCondition} (p.name LIKE ? OR p.path LIKE ?)
      `
      const searchPattern = `%${filter.searchQuery}%`
      params.push(searchPattern, searchPattern)
    }

    query += ' ORDER BY p.updated_at DESC'

    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as ProjectRow[]

    // Convert rows to Project objects and check for missing paths
    return rows.map(row => this.rowToProject(row))
  }

  /**
   * Get a single project by ID
   */
  getProject(id: string): Project | null {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM projects WHERE id = ?')
    const row = stmt.get(id) as ProjectRow | undefined

    if (!row) return null

    return this.rowToProject(row)
  }

  /**
   * Create a new project
   */
  createProject(data: CreateProjectInput): Project {
    const db = this.getDb()

    const id = this.generateId()
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO projects (id, name, path, created_at, updated_at, is_missing)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    // Check if path exists
    const isMissing = !fs.existsSync(data.path)

    stmt.run(id, data.name, data.path, now, now, isMissing ? 1 : 0)

    const project = this.getProject(id)
    if (!project) {
      throw new Error(`Failed to create project with id ${id}`)
    }
    return project
  }

  /**
   * Update an existing project
   */
  updateProject(id: string, data: UpdateProjectInput): Project {
    const db = this.getDb()

    const updates: string[] = []
    const params: (string | number)[] = []

    if (data.name !== undefined) {
      updates.push('name = ?')
      params.push(data.name)
    }

    if (data.path !== undefined) {
      updates.push('path = ?')
      params.push(data.path)
    }

    if (data.lastOpenedAt !== undefined) {
      updates.push('last_opened_at = ?')
      params.push(data.lastOpenedAt.getTime())
    }

    // Always update the updated_at timestamp
    updates.push('updated_at = ?')
    params.push(Date.now())

    params.push(id)

    const stmt = db.prepare(`
      UPDATE projects
      SET ${updates.join(', ')}
      WHERE id = ?
    `)

    stmt.run(...params)

    const project = this.getProject(id)
    if (!project) {
      throw new Error(`Failed to update project with id ${id}`)
    }
    return project
  }

  /**
   * Delete a project
   */
  deleteProject(id: string): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM projects WHERE id = ?')
    stmt.run(id)
  }

  /**
   * Convert a database row to a Project object
   */
  private rowToProject(row: ProjectRow): Project {
    const db = this.getDb()

    // Get tags for this project
    const tagStmt = db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN project_tags pt ON t.id = pt.tag_id
      WHERE pt.project_id = ?
    `)
    const tagRows = tagStmt.all(row.id) as TagRow[]

    // Check if path exists on filesystem
    const isMissing = !fs.existsSync(row.path)

    // Update is_missing flag if it changed
    if (isMissing !== Boolean(row.is_missing)) {
      const updateStmt = db.prepare(
        'UPDATE projects SET is_missing = ? WHERE id = ?'
      )
      updateStmt.run(isMissing ? 1 : 0, row.id)
    }

    return {
      id: row.id,
      name: row.name,
      path: row.path,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastOpenedAt: row.last_opened_at ? new Date(row.last_opened_at) : null,
      isMissing,
      tags: tagRows.map(tagRow => ({
        id: tagRow.id,
        name: tagRow.name,
        category: tagRow.category,
        color: tagRow.color || undefined,
      })),
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // ============================================================================
  // TAG OPERATIONS
  // ============================================================================

  /**
   * Get all tags
   */
  getTags(): Tag[] {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM tags ORDER BY name')
    const rows = stmt.all() as TagRow[]

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      color: row.color || undefined,
    }))
  }

  /**
   * Create a new tag
   */
  createTag(data: CreateTagInput): Tag {
    const db = this.getDb()

    const id = this.generateId()

    const stmt = db.prepare(`
      INSERT INTO tags (id, name, category, color)
      VALUES (?, ?, ?, ?)
    `)

    stmt.run(id, data.name, data.category, data.color || null)

    return {
      id,
      name: data.name,
      category: data.category,
      color: data.color,
    }
  }

  /**
   * Add a tag to a project
   */
  addTagToProject(projectId: string, tagId: string): void {
    const db = this.getDb()

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO project_tags (project_id, tag_id)
      VALUES (?, ?)
    `)

    stmt.run(projectId, tagId)
  }

  /**
   * Remove a tag from a project
   */
  removeTagFromProject(projectId: string, tagId: string): void {
    const db = this.getDb()

    const stmt = db.prepare(`
      DELETE FROM project_tags
      WHERE project_id = ? AND tag_id = ?
    `)

    stmt.run(projectId, tagId)
  }

  // ============================================================================
  // SESSION OPERATIONS
  // ============================================================================

  /**
   * Save session state for a project
   */
  saveSession(projectId: string, state: SessionState): void {
    const db = this.getDb()

    const stateJson = JSON.stringify(state)
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO sessions (project_id, state_json, updated_at)
      VALUES (?, ?, ?)
    `)

    stmt.run(projectId, stateJson, now)
  }

  /**
   * Get session state for a project
   */
  getSession(projectId: string): SessionState | null {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT state_json FROM sessions WHERE project_id = ?'
    )
    const row = stmt.get(projectId) as { state_json: string } | undefined

    if (!row) return null

    try {
      return JSON.parse(row.state_json) as SessionState
    } catch (error) {
      console.error('Failed to parse session state:', error)
      return null
    }
  }

  // ============================================================================
  // COMMAND LIBRARY OPERATIONS
  // ============================================================================

  /**
   * Get all commands
   */
  getCommands(): Command[] {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM commands ORDER BY category, name')
    const rows = stmt.all() as CommandRow[]

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      command: row.command,
      category: row.category || null,
      isCustom: Boolean(row.is_custom),
    }))
  }

  /**
   * Seed default commands if none exist
   */
  private seedDefaultCommands(): void {
    const db = this.getDb()

    // Check if commands already exist
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM commands')
    const result = countStmt.get() as { count: number }

    if (result.count > 0) {
      // Commands already exist, skip seeding
      return
    }

    // Default commands to seed
    const defaultCommands = [
      // Package Management
      {
        name: 'Install Dependencies',
        command: 'npm install',
        category: 'Package Management',
      },
      {
        name: 'Install Dev Dependency',
        command: 'npm install --save-dev ',
        category: 'Package Management',
      },
      {
        name: 'Update Dependencies',
        command: 'npm update',
        category: 'Package Management',
      },
      {
        name: 'Clean Install',
        command: 'npm ci',
        category: 'Package Management',
      },

      // Development
      {
        name: 'Start Dev Server',
        command: 'npm run dev',
        category: 'Development',
      },
      {
        name: 'Build Project',
        command: 'npm run build',
        category: 'Development',
      },
      { name: 'Run Tests', command: 'npm test', category: 'Development' },
      { name: 'Lint Code', command: 'npm run lint', category: 'Development' },

      // Git
      { name: 'Git Status', command: 'git status', category: 'Git' },
      { name: 'Git Add All', command: 'git add .', category: 'Git' },
      { name: 'Git Commit', command: 'git commit -m ""', category: 'Git' },
      { name: 'Git Push', command: 'git push', category: 'Git' },
      { name: 'Git Pull', command: 'git pull', category: 'Git' },

      // File Operations
      { name: 'List Files', command: 'ls -la', category: 'File Operations' },
      {
        name: 'Create Directory',
        command: 'mkdir ',
        category: 'File Operations',
      },
      { name: 'Remove File', command: 'rm ', category: 'File Operations' },
      { name: 'Copy File', command: 'cp ', category: 'File Operations' },
    ]

    const stmt = db.prepare(`
      INSERT INTO commands (id, name, command, category, is_custom)
      VALUES (?, ?, ?, ?, ?)
    `)

    for (const cmd of defaultCommands) {
      const id = this.generateId()
      stmt.run(id, cmd.name, cmd.command, cmd.category, 0)
    }
  }

  /**
   * Create a new command
   */
  createCommand(data: CreateCommandInput): Command {
    const db = this.getDb()

    const id = this.generateId()

    const stmt = db.prepare(`
      INSERT INTO commands (id, name, command, category, is_custom)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(id, data.name, data.command, data.category || null, 1)

    return {
      id,
      name: data.name,
      command: data.command,
      category: data.category || null,
      isCustom: true,
    }
  }

  // ============================================================================
  // BLUEPRINT OPERATIONS
  // ============================================================================

  /**
   * Get all blueprints
   */
  getBlueprints(): Blueprint[] {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM blueprints ORDER BY name')
    const rows = stmt.all() as BlueprintRow[]

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || null,
      structure: JSON.parse(row.structure_json),
      createdAt: new Date(row.created_at),
    }))
  }

  /**
   * Create a new blueprint
   */
  createBlueprint(data: CreateBlueprintInput): Blueprint {
    const db = this.getDb()

    const id = this.generateId()
    const now = Date.now()
    const structureJson = JSON.stringify(data.structure)

    const stmt = db.prepare(`
      INSERT INTO blueprints (id, name, description, structure_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(id, data.name, data.description || null, structureJson, now)

    return {
      id,
      name: data.name,
      description: data.description || null,
      structure: data.structure,
      createdAt: new Date(now),
    }
  }

  // ============================================================================
  // SETTINGS OPERATIONS
  // ============================================================================

  /**
   * Get a setting value by key
   */
  getSetting(key: string): string | null {
    const db = this.getDb()

    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
    const row = stmt.get(key) as { value: string } | undefined

    return row ? row.value : null
  }

  /**
   * Set a setting value
   */
  setSetting(key: string, value: string): void {
    const db = this.getDb()

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `)

    stmt.run(key, value)
  }

  // ============================================================================
  // SHORTCUT OPERATIONS
  // ============================================================================

  /**
   * Get all shortcuts
   */
  getShortcuts(): Record<string, string> {
    const db = this.getDb()

    const stmt = db.prepare('SELECT action, binding FROM shortcuts')
    const rows = stmt.all() as Array<{ action: string; binding: string }>

    const shortcuts: Record<string, string> = {}
    for (const row of rows) {
      shortcuts[row.action] = row.binding
    }

    return shortcuts
  }

  /**
   * Set a shortcut binding
   * Returns true if successful, false if there's a conflict
   */
  setShortcut(action: string, binding: string): boolean {
    const db = this.getDb()

    // Check for conflicts (same binding for different action)
    const conflictStmt = db.prepare(
      'SELECT action FROM shortcuts WHERE binding = ? AND action != ?'
    )
    const conflict = conflictStmt.get(binding, action) as
      | { action: string }
      | undefined

    if (conflict) {
      // Conflict detected
      return false
    }

    // No conflict, set the shortcut
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO shortcuts (action, binding)
      VALUES (?, ?)
    `)

    stmt.run(action, binding)
    return true
  }

  /**
   * Get a shortcut binding for an action
   */
  getShortcut(action: string): string | null {
    const db = this.getDb()

    const stmt = db.prepare('SELECT binding FROM shortcuts WHERE action = ?')
    const row = stmt.get(action) as { binding: string } | undefined

    return row ? row.binding : null
  }
}
