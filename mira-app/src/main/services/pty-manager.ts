import { EventEmitter } from 'events'
// import * as pty from 'node-pty'

/**
 * PTY Manager Service
 *
 * Manages pseudo-terminal instances for terminal emulation.
 * Handles PTY lifecycle, I/O operations, and pinned process management.
 *
 * Requirements: 9.1, 9.4, 12.1, 12.3, 12.4
 *
 * NOTE: node-pty requires Visual Studio Build Tools on Windows.
 * Install with: npm install --global windows-build-tools
 * Or install Visual Studio with "Desktop development with C++" workload.
 */

export interface PTYCreateOptions {
  cwd: string
  shell?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export interface PinnedProcess {
  ptyId: string
  projectId: string
  command: string
  startTime: Date
}

interface PTYInstance {
  // pty: pty.IPty
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pty: any // Placeholder until node-pty is properly installed
  emitter: EventEmitter
  isPinned: boolean
  projectId?: string
  command?: string
  startTime: Date
}

export class PTYManager {
  private instances: Map<string, PTYInstance> = new Map()
  private nextId = 1

  /**
   * Create a new PTY instance
   * Requirements: 9.1
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  create(options: PTYCreateOptions): string {
    const ptyId = `pty-${this.nextId++}`

    // Determine shell based on platform
    // const shell = options.shell || this.getDefaultShell()

    // Create PTY instance
    // NOTE: Commented out until node-pty is properly installed
    /*
    const shell = options.shell || this.getDefaultShell()
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.cwd,
      env: { ...process.env, ...options.env }
    })
    */

    // Placeholder implementation
    const ptyProcess = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onData: (_callback: (data: string) => void) => {
        // Placeholder
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onExit: (_callback: (exitCode: { exitCode: number; signal?: number }) => void) => {
        // Placeholder
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      write: (_data: string) => {
        // Placeholder
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      resize: (_cols: number, _rows: number) => {
        // Placeholder
      },
      kill: () => {
        // Placeholder
      }
    }

    const emitter = new EventEmitter()

    // Set up data handler
    ptyProcess.onData((data: string) => {
      emitter.emit('data', data)
    })

    // Set up exit handler
    ptyProcess.onExit((event: { exitCode: number; signal?: number }) => {
      emitter.emit('exit', event.exitCode)

      // Clean up instance if not pinned
      const instance = this.instances.get(ptyId)
      if (instance && !instance.isPinned) {
        this.instances.delete(ptyId)
      }
    })

    this.instances.set(ptyId, {
      pty: ptyProcess,
      emitter,
      isPinned: false,
      startTime: new Date()
    })

    return ptyId
  }

  /**
   * Kill a specific PTY instance
   * Requirements: 9.4
   */
  kill(ptyId: string): void {
    const instance = this.instances.get(ptyId)
    if (!instance) {
      throw new Error(`PTY instance ${ptyId} not found`)
    }

    instance.pty.kill()
    this.instances.delete(ptyId)
  }

  /**
   * Kill all PTY instances
   * Requirements: 9.4
   */
  killAll(): void {
    for (const [ptyId] of this.instances) {
      this.kill(ptyId)
    }
  }

  /**
   * Write data to a PTY instance
   */
  write(ptyId: string, data: string): void {
    const instance = this.instances.get(ptyId)
    if (!instance) {
      throw new Error(`PTY instance ${ptyId} not found`)
    }

    instance.pty.write(data)
  }

  /**
   * Resize a PTY instance
   */
  resize(ptyId: string, cols: number, rows: number): void {
    const instance = this.instances.get(ptyId)
    if (!instance) {
      throw new Error(`PTY instance ${ptyId} not found`)
    }

    instance.pty.resize(cols, rows)
  }

  /**
   * Register a data event handler for a PTY instance
   */
  onData(ptyId: string, callback: (data: string) => void): void {
    const instance = this.instances.get(ptyId)
    if (!instance) {
      throw new Error(`PTY instance ${ptyId} not found`)
    }

    instance.emitter.on('data', callback)
  }

  /**
   * Register an exit event handler for a PTY instance
   */
  onExit(ptyId: string, callback: (code: number) => void): void {
    const instance = this.instances.get(ptyId)
    if (!instance) {
      throw new Error(`PTY instance ${ptyId} not found`)
    }

    instance.emitter.on('exit', callback)
  }

  /**
   * Pin a terminal process to keep it running across project navigation
   * Requirements: 12.1, 12.3
   */
  pin(ptyId: string, projectId: string, command?: string): void {
    const instance = this.instances.get(ptyId)
    if (!instance) {
      throw new Error(`PTY instance ${ptyId} not found`)
    }

    instance.isPinned = true
    instance.projectId = projectId
    instance.command = command
  }

  /**
   * Unpin a terminal process, allowing it to be terminated on navigation
   * Requirements: 12.4
   */
  unpin(ptyId: string): void {
    const instance = this.instances.get(ptyId)
    if (!instance) {
      throw new Error(`PTY instance ${ptyId} not found`)
    }

    instance.isPinned = false
  }

  /**
   * Get all pinned processes
   * Requirements: 12.1, 12.3
   */
  getPinnedProcesses(): PinnedProcess[] {
    const pinned: PinnedProcess[] = []

    for (const [ptyId, instance] of this.instances) {
      if (instance.isPinned && instance.projectId) {
        pinned.push({
          ptyId,
          projectId: instance.projectId,
          command: instance.command || 'unknown',
          startTime: instance.startTime
        })
      }
    }

    return pinned
  }

  /**
   * Check if a PTY instance exists
   */
  exists(ptyId: string): boolean {
    return this.instances.has(ptyId)
  }

  /**
   * Check if a PTY instance is pinned
   */
  isPinned(ptyId: string): boolean {
    const instance = this.instances.get(ptyId)
    return instance?.isPinned || false
  }

  /**
   * Get the default shell for the current platform
   */
  private getDefaultShell(): string {
    const platform = process.platform

    if (platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe'
    } else if (platform === 'darwin') {
      return process.env.SHELL || '/bin/zsh'
    } else {
      return process.env.SHELL || '/bin/bash'
    }
  }
}
