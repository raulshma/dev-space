/**
 * Property-based tests for Output Buffer Service
 *
 * These tests verify that the output buffer correctly captures output
 * with timestamps and preserves ANSI escape codes.
 *
 * @module output-buffer.property.test
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { OutputBuffer } from './output-buffer'
import type { OutputStreamType } from 'shared/ai-types'

/**
 * Arbitrary generator for valid task IDs
 */
const arbitraryTaskId: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0)
  .map(s => `task-${s.trim()}`)

/**
 * Arbitrary generator for output stream types
 */
const arbitraryStreamType: fc.Arbitrary<OutputStreamType> = fc.constantFrom(
  'stdout',
  'stderr'
)

/**
 * Arbitrary generator for output content (may include ANSI codes)
 */
const arbitraryContent: fc.Arbitrary<string> = fc.string({
  minLength: 0,
  maxLength: 500,
})

/**
 * Arbitrary generator for ANSI escape codes
 * Common ANSI codes for colors, formatting, cursor movement
 */
const ansiCodes = [
  '\x1b[0m', // Reset
  '\x1b[1m', // Bold
  '\x1b[2m', // Dim
  '\x1b[3m', // Italic
  '\x1b[4m', // Underline
  '\x1b[31m', // Red
  '\x1b[32m', // Green
  '\x1b[33m', // Yellow
  '\x1b[34m', // Blue
  '\x1b[35m', // Magenta
  '\x1b[36m', // Cyan
  '\x1b[37m', // White
  '\x1b[40m', // Black background
  '\x1b[41m', // Red background
  '\x1b[42m', // Green background
  '\x1b[91m', // Bright red
  '\x1b[92m', // Bright green
  '\x1b[93m', // Bright yellow
  '\x1b[2K', // Clear line
  '\x1b[H', // Cursor home
  '\x1b[1A', // Cursor up
  '\x1b[1B', // Cursor down
  '\x1b[1C', // Cursor forward
  '\x1b[1D', // Cursor back
  '\x1b[?25h', // Show cursor
  '\x1b[?25l', // Hide cursor
]

/**
 * Arbitrary generator for content with ANSI escape codes
 */
const arbitraryContentWithAnsi: fc.Arbitrary<string> = fc
  .array(
    fc.oneof(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.constantFrom(...ansiCodes)
    ),
    { minLength: 1, maxLength: 10 }
  )
  .map(parts => parts.join(''))

/**
 * Arbitrary generator for output line data
 */
const arbitraryOutputData = fc.record({
  taskId: arbitraryTaskId,
  content: arbitraryContent,
  stream: arbitraryStreamType,
})

/**
 * Arbitrary generator for multiple output lines for the same task
 */
const arbitraryOutputLines = (taskId: string) =>
  fc
    .array(
      fc.record({
        content: arbitraryContent,
        stream: arbitraryStreamType,
      }),
      { minLength: 1, maxLength: 20 }
    )
    .map(lines => lines.map(line => ({ ...line, taskId })))

