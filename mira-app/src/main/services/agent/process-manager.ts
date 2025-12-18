/**
 * Process Manager Service
 *
 * Handles spawning and controlling Python agent processes.
 * Provides process lifecycle management including pause, resume, and stop operations.
 *
 * Implements Requirements:
 * - 8.2: Execute appropriate Python script with configured parameters
 * - 8.3: Capture stdout and stderr streams in real-time
 * - 5.4: Inject configured environment variables into agent process
 * - 10.2: Send SIGSTOP to pause agent process
 * - 10.3: Send SIGCONT to resume paused agent
 * - 10.4: Send SIGTERM for graceful shutdown
 * - 10.5: Send SIGKILL after 10-second timeout
 *
 * @module process-manager
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'

/**
 * Status of a managed process
 */
export type ProcessStatus = 'running' | 'paused' | 'stopped'

/**
 * Configuration for spawning a new process
 */
export interface SpawnConfig {
  /** Path to the Python script to execute */
  script: string
  /** Command line arguments */
  args: string[]
  /** Working directory for the process */
  cwd: string
  /** Environment variables to inject */
  env: Record<string, string>
  /** Callback for stdout data */
  onStdout: (data: string) => void
  /** Callback for stderr data */
  onStderr: (data: string) => void
  /** Callback when process exits */
  onExit: (code: number | null, signal: string | null) => void
}

/**
 * Represents a managed process with control methods
 */
export interface ManagedProcess {
  /** Process ID */
  pid: number
  /** Current process status */
  status: ProcessStatus
  /** Time when process was started */
  startTime: Date
  /** Kill the process with optional signal */
  kill(signal?: NodeJS.Signals): void
  /** Pause the process (SIGSTOP) */
  pause(): void
  /** Resume a paused process (SIGCONT) */
  resume(): void
}

/**
 * Interface for the Process Manager service
 */
export interface IProcessManager {
  /**
   * Spawn a new managed process
   * @param config - Configuration for the process
   * @returns The managed process instance
   */
  spawn(config: SpawnConfig): Promise<ManagedProcess>

  /**
   * Get a process by its PID
   * @param processId - The process ID
   * @returns The managed process or undefined if not found
   */
  getProcess(processId: number): ManagedProcess | undefined

  /**
   * Send a signal to a process
   * @param processId - The process ID
   * @param signal - The signal to send
   */
  sendSignal(processId: number, signal: NodeJS.Signals): void

  /**
   * Kill all managed processes
   */
  killAll(): Promise<void>
}

/**
 * Timeout in milliseconds before sending SIGKILL after SIGTERM
 */
const SIGKILL_TIMEOUT_MS = 10000

/**
 * Internal process wrapper that tracks state and provides control methods
 */
class ProcessWrapper implements ManagedProcess {
  public pid: number
  public status: ProcessStatus = 'running'
  public startTime: Date

  private process: ChildProcess
  private emitter: EventEmitter
  private killTimeoutId: NodeJS.Timeout | null = null

  constructor(process: ChildProcess, emitter: EventEmitter) {
    this.process = process
    this.pid = process.pid!
    this.startTime = new Date()
    this.emitter = emitter
  }

  /**
   * Kill the process with optional signal
   * Default is SIGTERM with 10-second timeout before SIGKILL
   */
  kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.status === 'stopped') {
      return
    }

    // Clear any existing kill timeout
    if (this.killTimeoutId) {
      clearTimeout(this.killTimeoutId)
      this.killTimeoutId = null
    }

    // If sending SIGTERM, set up timeout for SIGKILL
    if (signal === 'SIGTERM') {
      this.killTimeoutId = setTimeout(() => {
        if (this.status !== 'stopped') {
          this.process.kill('SIGKILL')
          this.status = 'stopped'
          this.emitter.emit('forcekill')
        }
      }, SIGKILL_TIMEOUT_MS)
    }

    const killed = this.process.kill(signal)
    if (killed && signal === 'SIGKILL') {
      this.status = 'stopped'
    }
  }

  /**
   * Pause the process by sending SIGSTOP
   * Note: SIGSTOP is not available on Windows
   */
  pause(): void {
    if (this.status !== 'running') {
      return
    }

    // On Windows, SIGSTOP is not supported
    // We'll use a platform-specific approach
    if (process.platform === 'win32') {
      // Windows doesn't support SIGSTOP, but we can track the state
      // The actual pause would need to be handled differently on Windows
      // For now, we'll emit an event and track state
      this.status = 'paused'
      this.emitter.emit('paused')
      return
    }

    const paused = this.process.kill('SIGSTOP')
    if (paused) {
      this.status = 'paused'
      this.emitter.emit('paused')
    }
  }

  /**
   * Resume a paused process by sending SIGCONT
   * Note: SIGCONT is not available on Windows
   */
  resume(): void {
    if (this.status !== 'paused') {
      return
    }

    // On Windows, SIGCONT is not supported
    if (process.platform === 'win32') {
      this.status = 'running'
      this.emitter.emit('resumed')
      return
    }

    const resumed = this.process.kill('SIGCONT')
    if (resumed) {
      this.status = 'running'
      this.emitter.emit('resumed')
    }
  }

  /**
   * Mark the process as stopped (called when process exits)
   */
  markStopped(): void {
    if (this.killTimeoutId) {
      clearTimeout(this.killTimeoutId)
      this.killTimeoutId = null
    }
    this.status = 'stopped'
  }

  /**
   * Get the underlying ChildProcess
   */
  getChildProcess(): ChildProcess {
    return this.process
  }
}

/**
 * Process Manager Service
 *
 * Manages spawning and controlling Python agent processes.
 * Handles process lifecycle, signal management, and cleanup.
 */
