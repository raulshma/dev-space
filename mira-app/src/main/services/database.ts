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
  CustomTheme,
  CreateCustomThemeInput,
} from 'shared/models'
import type {
  AIRequestLog,
  AILogFilter,
  CreateAIRequestLogInput,
  AIResponseLog,
  AIErrorLog,
  AgentTask,
  AgentTaskFilter,
  CreateAgentTaskInput,
  UpdateAgentTaskInput,
  OutputLine,
  CreateOutputLineInput,
  CachedModel,
  CacheModelInput,
  AISetting,
} from 'shared/ai-types'

// Database row interfaces
interface ProjectRow {
  id: string
  name: string
  path: string
  created_at: number
  updated_at: number
  last_opened_at: number | null
  is_missing: number
  theme_id: string | null
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

interface CustomThemeRow {
  id: string
  name: string
  description: string | null
  colors_json: string
  created_at: number
  updated_at: number
}

// AI Request Log row interface
interface AIRequestLogRow {
  id: string
  timestamp: number
  model_id: string
  action: string
  input_json: string
  metadata_json: string | null
  status: string
  response_json: string | null
  error_json: string | null
  created_at: number
}

// Agent Task row interface
interface AgentTaskRow {
  id: string
  description: string
  agent_type: string
  target_directory: string
  parameters_json: string | null
  status: string
  priority: number
  process_id: number | null
  exit_code: number | null
  error: string | null
  file_changes_json: string | null
  created_at: number
  started_at: number | null
  completed_at: number | null
  service_type: string | null
  jules_session_id: string | null
  jules_params_json: string | null
  working_directory: string | null
  execution_step: string | null
  // New columns for agent enhancements
  planning_mode: string | null
  plan_spec: string | null
  require_plan_approval: number | null
  branch_name: string | null
  worktree_path: string | null
  // Project association
  project_id: string | null
  project_name: string | null
}

// Auto-mode state row interface
interface AutoModeStateRow {
  project_path: string
  enabled: number
  concurrency_limit: number
  last_started_task_id: string | null
  updated_at: number
}

// Task dependency row interface
interface TaskDependencyRow {
  task_id: string
  depends_on_task_id: string
  created_at: number
}

// Agent session row interface
interface AgentSessionRow {
  id: string
  project_path: string
  name: string
  model_id: string
  created_at: number
  updated_at: number
  is_archived: number
}

// Session message row interface
interface SessionMessageRow {
  id: string
  session_id: string
  role: string
  content: string
  timestamp: number
}

// Project session state row interface
interface ProjectSessionStateRow {
  project_path: string
  last_session_id: string | null
}

// Worktree row interface
interface WorktreeRow {
  path: string
  project_path: string
  branch: string
  task_id: string | null
  created_at: number
}

// Task Feedback row interface
interface TaskFeedbackRow {
  id: string
  task_id: string
  content: string
  iteration: number
  submitted_at: number
}

// Task Terminal row interface
interface TaskTerminalRow {
  id: string
  task_id: string
  working_directory: string
  created_at: number
  closed_at: number | null
}

// Agent Task Output row interface
interface AgentTaskOutputRow {
  id: number
  task_id: string
  timestamp: number
  content: string
  stream: string
}

// Model Cache row interface
interface ModelCacheRow {
  id: string
  name: string
  provider: string
  context_length: number
  pricing_json: string
  capabilities_json: string
  cached_at: number
  description: string | null
  is_free: number
  max_completion_tokens: number | null
  supported_methods_json: string | null
  created: number
  architecture_json: string | null
}

// AI Settings row interface
interface AISettingsRow {
  key: string
  value: string
  updated_at: number
}

export class DatabaseService {
  private static sqliteDb: Database.Database | null = null
  private dbPath: string

  constructor(dbPath?: string) {
    // Use provided path or default to user data directory
    this.dbPath = dbPath || path.join(app.getPath('userData'), 'mira.db')
  }

  /**
   * Initialize the database connection and schema
   */
  initialize(): void {
    if (DatabaseService.sqliteDb) {
      console.log('[Database] Already initialized')
      return
    }

    console.log(`[Database] Initializing at ${this.dbPath}...`)
    const dbDir = path.dirname(this.dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    // Open database connection
    DatabaseService.sqliteDb = new Database(this.dbPath)

    // Enable WAL mode for non-blocking operations
    DatabaseService.sqliteDb.pragma('journal_mode = WAL')

    // Create schema
    this.createSchema()

    // Apply migrations
    this.migrate()

    // Seed default commands if none exist
    this.seedDefaultCommands()

    console.log('[Database] Initialization complete')
  }

  /**
   * Create database schema with all tables
   */
  private createSchema(): void {
    const db = this.getDb()

    // Projects table
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_opened_at INTEGER,
        is_missing INTEGER DEFAULT 0,
        theme_id TEXT
      )
    `)

    // Tags table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL CHECK (category IN ('tech_stack', 'status')),
        color TEXT
      )
    `)

    // Project-Tag junction table
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_tags (
        project_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (project_id, tag_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `)

    // Sessions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        project_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // Custom Themes table
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_themes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        colors_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Commands library table
    db.exec(`
      CREATE TABLE IF NOT EXISTS commands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        command TEXT NOT NULL,
        category TEXT,
        is_custom INTEGER DEFAULT 0
      )
    `)

    // Blueprints table
    db.exec(`
      CREATE TABLE IF NOT EXISTS blueprints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        structure_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)

    // Settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    // Keyboard shortcuts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS shortcuts (
        action TEXT PRIMARY KEY,
        binding TEXT NOT NULL
      )
    `)

    // Create indexes for better query performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
      CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
      CREATE INDEX IF NOT EXISTS idx_project_tags_project_id ON project_tags(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_tags_tag_id ON project_tags(tag_id);
    `)

    // AI Request Logs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_request_logs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        model_id TEXT NOT NULL,
        action TEXT NOT NULL,
        input_json TEXT NOT NULL,
        metadata_json TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        response_json TEXT,
        error_json TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `)

    // AI Request Logs indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ai_logs_timestamp ON ai_request_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_ai_logs_model ON ai_request_logs(model_id);
      CREATE INDEX IF NOT EXISTS idx_ai_logs_status ON ai_request_logs(status);
    `)

    // Agent Tasks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        target_directory TEXT NOT NULL,
        parameters_json TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 0,
        process_id INTEGER,
        exit_code INTEGER,
        error TEXT,
        file_changes_json TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        started_at INTEGER,
        completed_at INTEGER,
        service_type TEXT,
        jules_session_id TEXT,
        jules_params_json TEXT
      )
    `)

    // Migration: Add new columns if they don't exist
    try {
      db.exec(`ALTER TABLE agent_tasks ADD COLUMN service_type TEXT`)
    } catch {
      // Column already exists
    }
    try {
      db.exec(`ALTER TABLE agent_tasks ADD COLUMN jules_session_id TEXT`)
    } catch {
      // Column already exists
    }
    try {
      db.exec(`ALTER TABLE agent_tasks ADD COLUMN jules_params_json TEXT`)
    } catch {
      // Column already exists
    }
    try {
      db.exec(`ALTER TABLE agent_tasks ADD COLUMN working_directory TEXT`)
    } catch {
      // Column already exists
    }
    try {
      db.exec(`ALTER TABLE agent_tasks ADD COLUMN execution_step TEXT`)
    } catch {
      // Column already exists
    }

    // Agent Tasks indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks(priority);
    `)

    // Agent Task Output table
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_task_output (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        content TEXT NOT NULL,
        stream TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
      )
    `)

    // Agent Task Output index
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_task_output_task ON agent_task_output(task_id);
    `)

    // Model Cache table
    db.exec(`
      CREATE TABLE IF NOT EXISTS model_cache (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        context_length INTEGER,
        pricing_json TEXT,
        capabilities_json TEXT,
        cached_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        description TEXT,
        is_free INTEGER DEFAULT 0,
        max_completion_tokens INTEGER,
        supported_methods_json TEXT,
        created INTEGER,
        architecture_json TEXT
      )
    `)

    // AI Settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `)

    // Jules Activities table - stores activities synced from Jules API
    db.exec(`
      CREATE TABLE IF NOT EXISTS jules_activities (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        name TEXT NOT NULL,
        create_time TEXT NOT NULL,
        originator TEXT NOT NULL,
        activity_json TEXT NOT NULL,
        synced_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
      )
    `)

    // Jules Activities indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jules_activities_task ON jules_activities(task_id);
      CREATE INDEX IF NOT EXISTS idx_jules_activities_session ON jules_activities(session_id);
      CREATE INDEX IF NOT EXISTS idx_jules_activities_create_time ON jules_activities(create_time);
    `)

    // Jules Sync State table - tracks pagination state for incremental fetching
    db.exec(`
      CREATE TABLE IF NOT EXISTS jules_sync_state (
        task_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        last_page_token TEXT,
        last_activity_count INTEGER DEFAULT 0,
        last_sync_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
      )
    `)

    // ============================================================================
    // AGENT ENHANCEMENT TABLES
    // ============================================================================

    // Auto-mode state per project
    db.exec(`
      CREATE TABLE IF NOT EXISTS auto_mode_state (
        project_path TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        concurrency_limit INTEGER NOT NULL DEFAULT 1,
        last_started_task_id TEXT,
        updated_at INTEGER NOT NULL
      )
    `)

    // Task dependencies
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id TEXT NOT NULL,
        depends_on_task_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (task_id, depends_on_task_id),
        FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (depends_on_task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
      )
    `)

    // Task dependencies indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
    `)

    // Agent sessions
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        name TEXT NOT NULL,
        model_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_archived INTEGER NOT NULL DEFAULT 0
      )
    `)

    // Agent sessions indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_project ON agent_sessions(project_path);
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated ON agent_sessions(updated_at);
    `)

    // Session messages
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
      )
    `)

    // Session messages indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_messages_session ON session_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_messages_timestamp ON session_messages(timestamp);
    `)

    // Last selected session per project
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_session_state (
        project_path TEXT PRIMARY KEY,
        last_session_id TEXT,
        FOREIGN KEY (last_session_id) REFERENCES agent_sessions(id) ON DELETE SET NULL
      )
    `)

    // Worktree tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS worktrees (
        path TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        branch TEXT NOT NULL,
        task_id TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE SET NULL
      )
    `)

    // Worktrees indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_worktrees_project ON worktrees(project_path);
      CREATE INDEX IF NOT EXISTS idx_worktrees_task ON worktrees(task_id);
    `)

    // ============================================================================
    // TASK REVIEW WORKFLOW TABLES
    // ============================================================================

    // Task Feedback History table
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_feedback (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        content TEXT NOT NULL,
        iteration INTEGER NOT NULL DEFAULT 1,
        submitted_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
      )
    `)

    // Task Feedback indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_task_feedback_task ON task_feedback(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_feedback_iteration ON task_feedback(task_id, iteration);
    `)

    // Task Terminal Sessions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_terminals (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        working_directory TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        closed_at INTEGER,
        FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
      )
    `)

    // Task Terminals index
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_task_terminals_task ON task_terminals(task_id);
    `)
  }

  /**
   * Apply database migrations (placeholder for future schema changes)
   */
  migrate(): void {
    const db = this.getDb()

    // Get current schema version
    const versionRow = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('schema_version') as { value: string } | undefined
    const currentVersion = versionRow
      ? Number.parseInt(versionRow.value, 10)
      : 0

    // Migration 1: Add new columns to model_cache table
    if (currentVersion < 2) {
      try {
        // Check if columns already exist
        const tableInfo = db
          .prepare('PRAGMA table_info(model_cache)')
          .all() as Array<{ name: string }>
        const columnNames = tableInfo.map(col => col.name)

        // Add missing columns
        if (!columnNames.includes('description')) {
          db.exec('ALTER TABLE model_cache ADD COLUMN description TEXT')
        }
        if (!columnNames.includes('is_free')) {
          db.exec(
            'ALTER TABLE model_cache ADD COLUMN is_free INTEGER DEFAULT 0'
          )
        }
        if (!columnNames.includes('max_completion_tokens')) {
          db.exec(
            'ALTER TABLE model_cache ADD COLUMN max_completion_tokens INTEGER'
          )
        }
        if (!columnNames.includes('supported_methods_json')) {
          db.exec(
            'ALTER TABLE model_cache ADD COLUMN supported_methods_json TEXT'
          )
        }
      } catch (error) {
        console.error('Migration 1 failed:', error)
      }
    }

    // Migration 2: Add created and architecture_json to model_cache table
    if (currentVersion < 3) {
      try {
        const tableInfo = db
          .prepare('PRAGMA table_info(model_cache)')
          .all() as Array<{ name: string }>
        const columnNames = tableInfo.map(col => col.name)

        if (!columnNames.includes('created')) {
          db.exec('ALTER TABLE model_cache ADD COLUMN created INTEGER')
        }
        if (!columnNames.includes('architecture_json')) {
          db.exec(
            'ALTER TABLE model_cache ADD COLUMN architecture_json TEXT'
          )
        }
      } catch (error) {
        console.error('Migration 2 failed:', error)
      }
    }

    // Migration 3: Add agent enhancement columns to agent_tasks table
    if (currentVersion < 4) {
      try {
        const tableInfo = db
          .prepare('PRAGMA table_info(agent_tasks)')
          .all() as Array<{ name: string }>
        const columnNames = tableInfo.map(col => col.name)

        // Add planning_mode column
        if (!columnNames.includes('planning_mode')) {
          db.exec(
            "ALTER TABLE agent_tasks ADD COLUMN planning_mode TEXT DEFAULT 'skip'"
          )
        }
        // Add plan_spec column (JSON blob)
        if (!columnNames.includes('plan_spec')) {
          db.exec('ALTER TABLE agent_tasks ADD COLUMN plan_spec TEXT')
        }
        // Add require_plan_approval column
        if (!columnNames.includes('require_plan_approval')) {
          db.exec(
            'ALTER TABLE agent_tasks ADD COLUMN require_plan_approval INTEGER DEFAULT 0'
          )
        }
        // Add branch_name column
        if (!columnNames.includes('branch_name')) {
          db.exec('ALTER TABLE agent_tasks ADD COLUMN branch_name TEXT')
        }
        // Add worktree_path column
        if (!columnNames.includes('worktree_path')) {
          db.exec('ALTER TABLE agent_tasks ADD COLUMN worktree_path TEXT')
        }
      } catch (error) {
        console.error('Migration 3 (agent enhancements) failed:', error)
      }
    }

    // Migration 4: Add theme_id to projects table
    if (currentVersion < 5) {
      try {
        const tableInfo = db
          .prepare('PRAGMA table_info(projects)')
          .all() as Array<{ name: string }>
        const columnNames = tableInfo.map(col => col.name)

        if (!columnNames.includes('theme_id')) {
          db.exec('ALTER TABLE projects ADD COLUMN theme_id TEXT')
        }
      } catch (error) {
        console.error('Migration 4 (theme_id) failed:', error)
      }
    }

    // Migration 5: Add custom_themes table
    if (currentVersion < 6) {
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS custom_themes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            colors_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          )
        `)
      } catch (error) {
        console.error('Migration 5 (custom_themes) failed:', error)
      }
    }

    // Migration 6: Add project_id and project_name to agent_tasks
    if (currentVersion < 7) {
      try {
        const tableInfo = db
          .prepare('PRAGMA table_info(agent_tasks)')
          .all() as Array<{ name: string }>
        const columnNames = tableInfo.map(col => col.name)

        // Add project_id column
        if (!columnNames.includes('project_id')) {
          db.exec('ALTER TABLE agent_tasks ADD COLUMN project_id TEXT')
        }
        // Add project_name column
        if (!columnNames.includes('project_name')) {
          db.exec('ALTER TABLE agent_tasks ADD COLUMN project_name TEXT')
        }

        // Create index for project_id filtering
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_agent_tasks_project ON agent_tasks(project_id);
        `)
      } catch (error) {
        console.error('Migration 6 (project association) failed:', error)
      }
    }

    // Migration 7: Add task_feedback and task_terminals tables for review workflow
    if (currentVersion < 8) {
      try {
        // Create task_feedback table
        db.exec(`
          CREATE TABLE IF NOT EXISTS task_feedback (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            content TEXT NOT NULL,
            iteration INTEGER NOT NULL DEFAULT 1,
            submitted_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
            FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
          )
        `)

        // Create task_feedback indexes
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_task_feedback_task ON task_feedback(task_id);
          CREATE INDEX IF NOT EXISTS idx_task_feedback_iteration ON task_feedback(task_id, iteration);
        `)

        // Create task_terminals table
        db.exec(`
          CREATE TABLE IF NOT EXISTS task_terminals (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            working_directory TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
            closed_at INTEGER,
            FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
          )
        `)

        // Create task_terminals index
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_task_terminals_task ON task_terminals(task_id);
        `)
      } catch (error) {
        console.error('Migration 7 (task review workflow) failed:', error)
      }
    }

    // Set schema version
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'schema_version',
      '8'
    )
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (DatabaseService.sqliteDb) {
      console.log('[Database] Closing connection...')
      DatabaseService.sqliteDb.close()
      DatabaseService.sqliteDb = null
      console.log('[Database] Connection closed')
    }
  }

  /**
   * Check if the database is initialized
   */
  isInitialized(): boolean {
    return DatabaseService.sqliteDb !== null
  }

  /**
   * Get the database instance (for internal use)
   */
  private getDb(): Database.Database {
    if (!DatabaseService.sqliteDb) {
      console.warn('Database not initialized on access. Attempting auto-initialization...')
      this.initialize()
    }

    if (!DatabaseService.sqliteDb) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    return DatabaseService.sqliteDb
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
      INSERT INTO projects (id, name, path, created_at, updated_at, is_missing, theme_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    // Check if path exists
    const isMissing = !fs.existsSync(data.path)

    stmt.run(id, data.name, data.path, now, now, isMissing ? 1 : 0, null)

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

    if (data.themeId !== undefined) {
      updates.push('theme_id = ?')
      params.push(data.themeId)
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
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  }

  // ============================================================================
  // CUSTOM THEME CRUD OPERATIONS
  // ============================================================================

  /**
   * Get all custom themes
   */
  getCustomThemes(): CustomTheme[] {
    const db = this.getDb()
    const stmt = db.prepare(
      'SELECT * FROM custom_themes ORDER BY updated_at DESC'
    )
    const rows = stmt.all() as CustomThemeRow[]
    return rows.map(row => this.rowToCustomTheme(row))
  }

  /**
   * Get a single custom theme by ID
   */
  getCustomTheme(id: string): CustomTheme | null {
    const db = this.getDb()
    const stmt = db.prepare('SELECT * FROM custom_themes WHERE id = ?')
    const row = stmt.get(id) as CustomThemeRow | undefined
    return row ? this.rowToCustomTheme(row) : null
  }

  /**
   * Create a new custom theme
   */
  createCustomTheme(data: CreateCustomThemeInput): CustomTheme {
    const db = this.getDb()
    const id = `custom-${this.generateId()}`
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO custom_themes (id, name, description, colors_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      data.name,
      data.description || null,
      JSON.stringify(data.colors),
      now,
      now
    )

    const theme = this.getCustomTheme(id)
    if (!theme) throw new Error(`Failed to create custom theme ${id}`)
    return theme
  }

  /**
   * Update a custom theme
   */
  updateCustomTheme(
    id: string,
    data: Partial<CreateCustomThemeInput>
  ): CustomTheme {
    const db = this.getDb()
    const current = this.getCustomTheme(id)
    if (!current) throw new Error(`Theme ${id} not found`)

    const updates: string[] = []
    const params: (string | number | null)[] = []

    if (data.name !== undefined) {
      updates.push('name = ?')
      params.push(data.name)
    }

    if (data.description !== undefined) {
      updates.push('description = ?')
      params.push(data.description || null)
    }

    if (data.colors !== undefined) {
      updates.push('colors_json = ?')
      params.push(JSON.stringify(data.colors))
    }

    updates.push('updated_at = ?')
    params.push(Date.now())

    params.push(id)

    db.prepare(`
      UPDATE custom_themes
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...params)

    return this.getCustomTheme(id)!
  }

  /**
   * Delete a custom theme
   */
  deleteCustomTheme(id: string): void {
    const db = this.getDb()
    db.prepare('DELETE FROM custom_themes WHERE id = ?').run(id)
  }

  /**
   * Convert a CustomThemeRow to a CustomTheme object
   */
  private rowToCustomTheme(row: CustomThemeRow): CustomTheme {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      colors: JSON.parse(row.colors_json),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
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
      themeId: row.theme_id || undefined,
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

  /**
   * Clear all session data and workspace configuration
   */
  clearAllSessions(): void {
    const db = this.getDb()
    db.exec('DELETE FROM sessions')
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

  // ============================================================================
  // AI REQUEST LOG OPERATIONS
  // ============================================================================

  /**
   * Create a new AI request log entry
   */
  createAIRequestLog(data: CreateAIRequestLogInput): AIRequestLog {
    const db = this.getDb()

    const id = this.generateId()
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO ai_request_logs (id, timestamp, model_id, action, input_json, metadata_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      now,
      data.modelId,
      data.action,
      JSON.stringify(data.input),
      data.metadata ? JSON.stringify(data.metadata) : null,
      'pending',
      now
    )

    return {
      id,
      timestamp: new Date(now),
      modelId: data.modelId,
      action: data.action,
      input: data.input,
      metadata: data.metadata,
      status: 'pending',
    }
  }

  /**
   * Update an AI request log with response data
   */
  updateAIRequestLogResponse(logId: string, response: AIResponseLog): void {
    const db = this.getDb()

    const stmt = db.prepare(`
      UPDATE ai_request_logs
      SET response_json = ?, status = 'completed'
      WHERE id = ?
    `)

    stmt.run(JSON.stringify(response), logId)
  }

  /**
   * Update an AI request log with error data
   */
  updateAIRequestLogError(logId: string, error: AIErrorLog): void {
    const db = this.getDb()

    const stmt = db.prepare(`
      UPDATE ai_request_logs
      SET error_json = ?, status = 'failed'
      WHERE id = ?
    `)

    stmt.run(JSON.stringify(error), logId)
  }

  /**
   * Get AI request logs with optional filtering
   */
  getAIRequestLogs(filter?: AILogFilter): AIRequestLog[] {
    const db = this.getDb()

    let query = 'SELECT * FROM ai_request_logs WHERE 1=1'
    const params: (string | number)[] = []

    if (filter?.startDate) {
      query += ' AND timestamp >= ?'
      params.push(filter.startDate.getTime())
    }

    if (filter?.endDate) {
      query += ' AND timestamp <= ?'
      params.push(filter.endDate.getTime())
    }

    if (filter?.modelId) {
      query += ' AND model_id = ?'
      params.push(filter.modelId)
    }

    if (filter?.action) {
      query += ' AND action = ?'
      params.push(filter.action)
    }

    if (filter?.status) {
      query += ' AND status = ?'
      params.push(filter.status)
    }

    query += ' ORDER BY timestamp DESC'

    if (filter?.limit) {
      query += ' LIMIT ?'
      params.push(filter.limit)
    }

    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as AIRequestLogRow[]

    return rows.map(row => this.rowToAIRequestLog(row))
  }

  /**
   * Get a single AI request log by ID
   */
  getAIRequestLog(id: string): AIRequestLog | null {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM ai_request_logs WHERE id = ?')
    const row = stmt.get(id) as AIRequestLogRow | undefined

    if (!row) return null

    return this.rowToAIRequestLog(row)
  }

  /**
   * Delete AI request logs older than the specified retention period
   */
  clearOldAIRequestLogs(retentionDays: number): number {
    const db = this.getDb()

    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000

    const stmt = db.prepare('DELETE FROM ai_request_logs WHERE timestamp < ?')
    const result = stmt.run(cutoffTime)

    return result.changes
  }

  /**
   * Convert a database row to an AIRequestLog object
   */
  private rowToAIRequestLog(row: AIRequestLogRow): AIRequestLog {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      modelId: row.model_id,
      action: row.action as AIRequestLog['action'],
      input: JSON.parse(row.input_json),
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      status: row.status as AIRequestLog['status'],
      response: row.response_json ? JSON.parse(row.response_json) : undefined,
      error: row.error_json ? JSON.parse(row.error_json) : undefined,
    }
  }

  // ============================================================================
  // AGENT TASK OPERATIONS
  // ============================================================================

  /**
   * Create a new agent task
   */
  createAgentTask(data: CreateAgentTaskInput): AgentTask {
    const db = this.getDb()

    const id = this.generateId()
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO agent_tasks (id, description, agent_type, target_directory, parameters_json, status, priority, created_at, service_type, jules_params_json, planning_mode, plan_spec, require_plan_approval, branch_name, worktree_path, project_id, project_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      data.description,
      data.agentType,
      data.targetDirectory,
      data.parameters ? JSON.stringify(data.parameters) : null,
      'pending',
      data.priority ?? 0,
      now,
      data.serviceType ?? 'claude-code',
      data.julesParams ? JSON.stringify(data.julesParams) : null,
      data.planningMode ?? 'skip',
      data.planSpec ? JSON.stringify(data.planSpec) : null,
      data.requirePlanApproval ? 1 : 0,
      data.branchName ?? null,
      data.worktreePath ?? null,
      data.projectId ?? null,
      data.projectName ?? null
    )

    return {
      id,
      description: data.description,
      agentType: data.agentType,
      targetDirectory: data.targetDirectory,
      parameters: data.parameters ?? {},
      status: 'pending',
      priority: data.priority ?? 0,
      createdAt: new Date(now),
      serviceType: data.serviceType ?? 'claude-code',
      julesParams: data.julesParams,
      planningMode: data.planningMode ?? 'skip',
      planSpec: data.planSpec,
      requirePlanApproval: data.requirePlanApproval ?? false,
      branchName: data.branchName,
      worktreePath: data.worktreePath,
      projectId: data.projectId,
      projectName: data.projectName,
    }
  }

  /**
   * Get a single agent task by ID
   */
  getAgentTask(id: string): AgentTask | null {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM agent_tasks WHERE id = ?')
    const row = stmt.get(id) as AgentTaskRow | undefined

    if (!row) return null

    return this.rowToAgentTask(row)
  }

  /**
   * Get agent tasks with optional filtering
   */
  getAgentTasks(filter?: AgentTaskFilter): AgentTask[] {
    const db = this.getDb()

    let query = 'SELECT * FROM agent_tasks WHERE 1=1'
    const params: (string | number)[] = []

    if (filter?.status) {
      query += ' AND status = ?'
      params.push(filter.status)
    }

    if (filter?.agentType) {
      query += ' AND agent_type = ?'
      params.push(filter.agentType)
    }

    if (filter?.projectId) {
      query += ' AND project_id = ?'
      params.push(filter.projectId)
    }

    query += ' ORDER BY priority DESC, created_at ASC'

    if (filter?.limit) {
      query += ' LIMIT ?'
      params.push(filter.limit)
    }

    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as AgentTaskRow[]

    return rows.map(row => this.rowToAgentTask(row))
  }

  /**
   * Update an agent task
   */
  updateAgentTask(id: string, data: UpdateAgentTaskInput): AgentTask | null {
    const db = this.getDb()

    const updates: string[] = []
    const params: (string | number | null)[] = []

    if (data.description !== undefined) {
      updates.push('description = ?')
      params.push(data.description)
    }

    if (data.parameters !== undefined) {
      updates.push('parameters_json = ?')
      params.push(JSON.stringify(data.parameters))
    }

    if (data.status !== undefined) {
      updates.push('status = ?')
      params.push(data.status)
    }

    if (data.priority !== undefined) {
      updates.push('priority = ?')
      params.push(data.priority)
    }

    if (data.processId !== undefined) {
      updates.push('process_id = ?')
      params.push(data.processId)
    }

    if (data.exitCode !== undefined) {
      updates.push('exit_code = ?')
      params.push(data.exitCode)
    }

    if (data.error !== undefined) {
      updates.push('error = ?')
      params.push(data.error)
    }

    if (data.fileChanges !== undefined) {
      updates.push('file_changes_json = ?')
      params.push(JSON.stringify(data.fileChanges))
    }

    if (data.startedAt !== undefined) {
      updates.push('started_at = ?')
      params.push(data.startedAt ? data.startedAt.getTime() : null)
    }

    if (data.completedAt !== undefined) {
      updates.push('completed_at = ?')
      params.push(data.completedAt ? data.completedAt.getTime() : null)
    }

    if (data.julesSessionId !== undefined) {
      updates.push('jules_session_id = ?')
      params.push(data.julesSessionId)
    }

    if (data.julesParams !== undefined) {
      updates.push('jules_params_json = ?')
      params.push(JSON.stringify(data.julesParams))
    }

    if (data.workingDirectory !== undefined) {
      updates.push('working_directory = ?')
      params.push(data.workingDirectory)
    }

    if (data.executionStep !== undefined) {
      updates.push('execution_step = ?')
      params.push(data.executionStep)
    }

    // Agent enhancement fields
    if (data.planningMode !== undefined) {
      updates.push('planning_mode = ?')
      params.push(data.planningMode)
    }

    if (data.planSpec !== undefined) {
      updates.push('plan_spec = ?')
      params.push(data.planSpec ? JSON.stringify(data.planSpec) : null)
    }

    if (data.requirePlanApproval !== undefined) {
      updates.push('require_plan_approval = ?')
      params.push(data.requirePlanApproval ? 1 : 0)
    }

    if (data.branchName !== undefined) {
      updates.push('branch_name = ?')
      params.push(data.branchName)
    }

    if (data.worktreePath !== undefined) {
      updates.push('worktree_path = ?')
      params.push(data.worktreePath)
    }

    if (updates.length === 0) {
      return this.getAgentTask(id)
    }

    params.push(id)

    const stmt = db.prepare(`
      UPDATE agent_tasks
      SET ${updates.join(', ')}
      WHERE id = ?
    `)

    stmt.run(...params)

    return this.getAgentTask(id)
  }

  /**
   * Delete an agent task
   */
  deleteAgentTask(id: string): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM agent_tasks WHERE id = ?')
    stmt.run(id)
  }

  /**
   * Convert a database row to an AgentTask object
   */
  private rowToAgentTask(row: AgentTaskRow): AgentTask {
    return {
      id: row.id,
      description: row.description,
      agentType: row.agent_type as AgentTask['agentType'],
      targetDirectory: row.target_directory,
      parameters: row.parameters_json ? JSON.parse(row.parameters_json) : {},
      status: row.status as AgentTask['status'],
      priority: row.priority,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      processId: row.process_id ?? undefined,
      exitCode: row.exit_code ?? undefined,
      error: row.error ?? undefined,
      fileChanges: row.file_changes_json
        ? JSON.parse(row.file_changes_json)
        : undefined,
      serviceType:
        (row.service_type as AgentTask['serviceType']) ?? 'claude-code',
      julesSessionId: row.jules_session_id ?? undefined,
      julesParams: row.jules_params_json
        ? JSON.parse(row.jules_params_json)
        : undefined,
      workingDirectory: row.working_directory ?? undefined,
      executionStep:
        (row.execution_step as AgentTask['executionStep']) ?? undefined,
      // Agent enhancement fields
      planningMode: (row.planning_mode as AgentTask['planningMode']) ?? 'skip',
      planSpec: row.plan_spec ? JSON.parse(row.plan_spec) : undefined,
      requirePlanApproval: row.require_plan_approval === 1,
      branchName: row.branch_name ?? undefined,
      worktreePath: row.worktree_path ?? undefined,
      // Project association
      projectId: row.project_id ?? undefined,
      projectName: row.project_name ?? undefined,
    }
  }

  // ============================================================================
  // AGENT TASK OUTPUT OPERATIONS
  // ============================================================================

  /**
   * Create a new output line for an agent task
   */
  createTaskOutput(data: CreateOutputLineInput): OutputLine {
    const db = this.getDb()

    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO agent_task_output (task_id, timestamp, content, stream)
      VALUES (?, ?, ?, ?)
    `)

    const result = stmt.run(data.taskId, now, data.content, data.stream)

    return {
      id: Number(result.lastInsertRowid),
      taskId: data.taskId,
      timestamp: new Date(now),
      content: data.content,
      stream: data.stream,
    }
  }

  /**
   * Get output lines for an agent task
   */
  getTaskOutput(taskId: string, fromIndex?: number): OutputLine[] {
    const db = this.getDb()

    let query = 'SELECT * FROM agent_task_output WHERE task_id = ?'
    const params: (string | number)[] = [taskId]

    if (fromIndex !== undefined) {
      query += ' AND id > ?'
      params.push(fromIndex)
    }

    query += ' ORDER BY id ASC'

    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as AgentTaskOutputRow[]

    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      timestamp: new Date(row.timestamp),
      content: row.content,
      stream: row.stream as OutputLine['stream'],
    }))
  }

  /**
   * Get the count of output lines for an agent task
   */
  getTaskOutputCount(taskId: string): number {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT COUNT(*) as count FROM agent_task_output WHERE task_id = ?'
    )
    const result = stmt.get(taskId) as { count: number }

    return result.count
  }

  /**
   * Clear output lines for an agent task
   */
  clearTaskOutput(taskId: string): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM agent_task_output WHERE task_id = ?')
    stmt.run(taskId)
  }

  // ============================================================================
  // JULES ACTIVITIES OPERATIONS
  // ============================================================================

  /**
   * Upsert a Jules activity (insert or update)
   */
  upsertJulesActivity(
    taskId: string,
    sessionId: string,
    activity: import('shared/ipc-types').JulesActivity
  ): void {
    const db = this.getDb()

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO jules_activities (
        id, task_id, session_id, name, create_time, originator, activity_json, synced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      activity.id,
      taskId,
      sessionId,
      activity.name,
      activity.createTime,
      activity.originator,
      JSON.stringify(activity),
      Date.now()
    )
  }

  /**
   * Upsert multiple Jules activities in a transaction
   */
  upsertJulesActivities(
    taskId: string,
    sessionId: string,
    activities: import('shared/ipc-types').JulesActivity[]
  ): void {
    const db = this.getDb()

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO jules_activities (
        id, task_id, session_id, name, create_time, originator, activity_json, synced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const now = Date.now()
    const insertMany = db.transaction(
      (items: import('shared/ipc-types').JulesActivity[]) => {
        for (const activity of items) {
          stmt.run(
            activity.id,
            taskId,
            sessionId,
            activity.name,
            activity.createTime,
            activity.originator,
            JSON.stringify(activity),
            now
          )
        }
      }
    )

    insertMany(activities)
  }

  /**
   * Get Jules activities for a task
   */
  getJulesActivities(
    taskId: string
  ): import('shared/ipc-types').JulesActivity[] {
    const db = this.getDb()

    const stmt = db.prepare(`
      SELECT activity_json FROM jules_activities
      WHERE task_id = ?
      ORDER BY create_time ASC
    `)

    const rows = stmt.all(taskId) as Array<{ activity_json: string }>

    return rows.map(row => JSON.parse(row.activity_json))
  }

  /**
   * Get the count of Jules activities for a task
   */
  getJulesActivityCount(taskId: string): number {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT COUNT(*) as count FROM jules_activities WHERE task_id = ?'
    )
    const result = stmt.get(taskId) as { count: number }

    return result.count
  }

  /**
   * Clear Jules activities for a task
   */
  clearJulesActivities(taskId: string): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM jules_activities WHERE task_id = ?')
    stmt.run(taskId)
  }

  /**
   * Get Jules sync state for a task
   */
  getJulesSyncState(taskId: string): {
    sessionId: string
    lastPageToken: string | null
    lastActivityCount: number
    lastSyncAt: number
  } | null {
    const db = this.getDb()

    const stmt = db.prepare(`
      SELECT session_id, last_page_token, last_activity_count, last_sync_at
      FROM jules_sync_state
      WHERE task_id = ?
    `)

    const row = stmt.get(taskId) as {
      session_id: string
      last_page_token: string | null
      last_activity_count: number
      last_sync_at: number
    } | null

    if (!row) return null

    return {
      sessionId: row.session_id,
      lastPageToken: row.last_page_token,
      lastActivityCount: row.last_activity_count,
      lastSyncAt: row.last_sync_at,
    }
  }

  /**
   * Update Jules sync state for a task
   */
  updateJulesSyncState(
    taskId: string,
    sessionId: string,
    lastPageToken: string | null,
    lastActivityCount: number
  ): void {
    const db = this.getDb()

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO jules_sync_state (
        task_id, session_id, last_page_token, last_activity_count, last_sync_at
      )
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(taskId, sessionId, lastPageToken, lastActivityCount, Date.now())
  }

  /**
   * Clear Jules sync state for a task
   */
  clearJulesSyncState(taskId: string): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM jules_sync_state WHERE task_id = ?')
    stmt.run(taskId)
  }

  // ============================================================================
  // MODEL CACHE OPERATIONS
  // ============================================================================

  /**
   * Cache a model
   */
  cacheModel(data: CacheModelInput): CachedModel {
    const db = this.getDb()

    const now = Date.now()

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO model_cache (
        id, name, provider, context_length, pricing_json, capabilities_json, cached_at,
        description, is_free, max_completion_tokens, supported_methods_json,
        created, architecture_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      data.id,
      data.name,
      data.provider,
      data.contextLength,
      JSON.stringify(data.pricing),
      JSON.stringify(data.capabilities),
      now,
      data.description || null,
      data.isFree ? 1 : 0,
      data.maxCompletionTokens || null,
      data.supportedMethods ? JSON.stringify(data.supportedMethods) : null,
      data.created,
      JSON.stringify(data.architecture)
    )

    return {
      id: data.id,
      name: data.name,
      provider: data.provider,
      contextLength: data.contextLength,
      pricing: data.pricing,
      capabilities: data.capabilities,
      cachedAt: new Date(now),
      description: data.description,
      isFree: data.isFree,
      maxCompletionTokens: data.maxCompletionTokens,
      supportedMethods: data.supportedMethods,
      created: data.created,
      architecture: data.architecture,
    }
  }

  /**
   * Cache multiple models at once
   */
  cacheModels(models: CacheModelInput[]): void {
    const db = this.getDb()

    const now = Date.now()

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO model_cache (
        id, name, provider, context_length, pricing_json, capabilities_json, cached_at,
        description, is_free, max_completion_tokens, supported_methods_json,
        created, architecture_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertMany = db.transaction((models: CacheModelInput[]) => {
      for (const model of models) {
        stmt.run(
          model.id,
          model.name,
          model.provider,
          model.contextLength,
          JSON.stringify(model.pricing),
          JSON.stringify(model.capabilities),
          now,
          model.description || null,
          model.isFree ? 1 : 0,
          model.maxCompletionTokens || null,
          model.supportedMethods
            ? JSON.stringify(model.supportedMethods)
            : null,
          model.created,
          JSON.stringify(model.architecture)
        )
      }
    })

    insertMany(models)
  }

  /**
   * Get all cached models
   */
  getCachedModels(): CachedModel[] {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM model_cache ORDER BY name')
    const rows = stmt.all() as ModelCacheRow[]

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      provider: row.provider,
      contextLength: row.context_length,
      pricing: JSON.parse(row.pricing_json),
      capabilities: JSON.parse(row.capabilities_json),
      cachedAt: new Date(row.cached_at),
      description: row.description || undefined,
      isFree: row.is_free === 1,
      maxCompletionTokens: row.max_completion_tokens || undefined,
      supportedMethods: row.supported_methods_json
        ? JSON.parse(row.supported_methods_json)
        : undefined,
      created: row.created,
      architecture: row.architecture_json
        ? JSON.parse(row.architecture_json)
        : { modality: 'text->text' },
    }))
  }

  /**
   * Get a cached model by ID
   */
  getCachedModel(id: string): CachedModel | null {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM model_cache WHERE id = ?')
    const row = stmt.get(id) as ModelCacheRow | undefined

    if (!row) return null

    return {
      id: row.id,
      name: row.name,
      provider: row.provider,
      contextLength: row.context_length,
      pricing: JSON.parse(row.pricing_json),
      capabilities: JSON.parse(row.capabilities_json),
      cachedAt: new Date(row.cached_at),
      description: row.description || undefined,
      isFree: row.is_free === 1,
      maxCompletionTokens: row.max_completion_tokens || undefined,
      supportedMethods: row.supported_methods_json
        ? JSON.parse(row.supported_methods_json)
        : undefined,
      created: row.created,
      architecture: row.architecture_json
        ? JSON.parse(row.architecture_json)
        : { modality: 'text->text' },
    }
  }

  /**
   * Clear the model cache
   */
  clearModelCache(): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM model_cache')
    stmt.run()
  }

  /**
   * Check if the model cache is stale (older than TTL)
   */
  isModelCacheStale(ttlMs: number): boolean {
    const db = this.getDb()

    const stmt = db.prepare('SELECT MIN(cached_at) as oldest FROM model_cache')
    const result = stmt.get() as { oldest: number | null }

    if (!result.oldest) return true

    return Date.now() - result.oldest > ttlMs
  }

  // ============================================================================
  // AI SETTINGS OPERATIONS
  // ============================================================================

  /**
   * Get an AI setting value by key
   */
  getAISetting(key: string): string | null {
    const db = this.getDb()

    const stmt = db.prepare('SELECT value FROM ai_settings WHERE key = ?')
    const row = stmt.get(key) as { value: string } | undefined

    return row ? row.value : null
  }

  /**
   * Set an AI setting value
   */
  setAISetting(key: string, value: string): void {
    const db = this.getDb()

    const now = Date.now()

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO ai_settings (key, value, updated_at)
      VALUES (?, ?, ?)
    `)

    stmt.run(key, value, now)
  }

  /**
   * Get all AI settings
   */
  getAllAISettings(): AISetting[] {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM ai_settings')
    const rows = stmt.all() as AISettingsRow[]

    return rows.map(row => ({
      key: row.key,
      value: row.value,
      updatedAt: new Date(row.updated_at),
    }))
  }

  /**
   * Delete an AI setting
   */
  deleteAISetting(key: string): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM ai_settings WHERE key = ?')
    stmt.run(key)
  }

  // ============================================================================
  // TASK DEPENDENCY OPERATIONS
  // ============================================================================

  /**
   * Get dependencies for a task
   * @param taskId - The task ID to get dependencies for
   * @returns Array of task IDs this task depends on
   */
  getTaskDependencies(taskId: string): string[] {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?'
    )
    const rows = stmt.all(taskId) as TaskDependencyRow[]

    return rows.map(row => row.depends_on_task_id)
  }

  /**
   * Get tasks that depend on a given task
   * @param taskId - The task ID to find dependents for
   * @returns Array of task IDs that depend on this task
   */
  getTaskDependents(taskId: string): string[] {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT task_id FROM task_dependencies WHERE depends_on_task_id = ?'
    )
    const rows = stmt.all(taskId) as TaskDependencyRow[]

    return rows.map(row => row.task_id)
  }

  /**
   * Set dependencies for a task (replaces existing dependencies)
   * @param taskId - The task ID to set dependencies for
   * @param dependsOn - Array of task IDs this task depends on
   */
  setTaskDependencies(taskId: string, dependsOn: string[]): void {
    const db = this.getDb()
    const now = Date.now()

    // Remove existing dependencies
    const deleteStmt = db.prepare(
      'DELETE FROM task_dependencies WHERE task_id = ?'
    )
    deleteStmt.run(taskId)

    // Add new dependencies
    if (dependsOn.length > 0) {
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id, created_at)
        VALUES (?, ?, ?)
      `)

      for (const dependsOnId of dependsOn) {
        insertStmt.run(taskId, dependsOnId, now)
      }
    }
  }

  /**
   * Remove all dependencies for a task
   * @param taskId - The task ID to remove dependencies for
   */
  removeTaskDependencies(taskId: string): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM task_dependencies WHERE task_id = ?')
    stmt.run(taskId)
  }

  /**
   * Add a single dependency for a task
   * @param taskId - The task ID to add dependency to
   * @param dependsOnId - The task ID to depend on
   */
  addTaskDependency(taskId: string, dependsOnId: string): void {
    const db = this.getDb()
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id, created_at)
      VALUES (?, ?, ?)
    `)

    stmt.run(taskId, dependsOnId, now)
  }

  /**
   * Remove a single dependency for a task
   * @param taskId - The task ID to remove dependency from
   * @param dependsOnId - The task ID to remove as dependency
   */
  removeTaskDependency(taskId: string, dependsOnId: string): void {
    const db = this.getDb()

    const stmt = db.prepare(
      'DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?'
    )
    stmt.run(taskId, dependsOnId)
  }

  /**
   * Check if a dependency exists
   * @param taskId - The task ID
   * @param dependsOnId - The potential dependency task ID
   * @returns True if the dependency exists
   */
  hasTaskDependency(taskId: string, dependsOnId: string): boolean {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT 1 FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?'
    )
    const row = stmt.get(taskId, dependsOnId)

    return row !== undefined
  }

  /**
   * Get all task dependencies (for building dependency graph)
   * @returns Array of all dependency relationships
   */
  getAllTaskDependencies(): Array<{
    taskId: string
    dependsOnTaskId: string
    createdAt: Date
  }> {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM task_dependencies')
    const rows = stmt.all() as TaskDependencyRow[]

    return rows.map(row => ({
      taskId: row.task_id,
      dependsOnTaskId: row.depends_on_task_id,
      createdAt: new Date(row.created_at),
    }))
  }

  // ============================================================================
  // AGENT SESSION OPERATIONS
  // ============================================================================

  /**
   * Create a new agent session
   * @param projectPath - The project path for the session
   * @param name - The session name
   * @param modelId - The AI model ID for the session
   * @returns The created session
   */
  createAgentSession(
    projectPath: string,
    name: string,
    modelId: string
  ): {
    id: string
    projectPath: string
    name: string
    modelId: string
    createdAt: Date
    updatedAt: Date
    isArchived: boolean
    messageCount: number
  } {
    const db = this.getDb()

    const id = this.generateId()
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO agent_sessions (id, project_path, name, model_id, created_at, updated_at, is_archived)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(id, projectPath, name, modelId, now, now, 0)

    return {
      id,
      projectPath,
      name,
      modelId,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      isArchived: false,
      messageCount: 0,
    }
  }

  /**
   * Get a single agent session by ID
   * @param sessionId - The session ID
   * @returns The session or null if not found
   */
  getAgentSession(sessionId: string): {
    id: string
    projectPath: string
    name: string
    modelId: string
    createdAt: Date
    updatedAt: Date
    isArchived: boolean
    messageCount: number
  } | null {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM agent_sessions WHERE id = ?')
    const row = stmt.get(sessionId) as AgentSessionRow | undefined

    if (!row) return null

    // Get message count
    const countStmt = db.prepare(
      'SELECT COUNT(*) as count FROM session_messages WHERE session_id = ?'
    )
    const countResult = countStmt.get(sessionId) as { count: number }

    return {
      id: row.id,
      projectPath: row.project_path,
      name: row.name,
      modelId: row.model_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isArchived: row.is_archived === 1,
      messageCount: countResult.count,
    }
  }

  /**
   * Get all agent sessions for a project
   * @param projectPath - The project path
   * @param includeArchived - Whether to include archived sessions
   * @returns Array of sessions
   */
  getAgentSessions(
    projectPath: string,
    includeArchived = false
  ): Array<{
    id: string
    projectPath: string
    name: string
    modelId: string
    createdAt: Date
    updatedAt: Date
    isArchived: boolean
    messageCount: number
  }> {
    const db = this.getDb()

    let query = 'SELECT * FROM agent_sessions WHERE project_path = ?'
    const params: (string | number)[] = [projectPath]

    if (!includeArchived) {
      query += ' AND is_archived = 0'
    }

    query += ' ORDER BY updated_at DESC'

    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as AgentSessionRow[]

    return rows.map(row => {
      // Get message count for each session
      const countStmt = db.prepare(
        'SELECT COUNT(*) as count FROM session_messages WHERE session_id = ?'
      )
      const countResult = countStmt.get(row.id) as { count: number }

      return {
        id: row.id,
        projectPath: row.project_path,
        name: row.name,
        modelId: row.model_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isArchived: row.is_archived === 1,
        messageCount: countResult.count,
      }
    })
  }

  /**
   * Update an agent session
   * @param sessionId - The session ID
   * @param updates - The fields to update
   * @returns The updated session or null if not found
   */
  updateAgentSession(
    sessionId: string,
    updates: {
      name?: string
      modelId?: string
      isArchived?: boolean
    }
  ): {
    id: string
    projectPath: string
    name: string
    modelId: string
    createdAt: Date
    updatedAt: Date
    isArchived: boolean
    messageCount: number
  } | null {
    const db = this.getDb()

    const updateFields: string[] = []
    const params: (string | number)[] = []

    if (updates.name !== undefined) {
      updateFields.push('name = ?')
      params.push(updates.name)
    }

    if (updates.modelId !== undefined) {
      updateFields.push('model_id = ?')
      params.push(updates.modelId)
    }

    if (updates.isArchived !== undefined) {
      updateFields.push('is_archived = ?')
      params.push(updates.isArchived ? 1 : 0)
    }

    // Always update updated_at
    updateFields.push('updated_at = ?')
    params.push(Date.now())

    if (updateFields.length === 0) {
      return this.getAgentSession(sessionId)
    }

    params.push(sessionId)

    const stmt = db.prepare(`
      UPDATE agent_sessions
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `)

    stmt.run(...params)

    return this.getAgentSession(sessionId)
  }

  /**
   * Archive an agent session
   * @param sessionId - The session ID
   */
  archiveAgentSession(sessionId: string): void {
    const db = this.getDb()

    const stmt = db.prepare(`
      UPDATE agent_sessions
      SET is_archived = 1, updated_at = ?
      WHERE id = ?
    `)

    stmt.run(Date.now(), sessionId)
  }

  /**
   * Delete an agent session (cascade deletes messages)
   * @param sessionId - The session ID
   */
  deleteAgentSession(sessionId: string): void {
    const db = this.getDb()

    // Messages are cascade deleted via foreign key
    const stmt = db.prepare('DELETE FROM agent_sessions WHERE id = ?')
    stmt.run(sessionId)
  }

  // ============================================================================
  // SESSION MESSAGE OPERATIONS
  // ============================================================================

  /**
   * Add a message to a session
   * @param sessionId - The session ID
   * @param role - The message role ('user' or 'assistant')
   * @param content - The message content
   * @returns The created message
   */
  addSessionMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ): {
    id: string
    sessionId: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  } {
    const db = this.getDb()

    const id = this.generateId()
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO session_messages (id, session_id, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(id, sessionId, role, content, now)

    // Update session's updated_at timestamp
    const updateStmt = db.prepare(`
      UPDATE agent_sessions SET updated_at = ? WHERE id = ?
    `)
    updateStmt.run(now, sessionId)

    return {
      id,
      sessionId,
      role,
      content,
      timestamp: new Date(now),
    }
  }

  /**
   * Get all messages for a session
   * @param sessionId - The session ID
   * @returns Array of messages ordered by timestamp
   */
  getSessionMessages(sessionId: string): Array<{
    id: string
    sessionId: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }> {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT * FROM session_messages WHERE session_id = ? ORDER BY timestamp ASC'
    )
    const rows = stmt.all(sessionId) as SessionMessageRow[]

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      timestamp: new Date(row.timestamp),
    }))
  }

  /**
   * Get message count for a session
   * @param sessionId - The session ID
   * @returns The number of messages
   */
  getSessionMessageCount(sessionId: string): number {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT COUNT(*) as count FROM session_messages WHERE session_id = ?'
    )
    const result = stmt.get(sessionId) as { count: number }

    return result.count
  }

  // ============================================================================
  // PROJECT SESSION STATE OPERATIONS
  // ============================================================================

  /**
   * Get the last selected session ID for a project
   * @param projectPath - The project path
   * @returns The last session ID or null
   */
  getLastSessionId(projectPath: string): string | null {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT last_session_id FROM project_session_state WHERE project_path = ?'
    )
    const row = stmt.get(projectPath) as ProjectSessionStateRow | undefined

    return row?.last_session_id ?? null
  }

  /**
   * Set the last selected session ID for a project
   * @param projectPath - The project path
   * @param sessionId - The session ID (or null to clear)
   */
  setLastSessionId(projectPath: string, sessionId: string | null): void {
    const db = this.getDb()

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO project_session_state (project_path, last_session_id)
      VALUES (?, ?)
    `)

    stmt.run(projectPath, sessionId)
  }

  // ============================================================================
  // WORKTREE OPERATIONS
  // ============================================================================

  /**
   * Create a worktree record in the database
   * @param worktreePath - The path to the worktree directory
   * @param projectPath - The project path (main repository)
   * @param branch - The branch name for the worktree
   * @param taskId - Optional task ID associated with the worktree
   * @returns The created worktree record
   */
  createWorktree(
    worktreePath: string,
    projectPath: string,
    branch: string,
    taskId?: string
  ): {
    path: string
    projectPath: string
    branch: string
    taskId: string | null
    createdAt: Date
  } {
    const db = this.getDb()
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO worktrees (path, project_path, branch, task_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(worktreePath, projectPath, branch, taskId ?? null, now)

    return {
      path: worktreePath,
      projectPath,
      branch,
      taskId: taskId ?? null,
      createdAt: new Date(now),
    }
  }

  /**
   * Get a worktree by path
   * @param worktreePath - The path to the worktree
   * @returns The worktree record or null if not found
   */
  getWorktree(worktreePath: string): {
    path: string
    projectPath: string
    branch: string
    taskId: string | null
    createdAt: Date
  } | null {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM worktrees WHERE path = ?')
    const row = stmt.get(worktreePath) as WorktreeRow | undefined

    if (!row) return null

    return {
      path: row.path,
      projectPath: row.project_path,
      branch: row.branch,
      taskId: row.task_id,
      createdAt: new Date(row.created_at),
    }
  }

  /**
   * Get all worktrees for a project
   * @param projectPath - The project path
   * @returns Array of worktree records
   */
  getWorktrees(projectPath: string): Array<{
    path: string
    projectPath: string
    branch: string
    taskId: string | null
    createdAt: Date
  }> {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT * FROM worktrees WHERE project_path = ? ORDER BY created_at DESC'
    )
    const rows = stmt.all(projectPath) as WorktreeRow[]

    return rows.map(row => ({
      path: row.path,
      projectPath: row.project_path,
      branch: row.branch,
      taskId: row.task_id,
      createdAt: new Date(row.created_at),
    }))
  }

  /**
   * Get worktree by branch name for a project
   * @param projectPath - The project path
   * @param branch - The branch name
   * @returns The worktree record or null if not found
   */
  getWorktreeByBranch(
    projectPath: string,
    branch: string
  ): {
    path: string
    projectPath: string
    branch: string
    taskId: string | null
    createdAt: Date
  } | null {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT * FROM worktrees WHERE project_path = ? AND branch = ?'
    )
    const row = stmt.get(projectPath, branch) as WorktreeRow | undefined

    if (!row) return null

    return {
      path: row.path,
      projectPath: row.project_path,
      branch: row.branch,
      taskId: row.task_id,
      createdAt: new Date(row.created_at),
    }
  }

  /**
   * Get worktree by task ID
   * @param taskId - The task ID
   * @returns The worktree record or null if not found
   */
  getWorktreeByTaskId(taskId: string): {
    path: string
    projectPath: string
    branch: string
    taskId: string | null
    createdAt: Date
  } | null {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM worktrees WHERE task_id = ?')
    const row = stmt.get(taskId) as WorktreeRow | undefined

    if (!row) return null

    return {
      path: row.path,
      projectPath: row.project_path,
      branch: row.branch,
      taskId: row.task_id,
      createdAt: new Date(row.created_at),
    }
  }

  /**
   * Update worktree task association
   * @param worktreePath - The path to the worktree
   * @param taskId - The task ID to associate (or null to clear)
   */
  updateWorktreeTaskId(worktreePath: string, taskId: string | null): void {
    const db = this.getDb()

    const stmt = db.prepare('UPDATE worktrees SET task_id = ? WHERE path = ?')
    stmt.run(taskId, worktreePath)
  }

  /**
   * Delete a worktree record from the database
   * @param worktreePath - The path to the worktree
   */
  deleteWorktree(worktreePath: string): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM worktrees WHERE path = ?')
    stmt.run(worktreePath)
  }

  /**
   * Check if a worktree exists in the database
   * @param worktreePath - The path to the worktree
   * @returns True if the worktree exists
   */
  worktreeExists(worktreePath: string): boolean {
    const db = this.getDb()

    const stmt = db.prepare('SELECT 1 FROM worktrees WHERE path = ?')
    const row = stmt.get(worktreePath)

    return row !== undefined
  }

  // ============================================================================
  // AUTO-MODE STATE OPERATIONS
  // ============================================================================

  /**
   * Get auto-mode state for a project
   * @param projectPath - The project path
   * @returns The auto-mode state or null if not found
   */
  getAutoModeState(projectPath: string): {
    projectPath: string
    enabled: boolean
    concurrencyLimit: number
    lastStartedTaskId: string | null
    updatedAt: Date
  } | null {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT * FROM auto_mode_state WHERE project_path = ?'
    )
    const row = stmt.get(projectPath) as AutoModeStateRow | undefined

    if (!row) return null

    return {
      projectPath: row.project_path,
      enabled: row.enabled === 1,
      concurrencyLimit: row.concurrency_limit,
      lastStartedTaskId: row.last_started_task_id,
      updatedAt: new Date(row.updated_at),
    }
  }

  /**
   * Save auto-mode state for a project
   * @param projectPath - The project path
   * @param enabled - Whether auto-mode is enabled
   * @param concurrencyLimit - The concurrency limit
   * @param lastStartedTaskId - The last started task ID (optional)
   */
  saveAutoModeState(
    projectPath: string,
    enabled: boolean,
    concurrencyLimit: number,
    lastStartedTaskId?: string | null
  ): void {
    const db = this.getDb()
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO auto_mode_state (project_path, enabled, concurrency_limit, last_started_task_id, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(
      projectPath,
      enabled ? 1 : 0,
      concurrencyLimit,
      lastStartedTaskId ?? null,
      now
    )
  }

  /**
   * Update auto-mode enabled state for a project
   * @param projectPath - The project path
   * @param enabled - Whether auto-mode is enabled
   */
  setAutoModeEnabled(projectPath: string, enabled: boolean): void {
    const db = this.getDb()
    const now = Date.now()

    // Check if state exists
    const existing = this.getAutoModeState(projectPath)

    if (existing) {
      const stmt = db.prepare(`
        UPDATE auto_mode_state
        SET enabled = ?, updated_at = ?
        WHERE project_path = ?
      `)
      stmt.run(enabled ? 1 : 0, now, projectPath)
    } else {
      // Create new state with defaults
      this.saveAutoModeState(projectPath, enabled, 1, null)
    }
  }

  /**
   * Update auto-mode concurrency limit for a project
   * @param projectPath - The project path
   * @param concurrencyLimit - The concurrency limit
   */
  setAutoModeConcurrencyLimit(
    projectPath: string,
    concurrencyLimit: number
  ): void {
    const db = this.getDb()
    const now = Date.now()

    // Check if state exists
    const existing = this.getAutoModeState(projectPath)

    if (existing) {
      const stmt = db.prepare(`
        UPDATE auto_mode_state
        SET concurrency_limit = ?, updated_at = ?
        WHERE project_path = ?
      `)
      stmt.run(concurrencyLimit, now, projectPath)
    } else {
      // Create new state with defaults
      this.saveAutoModeState(projectPath, false, concurrencyLimit, null)
    }
  }

  /**
   * Update the last started task ID for auto-mode
   * @param projectPath - The project path
   * @param taskId - The task ID
   */
  setAutoModeLastStartedTaskId(
    projectPath: string,
    taskId: string | null
  ): void {
    const db = this.getDb()
    const now = Date.now()

    // Check if state exists
    const existing = this.getAutoModeState(projectPath)

    if (existing) {
      const stmt = db.prepare(`
        UPDATE auto_mode_state
        SET last_started_task_id = ?, updated_at = ?
        WHERE project_path = ?
      `)
      stmt.run(taskId, now, projectPath)
    } else {
      // Create new state with defaults
      this.saveAutoModeState(projectPath, false, 1, taskId)
    }
  }

  /**
   * Delete auto-mode state for a project
   * @param projectPath - The project path
   */
  deleteAutoModeState(projectPath: string): void {
    const db = this.getDb()

    const stmt = db.prepare(
      'DELETE FROM auto_mode_state WHERE project_path = ?'
    )
    stmt.run(projectPath)
  }

  /**
   * Get all auto-mode states (for restoring on startup)
   * @returns Array of all auto-mode states
   */
  getAllAutoModeStates(): Array<{
    projectPath: string
    enabled: boolean
    concurrencyLimit: number
    lastStartedTaskId: string | null
    updatedAt: Date
  }> {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM auto_mode_state')
    const rows = stmt.all() as AutoModeStateRow[]

    return rows.map(row => ({
      projectPath: row.project_path,
      enabled: row.enabled === 1,
      concurrencyLimit: row.concurrency_limit,
      lastStartedTaskId: row.last_started_task_id,
      updatedAt: new Date(row.updated_at),
    }))
  }

  /**
   * Get all enabled auto-mode states (for restoring on startup)
   * @returns Array of enabled auto-mode states
   */
  getEnabledAutoModeStates(): Array<{
    projectPath: string
    enabled: boolean
    concurrencyLimit: number
    lastStartedTaskId: string | null
    updatedAt: Date
  }> {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM auto_mode_state WHERE enabled = 1')
    const rows = stmt.all() as AutoModeStateRow[]

    return rows.map(row => ({
      projectPath: row.project_path,
      enabled: row.enabled === 1,
      concurrencyLimit: row.concurrency_limit,
      lastStartedTaskId: row.last_started_task_id,
      updatedAt: new Date(row.updated_at),
    }))
  }

  // ============================================================================
  // TASK FEEDBACK OPERATIONS (Review Workflow)
  // ============================================================================

  /**
   * Create a new feedback entry for a task
   * @param taskId - The task ID
   * @param content - The feedback content
   * @param iteration - The review iteration number
   * @returns The created feedback entry
   */
  createTaskFeedback(
    taskId: string,
    content: string,
    iteration: number
  ): {
    id: string
    taskId: string
    content: string
    iteration: number
    submittedAt: Date
  } {
    const db = this.getDb()

    const id = this.generateId()
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO task_feedback (id, task_id, content, iteration, submitted_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(id, taskId, content, iteration, now)

    return {
      id,
      taskId,
      content,
      iteration,
      submittedAt: new Date(now),
    }
  }

  /**
   * Get a single feedback entry by ID
   * @param feedbackId - The feedback ID
   * @returns The feedback entry or null if not found
   */
  getTaskFeedback(feedbackId: string): {
    id: string
    taskId: string
    content: string
    iteration: number
    submittedAt: Date
  } | null {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM task_feedback WHERE id = ?')
    const row = stmt.get(feedbackId) as TaskFeedbackRow | undefined

    if (!row) return null

    return {
      id: row.id,
      taskId: row.task_id,
      content: row.content,
      iteration: row.iteration,
      submittedAt: new Date(row.submitted_at),
    }
  }

  /**
   * Get all feedback entries for a task ordered by submission time (chronological)
   * @param taskId - The task ID
   * @returns Array of feedback entries ordered by submittedAt ascending
   */
  getTaskFeedbackHistory(taskId: string): Array<{
    id: string
    taskId: string
    content: string
    iteration: number
    submittedAt: Date
  }> {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT * FROM task_feedback WHERE task_id = ? ORDER BY submitted_at ASC'
    )
    const rows = stmt.all(taskId) as TaskFeedbackRow[]

    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      content: row.content,
      iteration: row.iteration,
      submittedAt: new Date(row.submitted_at),
    }))
  }

  /**
   * Get feedback entries for a specific iteration
   * @param taskId - The task ID
   * @param iteration - The iteration number
   * @returns Array of feedback entries for the iteration
   */
  getTaskFeedbackByIteration(
    taskId: string,
    iteration: number
  ): Array<{
    id: string
    taskId: string
    content: string
    iteration: number
    submittedAt: Date
  }> {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT * FROM task_feedback WHERE task_id = ? AND iteration = ? ORDER BY submitted_at ASC'
    )
    const rows = stmt.all(taskId, iteration) as TaskFeedbackRow[]

    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      content: row.content,
      iteration: row.iteration,
      submittedAt: new Date(row.submitted_at),
    }))
  }

  /**
   * Get the count of feedback entries for a task
   * @param taskId - The task ID
   * @returns The number of feedback entries
   */
  getTaskFeedbackCount(taskId: string): number {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT COUNT(*) as count FROM task_feedback WHERE task_id = ?'
    )
    const result = stmt.get(taskId) as { count: number }

    return result.count
  }

  /**
   * Get the highest iteration number for a task
   * @param taskId - The task ID
   * @returns The highest iteration number or 0 if no feedback exists
   */
  getTaskFeedbackMaxIteration(taskId: string): number {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT MAX(iteration) as max_iteration FROM task_feedback WHERE task_id = ?'
    )
    const result = stmt.get(taskId) as { max_iteration: number | null }

    return result.max_iteration ?? 0
  }

  /**
   * Delete a feedback entry
   * @param feedbackId - The feedback ID
   */
  deleteTaskFeedback(feedbackId: string): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM task_feedback WHERE id = ?')
    stmt.run(feedbackId)
  }

  /**
   * Delete all feedback entries for a task
   * @param taskId - The task ID
   */
  clearTaskFeedback(taskId: string): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM task_feedback WHERE task_id = ?')
    stmt.run(taskId)
  }

  // ============================================================================
  // TASK TERMINAL OPERATIONS (Review Workflow)
  // ============================================================================

  /**
   * Create a new terminal session record for a task
   * @param taskId - The task ID
   * @param workingDirectory - The working directory for the terminal
   * @returns The created terminal session record
   */
  createTaskTerminal(
    taskId: string,
    workingDirectory: string
  ): {
    id: string
    taskId: string
    workingDirectory: string
    createdAt: Date
    closedAt: Date | null
  } {
    const db = this.getDb()

    const id = this.generateId()
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO task_terminals (id, task_id, working_directory, created_at, closed_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(id, taskId, workingDirectory, now, null)

    return {
      id,
      taskId,
      workingDirectory,
      createdAt: new Date(now),
      closedAt: null,
    }
  }

  /**
   * Get a single terminal session by ID
   * @param terminalId - The terminal ID
   * @returns The terminal session or null if not found
   */
  getTaskTerminal(terminalId: string): {
    id: string
    taskId: string
    workingDirectory: string
    createdAt: Date
    closedAt: Date | null
  } | null {
    const db = this.getDb()

    const stmt = db.prepare('SELECT * FROM task_terminals WHERE id = ?')
    const row = stmt.get(terminalId) as TaskTerminalRow | undefined

    if (!row) return null

    return {
      id: row.id,
      taskId: row.task_id,
      workingDirectory: row.working_directory,
      createdAt: new Date(row.created_at),
      closedAt: row.closed_at ? new Date(row.closed_at) : null,
    }
  }

  /**
   * Get all terminal sessions for a task
   * @param taskId - The task ID
   * @returns Array of terminal sessions ordered by creation time
   */
  getTaskTerminals(taskId: string): Array<{
    id: string
    taskId: string
    workingDirectory: string
    createdAt: Date
    closedAt: Date | null
  }> {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT * FROM task_terminals WHERE task_id = ? ORDER BY created_at ASC'
    )
    const rows = stmt.all(taskId) as TaskTerminalRow[]

    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      workingDirectory: row.working_directory,
      createdAt: new Date(row.created_at),
      closedAt: row.closed_at ? new Date(row.closed_at) : null,
    }))
  }

  /**
   * Get all open (not closed) terminal sessions for a task
   * @param taskId - The task ID
   * @returns Array of open terminal sessions
   */
  getOpenTaskTerminals(taskId: string): Array<{
    id: string
    taskId: string
    workingDirectory: string
    createdAt: Date
    closedAt: Date | null
  }> {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT * FROM task_terminals WHERE task_id = ? AND closed_at IS NULL ORDER BY created_at ASC'
    )
    const rows = stmt.all(taskId) as TaskTerminalRow[]

    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      workingDirectory: row.working_directory,
      createdAt: new Date(row.created_at),
      closedAt: null,
    }))
  }

  /**
   * Get the count of open terminal sessions for a task
   * @param taskId - The task ID
   * @returns The number of open terminals
   */
  getOpenTaskTerminalCount(taskId: string): number {
    const db = this.getDb()

    const stmt = db.prepare(
      'SELECT COUNT(*) as count FROM task_terminals WHERE task_id = ? AND closed_at IS NULL'
    )
    const result = stmt.get(taskId) as { count: number }

    return result.count
  }

  /**
   * Mark a terminal session as closed
   * @param terminalId - The terminal ID
   */
  closeTaskTerminal(terminalId: string): void {
    const db = this.getDb()
    const now = Date.now()

    const stmt = db.prepare(
      'UPDATE task_terminals SET closed_at = ? WHERE id = ?'
    )
    stmt.run(now, terminalId)
  }

  /**
   * Close all open terminal sessions for a task
   * @param taskId - The task ID
   * @returns The number of terminals closed
   */
  closeAllTaskTerminals(taskId: string): number {
    const db = this.getDb()
    const now = Date.now()

    const stmt = db.prepare(
      'UPDATE task_terminals SET closed_at = ? WHERE task_id = ? AND closed_at IS NULL'
    )
    const result = stmt.run(now, taskId)

    return result.changes
  }

  /**
   * Delete a terminal session record
   * @param terminalId - The terminal ID
   */
  deleteTaskTerminal(terminalId: string): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM task_terminals WHERE id = ?')
    stmt.run(terminalId)
  }

  /**
   * Delete all terminal session records for a task
   * @param taskId - The task ID
   */
  clearTaskTerminals(taskId: string): void {
    const db = this.getDb()

    const stmt = db.prepare('DELETE FROM task_terminals WHERE task_id = ?')
    stmt.run(taskId)
  }
}
