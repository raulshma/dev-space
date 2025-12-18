/**
 * Link Detection Utility
 *
 * Detects file paths and URLs in terminal output for clickable links.
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

export interface DetectedLink {
  text: string
  type: 'file' | 'url'
  startIndex: number
  endIndex: number
}

/**
 * URL regex pattern
 * Matches http://, https://, and common URL patterns
 */
const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi

/**
 * File path regex patterns
 * Matches common file path patterns on Unix and Windows
 */
const UNIX_PATH_REGEX = /(?:\.\/|\/|~\/)[^\s:]+/g
const WINDOWS_PATH_REGEX = /[a-zA-Z]:\\[^\s:]+/g

/**
 * Detect URLs in text
 */
export function detectUrls(text: string): DetectedLink[] {
  const links: DetectedLink[] = []

  const regex = new RegExp(URL_REGEX)
  let match = regex.exec(text)
  while (match !== null) {
    links.push({
      text: match[0],
      type: 'url',
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
    match = regex.exec(text)
  }

  return links
}

/**
 * Detect file paths in text
 */
export function detectFilePaths(text: string): DetectedLink[] {
  const links: DetectedLink[] = []

  // Detect Unix-style paths
  const unixRegex = new RegExp(UNIX_PATH_REGEX)
  let unixMatch = unixRegex.exec(text)
  while (unixMatch !== null) {
    links.push({
      text: unixMatch[0],
      type: 'file',
      startIndex: unixMatch.index,
      endIndex: unixMatch.index + unixMatch[0].length,
    })
    unixMatch = unixRegex.exec(text)
  }

  // Detect Windows-style paths
  const windowsRegex = new RegExp(WINDOWS_PATH_REGEX)
  let windowsMatch = windowsRegex.exec(text)
  while (windowsMatch !== null) {
    links.push({
      text: windowsMatch[0],
      type: 'file',
      startIndex: windowsMatch.index,
      endIndex: windowsMatch.index + windowsMatch[0].length,
    })
    windowsMatch = windowsRegex.exec(text)
  }

  return links
}

/**
 * Detect all links (URLs and file paths) in text
 */
export function detectLinks(text: string): DetectedLink[] {
  const urls = detectUrls(text)
  const filePaths = detectFilePaths(text)

  // Combine and sort by start index
  const allLinks = [...urls, ...filePaths].sort(
    (a, b) => a.startIndex - b.startIndex
  )

  // Remove overlapping links (prefer URLs over file paths)
  const filteredLinks: DetectedLink[] = []
  let lastEndIndex = -1

  for (const link of allLinks) {
    if (link.startIndex >= lastEndIndex) {
      filteredLinks.push(link)
      lastEndIndex = link.endIndex
    }
  }

  return filteredLinks
}

/**
 * Validate if a detected link is likely a real file path
 * This helps filter out false positives
 */
export function isLikelyFilePath(path: string): boolean {
  // Check for common file extensions
  const hasExtension = /\.[a-zA-Z0-9]{1,10}$/.test(path)

  // Check for common path indicators
  const hasPathIndicators =
    path.startsWith('./') ||
    path.startsWith('../') ||
    path.startsWith('/') ||
    path.startsWith('~/') ||
    /^[a-zA-Z]:\\/.test(path)

  return hasExtension || hasPathIndicators
}

/**
 * Validate if a detected link is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
