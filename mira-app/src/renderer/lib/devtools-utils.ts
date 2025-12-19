/**
 * DevTools Utility Functions
 * Client-side utilities for JWT decoding and JSON formatting
 */

// ============================================================================
// JWT Decoder
// ============================================================================

export interface JWTDecodeResult {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  isExpired: boolean
  expiresAt?: Date
  issuedAt?: Date
  error?: string
}

export function decodeJWT(token: string): JWTDecodeResult {
  try {
    const parts = token.trim().split('.')
    if (parts.length !== 3) {
      return {
        header: {},
        payload: {},
        signature: '',
        isExpired: false,
        error: 'Invalid JWT format: expected 3 parts separated by dots',
      }
    }

    const [headerB64, payloadB64, signature] = parts

    const header = JSON.parse(base64UrlDecode(headerB64))
    const payload = JSON.parse(base64UrlDecode(payloadB64))

    const now = Math.floor(Date.now() / 1000)
    const exp = payload.exp as number | undefined
    const iat = payload.iat as number | undefined

    return {
      header,
      payload,
      signature,
      isExpired: exp ? exp < now : false,
      expiresAt: exp ? new Date(exp * 1000) : undefined,
      issuedAt: iat ? new Date(iat * 1000) : undefined,
    }
  } catch (error) {
    return {
      header: {},
      payload: {},
      signature: '',
      isExpired: false,
      error: error instanceof Error ? error.message : 'Failed to decode JWT',
    }
  }
}

function base64UrlDecode(str: string): string {
  // Replace URL-safe characters
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  // Add padding if needed
  const padding = base64.length % 4
  if (padding) {
    base64 += '='.repeat(4 - padding)
  }
  return atob(base64)
}

// ============================================================================
// JSON Formatter
// ============================================================================

export interface JSONFormatResult {
  formatted: string
  valid: boolean
  error?: string
  errorPosition?: { line: number; column: number }
}

export function formatJSON(
  input: string,
  indent = 2,
  sortKeys = false
): JSONFormatResult {
  try {
    const parsed = JSON.parse(input)
    const formatted = sortKeys
      ? JSON.stringify(sortObjectKeys(parsed), null, indent)
      : JSON.stringify(parsed, null, indent)

    return { formatted, valid: true }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Invalid JSON'
    const position = parseJSONErrorPosition(errorMessage)

    return {
      formatted: input,
      valid: false,
      error: errorMessage,
      errorPosition: position,
    }
  }
}

export function minifyJSON(input: string): JSONFormatResult {
  try {
    const parsed = JSON.parse(input)
    return { formatted: JSON.stringify(parsed), valid: true }
  } catch (error) {
    return {
      formatted: input,
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}

export function validateJSON(input: string): JSONFormatResult {
  try {
    JSON.parse(input)
    return { formatted: input, valid: true }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Invalid JSON'
    return {
      formatted: input,
      valid: false,
      error: errorMessage,
      errorPosition: parseJSONErrorPosition(errorMessage),
    }
  }
}

function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }
  if (obj !== null && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key])
    }
    return sorted
  }
  return obj
}

function parseJSONErrorPosition(
  errorMessage: string
): { line: number; column: number } | undefined {
  // Try to extract position from error message
  // Common format: "at position X" or "at line X column Y"
  const posMatch = errorMessage.match(/position\s+(\d+)/i)
  if (posMatch) {
    return { line: 1, column: parseInt(posMatch[1], 10) }
  }

  const lineColMatch = errorMessage.match(/line\s+(\d+)\s+column\s+(\d+)/i)
  if (lineColMatch) {
    return {
      line: parseInt(lineColMatch[1], 10),
      column: parseInt(lineColMatch[2], 10),
    }
  }

  return undefined
}