export class ProcessManager implements IProcessManager {
  private processes: Map<number, ProcessWrapper> = new Map()

  /**
   * Spawn a new managed process
   *
   * @param config - Configuration for the process
   * @returns Promise resolving to the managed process
   * @throws Error if process fails to spawn
   */
  async spawn(config: SpawnConfig): Promise<ManagedProcess> {
    return new Promise((resolve, reject) => {
      const emitter = new EventEmitter()

      // Merge environment variables with current process env
      const env = {
        ...process.env,
        ...config.env,
      }

      // Spawn the Python process
      const childProcess = spawn(config.env.PYTHON_PATH || 'python', [config.script, ...config.args], {
        cwd: config.cwd,
        env: env as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        // Detach on non-Windows to allow signal handling
        detached: process.platform !== 'win32',
      })

      // Handle spawn error
      childProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn process: ${error.message}`))
      })

      // Wait for spawn to complete
      childProcess.on('spawn', () => {
        if (!childProcess.pid) {
          reject(new Error('Process spawned but no PID assigned'))
          return
        }

        const wrapper = new ProcessWrapper(childProcess, emitter)
        this.processes.set(childProcess.pid, wrapper)

        // Set up stdout handler
        childProcess.stdout?.on('data', (data: Buffer) => {
          config.onStdout(data.toString())
        })

        // Set up stderr handler
        childProcess.stderr?.on('data', (data: Buffer) => {
          config.onStderr(data.toString())
        })

        // Set up exit handler
        childProcess.on('exit', (code, signal) => {
          wrapper.markStopped()
          config.onExit(code, signal)
        })

        // Set up close handler for cleanup
        childProcess.on('close', () => {
          wrapper.markStopped()
        })

        resolve(wrapper)
      })
    })
  }

  /**
   * Get a process by its PID
   *
   * @param processId - The process ID
   * @returns The managed process or undefined if not found
   */
  getProcess(processId: number): ManagedProcess | undefined {
    return this.processes.get(processId)
  }

  /**
   * Send a signal to a process
   *
   * @param processId - The process ID
   * @param signal - The signal to send
   * @throws Error if process not found
   */
  sendSignal(processId: number, signal: NodeJS.Signals): void {
    const wrapper = this.processes.get(processId)
    if (!wrapper) {
      throw new Error(`Process ${processId} not found`)
    }

    wrapper.getChildProcess().kill(signal)
  }

  /**
   * Kill all managed processes
   *
   * Sends SIGTERM to all processes and waits for them to exit.
   * After timeout, sends SIGKILL to force termination.
   */
  async killAll(): Promise<void> {
    const killPromises: Promise<void>[] = []

    for (const [pid, wrapper] of this.processes) {
      if (wrapper.status !== 'stopped') {
        killPromises.push(
          new Promise<void>((resolve) => {
            const childProcess = wrapper.getChildProcess()

            // Set up exit listener
            const onExit = () => {
              wrapper.markStopped()
              this.processes.delete(pid)
              resolve()
            }

            childProcess.once('exit', onExit)

            // Send SIGTERM
            wrapper.kill('SIGTERM')

            // Set up timeout for SIGKILL
            setTimeout(() => {
              if (wrapper.status !== 'stopped') {
                wrapper.kill('SIGKILL')
                // Give a moment for SIGKILL to take effect
                setTimeout(() => {
                  childProcess.removeListener('exit', onExit)
                  this.processes.delete(pid)
                  resolve()
                }, 100)
              }
            }, SIGKILL_TIMEOUT_MS)
          })
        )
      }
    }

    await Promise.all(killPromises)
  }

  /**
   * Remove a process from tracking (called after process exits)
   *
   * @param processId - The process ID to remove
   */
  removeProcess(processId: number): void {
    this.processes.delete(processId)
  }

  /**
   * Get all managed processes
   *
   * @returns Array of all managed processes
   */
  getAllProcesses(): ManagedProcess[] {
    return Array.from(this.processes.values())
  }

  /**
   * Check if a process exists and is running
   *
   * @param processId - The process ID
   * @returns True if process exists and is running
   */
  isRunning(processId: number): boolean {
    const wrapper = this.processes.get(processId)
    return wrapper?.status === 'running'
  }

  /**
   * Check if a process exists and is paused
   *
   * @param processId - The process ID
   * @returns True if process exists and is paused
   */
  isPaused(processId: number): boolean {
    const wrapper = this.processes.get(processId)
    return wrapper?.status === 'paused'
  }
}

/**
 * Build environment variables for agent execution
 *
 * Merges base environment with agent-specific configuration.
 * This is a helper function for preparing the env object for spawn.
 *
 * @param baseEnv - Base environment variables
 * @param agentConfig - Agent-specific configuration
 * @returns Merged environment variables
 */
export function buildAgentEnvironment(
  baseEnv: Record<string, string>,
  agentConfig: {
    anthropicAuthToken: string
    anthropicBaseUrl?: string
    apiTimeoutMs: number
    pythonPath: string
    customEnvVars: Record<string, string>
  }
): Record<string, string> {
  const env: Record<string, string> = { ...baseEnv }

  // Add Anthropic configuration
  env.ANTHROPIC_AUTH_TOKEN = agentConfig.anthropicAuthToken
  if (agentConfig.anthropicBaseUrl) {
    env.ANTHROPIC_BASE_URL = agentConfig.anthropicBaseUrl
  }
  env.API_TIMEOUT_MS = agentConfig.apiTimeoutMs.toString()
  env.PYTHON_PATH = agentConfig.pythonPath

  // Add custom environment variables
  for (const [key, value] of Object.entries(agentConfig.customEnvVars)) {
    env[key] = value
  }

  return env
}
