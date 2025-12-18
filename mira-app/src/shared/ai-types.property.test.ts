/**
 * Property-based tests for AI types serialization
 *
 * These tests verify that the serialization/deserialization functions
 * maintain data integrity across all valid inputs.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  type ConversationMessage,
  serializeMessage,
  deserializeMessage,
  serializeMessages,
  deserializeMessages,
} from './ai-types'

/**
 * Arbitrary generator for valid Date objects
 * Ensures dates are always valid (not NaN) and within reasonable bounds
 */
const arbitraryValidDate: fc.Arbitrary<Date> = fc
  .integer({ min: 946684800000, max: 4102444800000 }) // 2000-01-01 to 2100-01-01 in ms
  .map(ms => new Date(ms))

/**
 * Arbitrary generator for ConversationMessage
 * Generates valid messages with all possible field combinations
 */
const arbitraryConversationMessage: fc.Arbitrary<ConversationMessage> =
  fc.record({
    id: fc.uuid(),
    role: fc.constantFrom('user', 'assistant', 'system') as fc.Arbitrary<
      'user' | 'assistant' | 'system'
    >,
    content: fc.string(),
    timestamp: arbitraryValidDate,
    model: fc.option(fc.string(), { nil: undefined }),
    metadata: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), {
      nil: undefined,
    }),
  })

/**
 * Helper function to compare two ConversationMessages for equality
 * Handles Date comparison and optional fields properly
 */
function messagesAreEqual(
  a: ConversationMessage,
  b: ConversationMessage
): boolean {
  // Compare required fields
  if (a.id !== b.id) return false
  if (a.role !== b.role) return false
  if (a.content !== b.content) return false
  if (a.timestamp.getTime() !== b.timestamp.getTime()) return false

  // Compare optional model field
  if (a.model !== b.model) return false

  // Compare optional metadata field
  if (a.metadata === undefined && b.metadata === undefined) return true
  if (a.metadata === undefined || b.metadata === undefined) return false
  return JSON.stringify(a.metadata) === JSON.stringify(b.metadata)
}

describe('AI Types Property Tests', () => {
  /**
   * **Feature: ai-agent-rework, Property 1: Message Serialization Round-Trip**
   * **Validates: Requirements 1.5, 1.6**
   *
   * For any valid ConversationMessage, serializing to JSON and then
   * deserializing back SHALL produce an equivalent message object
   * with identical field values.
   */
  it('message serialization round-trip preserves all fields', () => {
    fc.assert(
      fc.property(arbitraryConversationMessage, message => {
        const serialized = serializeMessage(message)
        const deserialized = deserializeMessage(serialized)

        return messagesAreEqual(message, deserialized)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 1: Message Serialization Round-Trip**
   * **Validates: Requirements 1.5, 1.6**
   *
   * For any array of valid ConversationMessages, serializing to JSON string
   * and then deserializing back SHALL produce an equivalent array with
   * identical messages in the same order.
   */
  it('messages array serialization round-trip preserves all messages', () => {
    fc.assert(
      fc.property(fc.array(arbitraryConversationMessage), messages => {
        const serialized = serializeMessages(messages)
        const deserialized = deserializeMessages(serialized)

        if (messages.length !== deserialized.length) return false

        return messages.every((msg, index) =>
          messagesAreEqual(msg, deserialized[index])
        )
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 1: Message Serialization Round-Trip**
   * **Validates: Requirements 1.5, 1.6**
   *
   * Serialized messages SHALL have timestamp as ISO 8601 string format.
   */
  it('serialized timestamp is valid ISO 8601 string', () => {
    fc.assert(
      fc.property(arbitraryConversationMessage, message => {
        const serialized = serializeMessage(message)

        // Verify timestamp is a string
        if (typeof serialized.timestamp !== 'string') return false

        // Verify it can be parsed back to a valid date
        const parsedDate = new Date(serialized.timestamp)
        if (Number.isNaN(parsedDate.getTime())) return false

        // Verify the ISO format (should end with Z for UTC)
        return serialized.timestamp.endsWith('Z')
      }),
      { numRuns: 100 }
    )
  })
})
