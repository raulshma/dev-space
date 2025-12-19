/**
 * Developer Tools Service
 * Provides system-level utilities for port and process management
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  PortInfo,
  PortListResponse,
  PortKillResponse,
  ProcessInfo,
  TaskListResponse,
  TaskKillResponse,
} from 'shared/devtools-types'

const execAsync = promisify(exec)

export class DevToolsService {
  private isWindows = process.platform === 'win32'
  private isMac = process.platform === 'darwin'

  /**
   * List all ports with listening processes
   */
  async listPorts(filter?: string): Promise<PortListResponse> {
    try {
      const ports = this.isWindows
        ? await this.listPortsWindows()
        : await this.listPortsUnix()

      const filtered = filter
        ? ports.filter(
            p =>
              p.port.toString().includes(filter) ||
              p.processName.toLowerCase().includes(filter.toLowerCase())
          )
        : ports

      return { ports: filtered }
    } catch (error) {
      return {
        ports: [],
        error: error instanceof Error ? error.message : 'Failed to list ports',
      }
    }
  }

  /**
   * Kill process on a specific port
   */
  async killPort(port: number): Promise<PortKillResponse> {
    try {
      if (this.isWindows) {
        await this.killPortWindows(port)
      } else {
        await this.killPortUnix(port)
      }
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to kill port',
      }
    }
  }

  /**
   * List running processes
   */
  async listTasks(filter?: string): Promise<TaskListResponse> {
    try {
      const processes = this.isWindows
        ? await this.listTasksWindows()
        : await this.listTasksUnix()

      const filtered = filter
        ? processes.filter(
            p =>
              p.name.toLowerCase().includes(filter.toLowerCase()) ||
              p.pid.toString().includes(filter)
          )
        : processes

      // Sort by CPU usage descending
      filtered.sort((a, b) => b.cpu - a.cpu)

      return { processes: filtered.slice(0, 100) }
    } catch (error) {
      return {
        processes: [],
        error: error instanceof Error ? error.message : 'Failed to list tasks',
      }
    }
  }

  /**
   * Kill a process by PID
   */
  async killTask(pid: number, force = false): Promise<TaskKillResponse> {
    try {
      if (this.isWindows) {
        const forceFlag = force ? '/F' : ''
        await execAsync(`taskkill ${forceFlag} /PID ${pid}`)
      } else {
        const signal = force ? '-9' : '-15'
        await execAsync(`kill ${signal} ${pid}`)
      }
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to kill task',
      }
    }
  }

  // ============================================================================
  // Windows implementations
  // ============================================================================

  private async listPortsWindows(): Promise<PortInfo[]> {
    const { stdout } = await execAsync('netstat -ano -p TCP')
    const lines = stdout.split('\n').slice(4) // Skip header lines
    const ports: PortInfo[] = []
    const pidToName = await this.getPidToNameMapWindows()

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 5 && parts[3] === 'LISTENING') {
        const localAddr = parts[1]
        const portMatch = localAddr.match(/:(\d+)$/)
        if (portMatch) {
          const port = parseInt(portMatch[1], 10)
          const pid = parseInt(parts[4], 10)
          ports.push({
            port,
            pid,
            processName: pidToName.get(pid) || 'Unknown',
            protocol: 'tcp',
            state: 'LISTENING',
          })
        }
      }
    }

    return this.deduplicatePorts(ports)
  }

  private async getPidToNameMapWindows(): Promise<Map<number, string>> {
    const map = new Map<number, string>()
    try {
      // Use PowerShell for better compatibility (wmic is deprecated)
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-Process | Select-Object Id,ProcessName | ConvertTo-Json -Compress"',
        { maxBuffer: 10 * 1024 * 1024 }
      )
      const data = JSON.parse(stdout)
      const items = Array.isArray(data) ? data : [data]

      for (const item of items) {
        if (item.Id && item.ProcessName) {
          map.set(item.Id, item.ProcessName)
        }
      }
    } catch {
      // Fallback to tasklist if PowerShell fails
      try {
        const { stdout } = await execAsync('tasklist /FO CSV /NH')
        const lines = stdout.split('\n')
        for (const line of lines) {
          const match = line.match(/"([^"]+)","(\d+)"/)
          if (match) {
            const name = match[1]
            const pid = parseInt(match[2], 10)
            if (!isNaN(pid)) {
              map.set(pid, name)
            }
          }
        }
      } catch {
        // Ignore errors, return partial map
      }
    }
    return map
  }

  private async killPortWindows(port: number): Promise<void> {
    const { stdout } = await execAsync(
      `netstat -ano -p TCP | findstr :${port}`
    )
    const lines = stdout.split('\n')
    const pids = new Set<number>()

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 5) {
        const localAddr = parts[1]
        if (localAddr.endsWith(`:${port}`)) {
          const pid = parseInt(parts[4], 10)
          if (!isNaN(pid) && pid > 0) {
            pids.add(pid)
          }
        }
      }
    }

    if (pids.size === 0) {
      throw new Error(`No process found on port ${port}`)
    }

    for (const pid of pids) {
      await execAsync(`taskkill /F /PID ${pid}`)
    }
  }

  private async listTasksWindows(): Promise<ProcessInfo[]> {
    // Use PowerShell Get-Process for better compatibility (wmic is deprecated)
    const { stdout } = await execAsync(
      'powershell -NoProfile -Command "Get-Process | Select-Object Id,ProcessName,CPU,WorkingSet64 | ConvertTo-Json -Compress"',
      { maxBuffer: 10 * 1024 * 1024 }
    )
    const processes: ProcessInfo[] = []

    try {
      const data = JSON.parse(stdout)
      const items = Array.isArray(data) ? data : [data]

      for (const item of items) {
        const pid = item.Id
        const name = item.ProcessName || 'Unknown'
        const cpu = item.CPU || 0
        const memory = (item.WorkingSet64 || 0) / (1024 * 1024) // Convert to MB

        if (pid && pid > 0) {
          processes.push({
            pid,
            name,
            cpu: Math.round(cpu * 10) / 10,
            memory: Math.round(memory * 10) / 10,
          })
        }
      }
    } catch {
      // Fallback to tasklist if PowerShell fails
      const { stdout: tasklistOutput } = await execAsync('tasklist /FO CSV /NH')
      const lines = tasklistOutput.split('\n')

      for (const line of lines) {
        const match = line.match(/"([^"]+)","(\d+)","[^"]+","[^"]+","([\d,]+) K"/)
        if (match) {
          const name = match[1]
          const pid = parseInt(match[2], 10)
          const memory = parseInt(match[3].replace(/,/g, ''), 10) / 1024 // Convert KB to MB

          if (!isNaN(pid) && pid > 0) {
            processes.push({
              pid,
              name,
              cpu: 0,
              memory: Math.round(memory * 10) / 10,
            })
          }
        }
      }
    }

    return processes
  }

  // ============================================================================
  // Unix/Mac implementations
  // ============================================================================

  private async listPortsUnix(): Promise<PortInfo[]> {
    const cmd = this.isMac
      ? 'lsof -iTCP -sTCP:LISTEN -n -P'
      : 'ss -tlnp'

    const { stdout } = await execAsync(cmd)
    const ports: PortInfo[] = []

    if (this.isMac) {
      const lines = stdout.split('\n').slice(1)
      for (const line of lines) {
        const parts = line.split(/\s+/)
        if (parts.length >= 9) {
          const name = parts[0]
          const pid = parseInt(parts[1], 10)
          const addrPort = parts[8]
          const portMatch = addrPort.match(/:(\d+)$/)
          if (portMatch) {
            ports.push({
              port: parseInt(portMatch[1], 10),
              pid,
              processName: name,
              protocol: 'tcp',
              state: 'LISTEN',
            })
          }
        }
      }
    } else {
      // Linux ss output
      const lines = stdout.split('\n').slice(1)
      for (const line of lines) {
        const parts = line.split(/\s+/)
        if (parts.length >= 6) {
          const localAddr = parts[3]
          const portMatch = localAddr.match(/:(\d+)$/)
          const processInfo = parts[5] || ''
          const pidMatch = processInfo.match(/pid=(\d+)/)
          const nameMatch = processInfo.match(/\("([^"]+)"/)

          if (portMatch) {
            ports.push({
              port: parseInt(portMatch[1], 10),
              pid: pidMatch ? parseInt(pidMatch[1], 10) : 0,
              processName: nameMatch ? nameMatch[1] : 'Unknown',
              protocol: 'tcp',
              state: 'LISTEN',
            })
          }
        }
      }
    }

    return this.deduplicatePorts(ports)
  }

  private async killPortUnix(port: number): Promise<void> {
    const cmd = this.isMac
      ? `lsof -ti:${port}`
      : `ss -tlnp | grep :${port} | awk '{print $6}' | grep -oP 'pid=\\K\\d+'`

    const { stdout } = await execAsync(cmd)
    const pids = stdout
      .trim()
      .split('\n')
      .filter(p => p)
      .map(p => parseInt(p, 10))
      .filter(p => !isNaN(p) && p > 0)

    if (pids.length === 0) {
      throw new Error(`No process found on port ${port}`)
    }

    for (const pid of pids) {
      await execAsync(`kill -9 ${pid}`)
    }
  }

  private async listTasksUnix(): Promise<ProcessInfo[]> {
    const cmd = this.isMac
      ? 'ps -axo pid,comm,%cpu,rss'
      : 'ps -eo pid,comm,%cpu,rss --sort=-%cpu'

    const { stdout } = await execAsync(cmd)
    const lines = stdout.split('\n').slice(1)
    const processes: ProcessInfo[] = []

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 4) {
        const pid = parseInt(parts[0], 10)
        const name = parts[1]
        const cpu = parseFloat(parts[2])
        const memory = parseInt(parts[3], 10) / 1024 // Convert KB to MB

        if (!isNaN(pid) && pid > 0) {
          processes.push({
            pid,
            name,
            cpu: Math.round(cpu * 10) / 10,
            memory: Math.round(memory * 10) / 10,
          })
        }
      }
    }

    return processes
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private deduplicatePorts(ports: PortInfo[]): PortInfo[] {
    const seen = new Map<number, PortInfo>()
    for (const port of ports) {
      if (!seen.has(port.port)) {
        seen.set(port.port, port)
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.port - b.port)
  }
}

// Singleton instance
let devToolsService: DevToolsService | null = null

export function getDevToolsService(): DevToolsService {
  if (!devToolsService) {
    devToolsService = new DevToolsService()
  }
  return devToolsService
}
