import { author as _author, name } from '~/package.json'

const author = typeof _author === 'string' ? _author : _author.name
const authorInKebabCase = author.replace(/\s+/g, '-')
const appId = `com.${authorInKebabCase}.${name}`.toLowerCase()

/**
 * @param {string} id
 * @description Create the app id using the name and author from package.json transformed to kebab case if the id is not provided.
 * @default 'com.{author}.{app}' - the author and app comes from package.json
 * @example
 * makeAppId('com.example.app')
 * // => 'com.example.app'
 */
export function makeAppId(id: string = appId): string {
  return id
}

/**
 *
 * @param {number} ms
 * @description Wait for a given number of milliseconds.
 * @example
 * await waitFor(1000) // Waits for 1 second
 */
export function waitFor(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Masks an API key for secure display, showing only the last 4 characters.
 * For keys with length > 4, replaces all but the last 4 characters with asterisks.
 * For keys with length <= 4, returns all asterisks.
 *
 * @param {string} apiKey - The API key to mask
 * @returns {string} The masked API key
 * @example
 * maskApiKey('sk-or-v1-abc123xyz789') // => '**************789'
 * maskApiKey('abc') // => '***'
 * maskApiKey('') // => ''
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) {
    return ''
  }

  const visibleChars = 4
  const keyLength = apiKey.length

  if (keyLength <= visibleChars) {
    return '*'.repeat(keyLength)
  }

  const maskedLength = keyLength - visibleChars
  const lastFourChars = apiKey.slice(-visibleChars)

  return '*'.repeat(maskedLength) + lastFourChars
}
