/**
 * Image Handler Utilities
 *
 * Provides functions for reading images as base64 and building prompts with images.
 * Supports common image formats: PNG, JPEG, GIF, WebP.
 *
 * Requirements:
 * - 8.1: Read images as base64 and include in prompts
 * - 8.2: Support common image formats (PNG, JPEG, GIF, WebP)
 * - 8.4: Format images as multi-part content blocks
 *
 * @module utils/image-handler
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ContentBlock } from '../providers/types'

// ============================================================================
// Types
// ============================================================================

/**
 * Supported image MIME types mapped from file extensions
 */
export const SUPPORTED_IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

/**
 * Image metadata stored with messages
 */
export interface ImageMetadata {
  /** Base64 encoded image data */
  data: string
  /** MIME type (image/png, image/jpeg, etc.) */
  mimeType: string
  /** Original filename */
  filename: string
  /** Original file path */
  path?: string
}

/**
 * Result of reading an image file
 */
export interface ReadImageResult {
  /** Whether the read was successful */
  success: boolean
  /** Image metadata if successful */
  image?: ImageMetadata
  /** Error message if unsuccessful */
  error?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a file extension is a supported image type
 *
 * @param ext - File extension (with or without leading dot)
 * @returns true if the extension is supported
 */
export function isSupportedImageType(ext: string): boolean {
  const normalizedExt = ext.startsWith('.')
    ? ext.toLowerCase()
    : `.${ext.toLowerCase()}`
  return normalizedExt in SUPPORTED_IMAGE_TYPES
}

/**
 * Get the MIME type for a file extension
 *
 * @param ext - File extension (with or without leading dot)
 * @returns MIME type string or undefined if not supported
 */
export function getMimeType(ext: string): string | undefined {
  const normalizedExt = ext.startsWith('.')
    ? ext.toLowerCase()
    : `.${ext.toLowerCase()}`
  return SUPPORTED_IMAGE_TYPES[normalizedExt]
}

/**
 * Get the list of supported image extensions
 *
 * @returns Array of supported extensions (with leading dots)
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(SUPPORTED_IMAGE_TYPES)
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Read an image file and encode as base64
 *
 * Reads the image file from disk, validates the format, and returns
 * the base64-encoded data along with metadata.
 *
 * @param imagePath - Path to the image file
 * @returns ImageMetadata object or null if the image cannot be read
 *
 * @example
 * ```typescript
 * const image = readImageAsBase64('/path/to/image.png')
 * if (image) {
 *   console.log(image.mimeType) // 'image/png'
 *   console.log(image.filename) // 'image.png'
 * }
 * ```
 */
export function readImageAsBase64(imagePath: string): ImageMetadata | null {
  try {
    // Validate file exists
    if (!fs.existsSync(imagePath)) {
      console.warn(`Image file not found: ${imagePath}`)
      return null
    }

    // Get and validate extension
    const ext = path.extname(imagePath).toLowerCase()
    const mimeType = SUPPORTED_IMAGE_TYPES[ext]

    if (!mimeType) {
      console.warn(
        `Unsupported image type: ${ext}. Supported types: ${getSupportedExtensions().join(', ')}`
      )
      return null
    }

    // Read and encode file
    const data = fs.readFileSync(imagePath)
    const base64 = data.toString('base64')

    return {
      data: base64,
      mimeType,
      filename: path.basename(imagePath),
      path: imagePath,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Failed to read image: ${imagePath}`, message)
    return null
  }
}

/**
 * Read an image file with detailed result information
 *
 * Similar to readImageAsBase64 but returns a result object with
 * success/failure information and error details.
 *
 * @param imagePath - Path to the image file
 * @returns ReadImageResult with success status and image or error
 *
 * @example
 * ```typescript
 * const result = readImageWithResult('/path/to/image.png')
 * if (result.success) {
 *   console.log(result.image?.mimeType)
 * } else {
 *   console.error(result.error)
 * }
 * ```
 */
export function readImageWithResult(imagePath: string): ReadImageResult {
  try {
    // Validate file exists
    if (!fs.existsSync(imagePath)) {
      return {
        success: false,
        error: `Image file not found: ${imagePath}`,
      }
    }

    // Get and validate extension
    const ext = path.extname(imagePath).toLowerCase()
    const mimeType = SUPPORTED_IMAGE_TYPES[ext]

    if (!mimeType) {
      return {
        success: false,
        error: `Unsupported image type: ${ext}. Supported types: ${getSupportedExtensions().join(', ')}`,
      }
    }

    // Read and encode file
    const data = fs.readFileSync(imagePath)
    const base64 = data.toString('base64')

    return {
      success: true,
      image: {
        data: base64,
        mimeType,
        filename: path.basename(imagePath),
        path: imagePath,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `Failed to read image: ${message}`,
    }
  }
}

/**
 * Read multiple images from file paths
 *
 * Reads multiple image files and returns an array of successfully
 * read images. Failed reads are logged but don't stop processing.
 *
 * @param imagePaths - Array of image file paths
 * @returns Array of ImageMetadata for successfully read images
 *
 * @example
 * ```typescript
 * const images = readMultipleImages(['/path/to/a.png', '/path/to/b.jpg'])
 * console.log(`Read ${images.length} images`)
 * ```
 */
export function readMultipleImages(imagePaths: string[]): ImageMetadata[] {
  const images: ImageMetadata[] = []

  for (const imagePath of imagePaths) {
    const image = readImageAsBase64(imagePath)
    if (image) {
      images.push(image)
    }
  }

  return images
}

/**
 * Build content blocks with images for the provider
 *
 * Creates an array of ContentBlock objects suitable for sending to
 * AI providers. Images are placed first, followed by the text content.
 *
 * @param text - Text content of the message
 * @param images - Array of ImageMetadata to include
 * @returns Array of ContentBlock objects
 *
 * @example
 * ```typescript
 * const images = readMultipleImages(['/path/to/screenshot.png'])
 * const blocks = buildPromptWithImages('What is in this image?', images)
 * // blocks contains image block(s) followed by text block
 * ```
 */
export function buildPromptWithImages(
  text: string,
  images: ImageMetadata[]
): ContentBlock[] {
  const blocks: ContentBlock[] = []

  // Add images first (provider expects images before text)
  for (const image of images) {
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mimeType,
        data: image.data,
      },
    })
  }

  // Add text content
  blocks.push({
    type: 'text',
    text,
  })

  return blocks
}

/**
 * Build content blocks from image paths and text
 *
 * Convenience function that reads images from paths and builds
 * the content blocks in one step.
 *
 * @param text - Text content of the message
 * @param imagePaths - Array of image file paths
 * @returns Array of ContentBlock objects
 *
 * @example
 * ```typescript
 * const blocks = buildPromptFromPaths(
 *   'Describe these images',
 *   ['/path/to/a.png', '/path/to/b.jpg']
 * )
 * ```
 */
export function buildPromptFromPaths(
  text: string,
  imagePaths: string[]
): ContentBlock[] {
  const images = readMultipleImages(imagePaths)
  return buildPromptWithImages(text, images)
}

/**
 * Validate that all image paths are readable and supported
 *
 * Checks each path without actually reading the full file content.
 * Useful for pre-validation before processing.
 *
 * @param imagePaths - Array of image file paths to validate
 * @returns Object with valid paths and any errors
 *
 * @example
 * ```typescript
 * const validation = validateImagePaths(['/path/to/a.png', '/invalid.txt'])
 * console.log(validation.valid) // ['/path/to/a.png']
 * console.log(validation.errors) // [{ path: '/invalid.txt', error: '...' }]
 * ```
 */
export function validateImagePaths(imagePaths: string[]): {
  valid: string[]
  errors: Array<{ path: string; error: string }>
} {
  const valid: string[] = []
  const errors: Array<{ path: string; error: string }> = []

  for (const imagePath of imagePaths) {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      errors.push({ path: imagePath, error: 'File not found' })
      continue
    }

    // Check if extension is supported
    const ext = path.extname(imagePath).toLowerCase()
    if (!SUPPORTED_IMAGE_TYPES[ext]) {
      errors.push({
        path: imagePath,
        error: `Unsupported image type: ${ext}`,
      })
      continue
    }

    valid.push(imagePath)
  }

  return { valid, errors }
}

/**
 * Decode base64 image data back to a Buffer
 *
 * Useful for testing round-trip encoding or saving images.
 *
 * @param base64Data - Base64 encoded image data
 * @returns Buffer containing the decoded image data
 *
 * @example
 * ```typescript
 * const image = readImageAsBase64('/path/to/image.png')
 * if (image) {
 *   const buffer = decodeBase64Image(image.data)
 *   fs.writeFileSync('/path/to/copy.png', buffer)
 * }
 * ```
 */
export function decodeBase64Image(base64Data: string): Buffer {
  return Buffer.from(base64Data, 'base64')
}
