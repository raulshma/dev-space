/**
 * Developer Tools Types
 * Types for port killer, task killer, JWT decoder, and JSON formatter utilities
 */

// ============================================================================
// Port Killer Types
// ============================================================================

export interface PortInfo {
  port: number
  pid: number
  processName: string
  protocol: 'tcp' | 'udp'
  state: string
}

export interface PortKillRequest {
  port: number
}

export interface PortKillResponse {
  success: boolean
  error?: string
}

export interface PortListRequest {
  filter?: string
}

export interface PortListResponse {
  ports: PortInfo[]
  error?: string
}

// ============================================================================
// Task Killer Types
// ============================================================================

export interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memory: number
  command?: string
}

export interface TaskKillRequest {
  pid: number
  force?: boolean
}

export interface TaskKillResponse {
  success: boolean
  error?: string
}

export interface TaskListRequest {
  filter?: string
}

export interface TaskListResponse {
  processes: ProcessInfo[]
  error?: string
}

// ============================================================================
// JWT Decoder Types
// ============================================================================

export interface JWTHeader {
  alg: string
  typ?: string
  kid?: string
  [key: string]: unknown
}

export interface JWTPayload {
  iss?: string
  sub?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  iat?: number
  jti?: string
  [key: string]: unknown
}

export interface JWTDecodeResult {
  header: JWTHeader
  payload: JWTPayload
  signature: string
  isExpired: boolean
  expiresAt?: Date
  issuedAt?: Date
}

// ============================================================================
// JSON Formatter Types
// ============================================================================

export interface JSONFormatOptions {
  indent?: number
  sortKeys?: boolean
}

export interface JSONValidationResult {
  valid: boolean
  error?: string
  errorPosition?: {
    line: number
    column: number
  }
}

// ============================================================================
// IPC Channel Constants
// ============================================================================

export const DEVTOOLS_IPC_CHANNELS = {
  // Port operations
  PORT_LIST: 'devtools:port:list',
  PORT_KILL: 'devtools:port:kill',

  // Task operations
  TASK_LIST: 'devtools:task:list',
  TASK_KILL: 'devtools:task:kill',
} as const
