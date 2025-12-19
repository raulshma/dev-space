/**
 * Running Projects Service
 *
 * Manages dev server processes for projects. Handles starting, stopping,
 * restarting processes and streaming output to the renderer.
 */

import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import type { PTYManager } from './pty-manager'
import type { DatabaseService } from './database'
import type { RunningProject, RunningProjectStatus } from 'shared/models'
import { IPC_CHANNELS } from 'shared/ipc-types'

interface RunningProjectInternal extends RunningProject {
  outputBuffer: string[]
}

const MAX_LOG_LINES = 1000
const DEV_COMMAND_SETTING_PREFIX = 'project_dev_command_'

export class RunningProjectsService extends EventEmitter {
  private runningProjects: Map<string, RunningProjectInternal> = new Map()
  private ptyManager: PTYManager
  private db: DatabaseService
  private mainWindow: BrowserWindow | null = null

  constructor(ptyManager: PTYManager, db: DatabaseService) {
    super()
    this.ptyManager = ptyManager
    this.db = db
  }

  /**
   * Set the main window for IPC events
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * Start a dev server for a project
   */
  async start(
    projectId: string,
    projectName: string,
    projectPath: string,
    devCommand?: string
  ): Promise<RunningProject> {
    // Check if already running
    if (this.runningProjects.has(projectId)) {
      const existing = this.runningProjects.get(projectId)!
      if (existing.status === 'running' || existing.status === 'starting') {
        return this.toPublicProject(existing)
      }
    }

    // Get dev command from parameter or stored setting
    const command = devCommand || this.getDevCommand(projectId)
    if (!command) {
      throw new Error('No dev command configured for this project')
    }

    // Create PTY for the dev server
    const ptyId = this.ptyManager.create({
      cwd: projectPath,
    })

    const id = `running-${projectId}-${Date.now()}`
    const project: RunningProjectInternal = {
      id,
      projectId,
      projectName,
      projectPath,
      devCommand: command,
      ptyId,
      status: 'starting',
      startedAt: new Date(),
      outputBuffer: [],
    }

    this.runningProjects.set(projectId, project)
    this.emitStatusUpdate(projectId, 'starting')

    // Subscribe to PTY events
    this.setupPtyListeners(projectId, ptyId)

    // Execute the dev command
    this.ptyManager.write(ptyId, `${command}\r`)

    // Mark as running after a short delay (command started)
    setTimeout(() => {
      const p = this.runningProjects.get(projectId)
      if (p && p.status === 'starting') {
        p.status = 'running'
        this.emitStatusUpdate(projectId, 'running')
      }
    }, 500)

    return this.toPublicProject(project)
  }

  /**
   * Stop a running project
   */
  async stop(projectId: string): Promise<boolean> {
    const project = this.runningProjects.get(projectId)
    if (!project) {
      return false
    }

    project.status = 'stopping'
    this.emitStatusUpdate(projectId, 'stopping')

    // Send Ctrl+C to attempt graceful stop
    try {
      this.ptyManager.write(project.ptyId, '\x03')
    } catch {
      // PTY might already be dead, continue to force kill
    }

    // Wait a bit for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 500))

    // Send another Ctrl+C in case the first one was absorbed
    try {
      this.ptyManager.write(project.ptyId, '\x03')
    } catch {
      // PTY might already be dead
    }

    // Wait a bit more then force kill
    await new Promise(resolve => setTimeout(resolve, 500))

    // Force kill the process tree and PTY
    try {
      if (this.ptyManager.exists(project.ptyId)) {
        this.ptyManager.kill(project.ptyId)
      }
    } catch (error) {
      // Only treat as error if PTY still exists (real failure)
      if (this.ptyManager.exists(project.ptyId)) {
        project.status = 'error'
        project.error = error instanceof Error ? error.message : 'Failed to stop process'
        this.emitStatusUpdate(projectId, 'error', project.error)
        return false
      }
    }

    project.status = 'stopped'
    this.emitStatusUpdate(projectId, 'stopped')
    this.runningProjects.delete(projectId)

    return true
  }

  /**
   * Restart a running project
   */
  async restart(projectId: string): Promise<RunningProject> {
    const project = this.runningProjects.get(projectId)
    if (!project) {
      throw new Error('Project is not running')
    }

    const { projectName, projectPath, devCommand } = project

    await this.stop(projectId)

    // Small delay before restarting
    await new Promise(resolve => setTimeout(resolve, 500))

    return this.start(projectId, projectName, projectPath, devCommand)
  }

  /**
   * Get all running projects
   */
  list(): RunningProject[] {
    return Array.from(this.runningProjects.values()).map(p =>
      this.toPublicProject(p)
    )
  }

  /**
   * Get logs for a running project
   */
  getLogs(projectId: string, lines?: number): string[] {
    const project = this.runningProjects.get(projectId)
    if (!project) {
      return []
    }

    const buffer = project.outputBuffer
    if (lines && lines < buffer.length) {
      return buffer.slice(-lines)
    }
    return [...buffer]
  }

  /**
   * Check if a project is running
   */
  isRunning(projectId: string): boolean {
    const project = this.runningProjects.get(projectId)
    return project?.status === 'running' || project?.status === 'starting'
  }

  /**
   * Get running project by ID
   */
  get(projectId: string): RunningProject | null {
    const project = this.runningProjects.get(projectId)
    return project ? this.toPublicProject(project) : null
  }

  /**
   * Set dev command for a project (persisted)
   */
  setDevCommand(projectId: string, devCommand: string): void {
    this.db.setSetting(`${DEV_COMMAND_SETTING_PREFIX}${projectId}`, devCommand)
  }

  /**
   * Get dev command for a project
   */
  getDevCommand(projectId: string): string | null {
    return this.db.getSetting(`${DEV_COMMAND_SETTING_PREFIX}${projectId}`)
  }

  /**
   * Stop all running projects (cleanup on app quit)
   */
  async stopAll(): Promise<void> {
    const projectIds = Array.from(this.runningProjects.keys())
    await Promise.all(projectIds.map(id => this.stop(id)))
  }

  private setupPtyListeners(projectId: string, ptyId: string): void {
    const emitter = this.ptyManager.getEmitter(ptyId)
    if (!emitter) return

    emitter.on('data', (data: string) => {
      const project = this.runningProjects.get(projectId)
      if (!project) return

      // Add to buffer
      project.outputBuffer.push(data)
      if (project.outputBuffer.length > MAX_LOG_LINES) {
        project.outputBuffer.shift()
      }

      // Emit to renderer
      this.emitOutput(projectId, data)
    })

    emitter.on('exit', (code: number) => {
      const project = this.runningProjects.get(projectId)
      if (!project) return

      if (project.status !== 'stopping' && project.status !== 'stopped') {
        // Unexpected exit
        project.status = code === 0 ? 'stopped' : 'error'
        project.error =
          code !== 0 ? `Process exited with code ${code}` : undefined
        this.emitStatusUpdate(projectId, project.status, project.error)
      }
    })
  }

  private emitStatusUpdate(
    projectId: string,
    status: RunningProjectStatus,
    error?: string
  ): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    this.mainWindow.webContents.send(
      IPC_CHANNELS.RUNNING_PROJECT_STATUS_UPDATE,
      {
        projectId,
        status,
        error,
      }
    )
  }

  private emitOutput(projectId: string, data: string): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    this.mainWindow.webContents.send(IPC_CHANNELS.RUNNING_PROJECT_OUTPUT, {
      projectId,
      data,
    })
  }

  private toPublicProject(internal: RunningProjectInternal): RunningProject {
    const { outputBuffer, ...public_ } = internal
    return public_
  }
}
