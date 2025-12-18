/**
 * Property-based tests for shared utility functions
 *
 * These tests verify that utility functions maintain their invariants
 * across all valid inputs.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { maskApiKey } from './utils'

describe('Utils Property Tests', () => {
  /**
   * **Feature: ai-agent-rework, Property 3: API Key Masking**
   * **Validates: Requirements 2.3**
   *
   * For any stored API key of length N where N > 4, the masked representation
   * SHALL show only the last 4 characters with the rest replaced by asterisks.
   */
  describe('maskApiKey', () => {
    it('shows only last 4 characters for keys longer than 4 characters', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 5 }), apiKey => {
          const masked = maskApiKey(apiKey)
          const lastFour = apiKey.slice(-4)

          // The masked key should end with the last 4 characters
          expect(masked.endsWith(lastFour)).toBe(true)

          // The masked key should have the same length as the original
          expect(masked.length).toBe(apiKey.length)

          // All characters except the last 4 should be asterisks
          const maskedPortion = masked.slice(0, -4)
          expect(maskedPortion).toBe('*'.repeat(apiKey.length - 4))

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('returns all asterisks for keys with 4 or fewer characters', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 4 }), apiKey => {
          const masked = maskApiKey(apiKey)

          // The masked key should be all asterisks
          expect(masked).toBe('*'.repeat(apiKey.length))

          // The masked key should have the same length as the original
          expect(masked.length).toBe(apiKey.length)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('preserves the length of the original key', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), apiKey => {
          const masked = maskApiKey(apiKey)
          return masked.length === apiKey.length
        }),
        { numRuns: 100 }
      )
    })

    it('returns empty string for empty input', () => {
      expect(maskApiKey('')).toBe('')
    })

    it('never reveals more than 4 characters', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), apiKey => {
          const masked = maskApiKey(apiKey)

          // Count non-asterisk characters
          const visibleChars = masked.split('').filter(c => c !== '*').length

          // Should never reveal more than 4 characters
          return visibleChars <= 4
        }),
        { numRuns: 100 }
      )
    })

    it('masked portion contains only asterisks', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 5 }), apiKey => {
          const masked = maskApiKey(apiKey)
          const maskedPortion = masked.slice(0, -4)

          // Every character in the masked portion should be an asterisk
          return maskedPortion.split('').every(c => c === '*')
        }),
        { numRuns: 100 }
      )
    })
  })
})