describe('Output Buffer Property Tests', () => {
  let outputBuffer: OutputBuffer

  beforeEach(() => {
    outputBuffer = new OutputBuffer()
  })

  /**
   * **Feature: ai-agent-rework, Property 15: Output Capture with Timestamps**
   * **Validates: Requirements 9.1**
   *
   * For any line of output from an agent process, the stored OutputLine
   * SHALL have a timestamp within 100ms of when the output was received.
   */
  describe('Property 15: Output Capture with Timestamps', () => {
    it('appended output has timestamp within 100ms of append time', () => {
      fc.assert(
        fc.property(arbitraryOutputData, data => {
          const buffer = new OutputBuffer()

          const beforeAppend = Date.now()
          const line = buffer.append(data.taskId, data.content, data.stream)
          const afterAppend = Date.now()

          // Timestamp should be within the window of the append operation
          const timestampMs = line.timestamp.getTime()

          // The timestamp should be >= beforeAppend and <= afterAppend
          // This ensures the timestamp was captured during the append
          return timestampMs >= beforeAppend && timestampMs <= afterAppend
        }),
        { numRuns: 100 }
      )
    })

    it('multiple appends have monotonically increasing timestamps', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          fc.array(arbitraryContent, { minLength: 2, maxLength: 20 }),
          (taskId, contents) => {
            const buffer = new OutputBuffer()

            const lines = contents.map(content =>
              buffer.append(taskId, content, 'stdout')
            )

            // Each timestamp should be >= the previous one
            for (let i = 1; i < lines.length; i++) {
              if (
                lines[i].timestamp.getTime() < lines[i - 1].timestamp.getTime()
              ) {
                return false
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('timestamp is a valid Date object', () => {
      fc.assert(
        fc.property(arbitraryOutputData, data => {
          const buffer = new OutputBuffer()
          const line = buffer.append(data.taskId, data.content, data.stream)

          // Timestamp should be a valid Date
          return (
            line.timestamp instanceof Date &&
            !Number.isNaN(line.timestamp.getTime()) &&
            line.timestamp.getTime() > 0
          )
        }),
        { numRuns: 100 }
      )
    })

    it('retrieved lines preserve their original timestamps', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          fc.array(arbitraryContent, { minLength: 1, maxLength: 10 }),
          (taskId, contents) => {
            const buffer = new OutputBuffer()

            // Append lines and record timestamps
            const appendedLines = contents.map(content =>
              buffer.append(taskId, content, 'stdout')
            )

            // Retrieve lines
            const retrievedLines = buffer.getLines(taskId)

            // Timestamps should match
            if (appendedLines.length !== retrievedLines.length) {
              return false
            }

            for (let i = 0; i < appendedLines.length; i++) {
              if (
                appendedLines[i].timestamp.getTime() !==
                retrievedLines[i].timestamp.getTime()
              ) {
                return false
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('each output line has taskId, timestamp, content, and stream', () => {
      fc.assert(
        fc.property(arbitraryOutputData, data => {
          const buffer = new OutputBuffer()
          const line = buffer.append(data.taskId, data.content, data.stream)

          // All required fields should be present
          return (
            line.taskId === data.taskId &&
            line.timestamp instanceof Date &&
            line.content === data.content &&
            (line.stream === 'stdout' || line.stream === 'stderr')
          )
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: ai-agent-rework, Property 16: ANSI Code Preservation**
   * **Validates: Requirements 9.4**
   *
   * For any output containing ANSI escape codes, the stored content
   * SHALL preserve the original escape sequences without modification.
   */
  describe('Property 16: ANSI Code Preservation', () => {
    it('ANSI escape codes are preserved exactly in stored content', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          arbitraryContentWithAnsi,
          arbitraryStreamType,
          (taskId, content, stream) => {
            const buffer = new OutputBuffer()
            const line = buffer.append(taskId, content, stream)

            // Content should be exactly preserved, including ANSI codes
            return line.content === content
          }
        ),
        { numRuns: 100 }
      )
    })

    it('retrieved lines preserve ANSI codes exactly', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          fc.array(arbitraryContentWithAnsi, { minLength: 1, maxLength: 10 }),
          (taskId, contents) => {
            const buffer = new OutputBuffer()

            // Append lines with ANSI codes
            for (const content of contents) {
              buffer.append(taskId, content, 'stdout')
            }

            // Retrieve and verify
            const retrievedLines = buffer.getLines(taskId)

            if (retrievedLines.length !== contents.length) {
              return false
            }

            for (let i = 0; i < contents.length; i++) {
              if (retrievedLines[i].content !== contents[i]) {
                return false
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('specific ANSI codes are preserved', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          fc.constantFrom(...ansiCodes),
          fc.string({ minLength: 1, maxLength: 20 }),
          (taskId, ansiCode, text) => {
            const buffer = new OutputBuffer()

            // Create content with ANSI code
            const content = `${ansiCode}${text}${ansiCode}`
            const line = buffer.append(taskId, content, 'stdout')

            // ANSI code should be preserved
            return line.content.includes(ansiCode) && line.content === content
          }
        ),
        { numRuns: 100 }
      )
    })

    it('complex ANSI sequences are preserved', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          fc.array(fc.constantFrom(...ansiCodes), {
            minLength: 2,
            maxLength: 5,
          }),
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
            minLength: 2,
            maxLength: 5,
          }),
          (taskId, codes, texts) => {
            const buffer = new OutputBuffer()

            // Interleave ANSI codes and text
            let content = ''
            const maxLen = Math.max(codes.length, texts.length)
            for (let i = 0; i < maxLen; i++) {
              if (i < codes.length) content += codes[i]
              if (i < texts.length) content += texts[i]
            }

            const line = buffer.append(taskId, content, 'stdout')

            // Content should be exactly preserved
            return line.content === content
          }
        ),
        { numRuns: 100 }
      )
    })

    it('empty content is preserved', () => {
      fc.assert(
        fc.property(arbitraryTaskId, arbitraryStreamType, (taskId, stream) => {
          const buffer = new OutputBuffer()
          const line = buffer.append(taskId, '', stream)

          return line.content === ''
        }),
        { numRuns: 100 }
      )
    })

    it('content with only ANSI codes is preserved', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          fc.array(fc.constantFrom(...ansiCodes), {
            minLength: 1,
            maxLength: 5,
          }),
          (taskId, codes) => {
            const buffer = new OutputBuffer()
            const content = codes.join('')
            const line = buffer.append(taskId, content, 'stdout')

            return line.content === content
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Additional buffer invariant tests
   */
  describe('Buffer Invariants', () => {
    it('getLineCount matches number of appended lines', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          fc.array(arbitraryContent, { minLength: 0, maxLength: 20 }),
          (taskId, contents) => {
            const buffer = new OutputBuffer()

            for (const content of contents) {
              buffer.append(taskId, content, 'stdout')
            }

            return buffer.getLineCount(taskId) === contents.length
          }
        ),
        { numRuns: 100 }
      )
    })

    it('getLines returns all appended lines in order', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          fc.array(arbitraryContent, { minLength: 0, maxLength: 20 }),
          (taskId, contents) => {
            const buffer = new OutputBuffer()

            for (const content of contents) {
              buffer.append(taskId, content, 'stdout')
            }

            const lines = buffer.getLines(taskId)

            if (lines.length !== contents.length) {
              return false
            }

            for (let i = 0; i < contents.length; i++) {
              if (lines[i].content !== contents[i]) {
                return false
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('clear removes all lines for a task', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          fc.array(arbitraryContent, { minLength: 1, maxLength: 10 }),
          (taskId, contents) => {
            const buffer = new OutputBuffer()

            for (const content of contents) {
              buffer.append(taskId, content, 'stdout')
            }

            buffer.clear(taskId)

            return (
              buffer.getLineCount(taskId) === 0 &&
              buffer.getLines(taskId).length === 0
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('different tasks have isolated buffers', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          arbitraryTaskId,
          fc.array(arbitraryContent, { minLength: 1, maxLength: 5 }),
          fc.array(arbitraryContent, { minLength: 1, maxLength: 5 }),
          (taskId1, taskId2, contents1, contents2) => {
            // Skip if task IDs are the same
            if (taskId1 === taskId2) {
              return true
            }

            const buffer = new OutputBuffer()

            // Append to task 1
            for (const content of contents1) {
              buffer.append(taskId1, content, 'stdout')
            }

            // Append to task 2
            for (const content of contents2) {
              buffer.append(taskId2, content, 'stderr')
            }

            // Each task should have its own lines
            const lines1 = buffer.getLines(taskId1)
            const lines2 = buffer.getLines(taskId2)

            return (
              lines1.length === contents1.length &&
              lines2.length === contents2.length &&
              lines1.every(l => l.taskId === taskId1) &&
              lines2.every(l => l.taskId === taskId2)
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('subscribers receive appended lines', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          fc.array(arbitraryContent, { minLength: 1, maxLength: 10 }),
          (taskId, contents) => {
            const buffer = new OutputBuffer()
            const receivedLines: string[] = []

            buffer.subscribe(taskId, line => {
              receivedLines.push(line.content)
            })

            for (const content of contents) {
              buffer.append(taskId, content, 'stdout')
            }

            // All lines should have been received
            if (receivedLines.length !== contents.length) {
              return false
            }

            for (let i = 0; i < contents.length; i++) {
              if (receivedLines[i] !== contents[i]) {
                return false
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('unsubscribe stops receiving lines', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          fc.array(arbitraryContent, { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 1, max: 9 }),
          (taskId, contents, unsubscribeAfter) => {
            const buffer = new OutputBuffer()
            const receivedLines: string[] = []

            const unsubscribe = buffer.subscribe(taskId, line => {
              receivedLines.push(line.content)
            })

            // Append some lines
            const actualUnsubscribeAfter = Math.min(
              unsubscribeAfter,
              contents.length - 1
            )
            for (let i = 0; i < actualUnsubscribeAfter; i++) {
              buffer.append(taskId, contents[i], 'stdout')
            }

            // Unsubscribe
            unsubscribe()

            // Append remaining lines
            for (let i = actualUnsubscribeAfter; i < contents.length; i++) {
              buffer.append(taskId, contents[i], 'stdout')
            }

            // Should only have received lines before unsubscribe
            return receivedLines.length === actualUnsubscribeAfter
          }
        ),
        { numRuns: 100 }
      )
    })

    it('getLines with fromIndex returns subset of lines', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          fc.array(arbitraryContent, { minLength: 1, maxLength: 20 }),
          fc.nat({ max: 25 }),
          (taskId, contents, fromIndex) => {
            const buffer = new OutputBuffer()

            for (const content of contents) {
              buffer.append(taskId, content, 'stdout')
            }

            const allLines = buffer.getLines(taskId)
            const partialLines = buffer.getLines(taskId, fromIndex)

            // Should return lines from fromIndex onwards
            const expectedLength = Math.max(0, contents.length - fromIndex)
            return partialLines.length === expectedLength
          }
        ),
        { numRuns: 100 }
      )
    })

    it('stream type is preserved correctly', () => {
      fc.assert(
        fc.property(
          arbitraryTaskId,
          arbitraryContent,
          arbitraryStreamType,
          (taskId, content, stream) => {
            const buffer = new OutputBuffer()
            const line = buffer.append(taskId, content, stream)

            return line.stream === stream
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
