import { afterAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createAssistantMessage, createUserMessage } from './messages.js'
import { jsonStringify } from './slowOperations.js'
import {
  loadTranscriptFile,
  sanitizeTranscriptToolResultMessage,
} from './sessionStorage.js'
import {
  PERSISTED_OUTPUT_TAG,
  TOOL_RESULT_CLEARED_MESSAGE,
  TRANSCRIPT_TOOL_RESULT_PERSIST_THRESHOLD,
} from './toolResultStorage.js'

const tempRoot = mkdtempSync(join(tmpdir(), 'cc-session-storage-'))
process.env.CLAUDE_CONFIG_DIR = tempRoot

describe('sanitizeTranscriptToolResultMessage', () => {
  test('replaces oversized string tool_result with persisted-output reference', async () => {
    const largeContent = 'x'.repeat(TRANSCRIPT_TOOL_RESULT_PERSIST_THRESHOLD + 1000)
    const message = createUserMessage({
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call_test_large',
          content: largeContent,
        },
      ],
    })

    const result = await sanitizeTranscriptToolResultMessage(message)

    expect(result.replacements).toHaveLength(1)
    expect(result.replacements[0]?.kind).toBe('tool-result')
    expect(result.replacements[0]?.toolUseId).toBe('call_test_large')

    const content = result.message.message.content
    expect(Array.isArray(content)).toBe(true)
    if (!Array.isArray(content)) {
      throw new Error('expected array content')
    }
    const block = content[0]
    expect(block?.type).toBe('tool_result')
    if (!block || block.type !== 'tool_result' || typeof block.content !== 'string') {
      throw new Error('expected tool_result string block')
    }
    expect(block.content.startsWith(PERSISTED_OUTPUT_TAG)).toBe(true)
    expect(block.content).toBe(result.replacements[0]?.replacement)

    const pathMatch = block.content.match(/Full output saved to: (.+)\n/)
    expect(pathMatch).not.toBeNull()
    const persistedPath = pathMatch?.[1]?.trim()
    expect(persistedPath).toBeTruthy()
    const persisted = readFileSync(String(persistedPath), 'utf8')
    expect(persisted).toBe(largeContent)
  })

  test('loadTranscriptFile preserves parent chain with persisted oversized tool_result', async () => {
    const transcriptPath = join(tempRoot, `${randomUUID()}.jsonl`)
    const assistantUuid = randomUUID()
    const toolResultUuid = randomUUID()
    const tailUuid = randomUUID()
    const largeContent = 'y'.repeat(TRANSCRIPT_TOOL_RESULT_PERSIST_THRESHOLD + 2048)

    const assistant = createAssistantMessage({ content: 'running tool' })
    assistant.uuid = assistantUuid

    const toolResult = createUserMessage({
      uuid: toolResultUuid,
      sourceToolAssistantUUID: assistantUuid,
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call_chain_test',
          content: largeContent,
        },
      ],
    })
    const sanitized = await sanitizeTranscriptToolResultMessage(toolResult)
    const tail = createUserMessage({
      uuid: tailUuid,
      content: 'after tool result',
    })

    const assistantEntry = {
      parentUuid: null,
      isSidechain: false,
      sessionId: randomUUID(),
      cwd: '/tmp',
      userType: 'external',
      version: 'test',
      timestamp: assistant.timestamp,
      ...assistant,
    }
    const toolResultEntry = {
      parentUuid: assistantUuid,
      isSidechain: false,
      sessionId: randomUUID(),
      cwd: '/tmp',
      userType: 'external',
      version: 'test',
      timestamp: sanitized.message.timestamp,
      ...sanitized.message,
    }
    const tailEntry = {
      parentUuid: toolResultUuid,
      isSidechain: false,
      sessionId: randomUUID(),
      cwd: '/tmp',
      userType: 'external',
      version: 'test',
      timestamp: tail.timestamp,
      ...tail,
    }
    const replacementEntry = {
      type: 'content-replacement',
      sessionId: toolResultEntry.sessionId,
      replacements: sanitized.replacements,
    }

    writeFileSync(
      transcriptPath,
      [assistantEntry, toolResultEntry, tailEntry, replacementEntry]
        .map(entry => jsonStringify(entry))
        .join('\n') + '\n',
      'utf8',
    )

    const loaded = await loadTranscriptFile(transcriptPath)
    const loadedToolResult = loaded.messages.get(toolResultUuid as `${string}-${string}-${string}-${string}-${string}`)
    const loadedTail = loaded.messages.get(tailUuid as `${string}-${string}-${string}-${string}-${string}`)

    expect(loadedToolResult).toBeTruthy()
    expect(loadedTail).toBeTruthy()
    expect(loadedTail?.parentUuid).toBe(toolResultUuid)
    expect(loaded.contentReplacements.size).toBeGreaterThan(0)

    const blocks = loadedToolResult?.message.content
    expect(Array.isArray(blocks)).toBe(true)
    if (Array.isArray(blocks)) {
      const first = blocks[0]
      expect(first?.type).toBe('tool_result')
      if (first && first.type === 'tool_result' && typeof first.content === 'string') {
        expect(first.content.startsWith(PERSISTED_OUTPUT_TAG)).toBe(true)
      }
    }
  })

  test('clears oversized top-level toolUseResult while keeping tool_result message compacted', async () => {
    const largeContent = 'z'.repeat(TRANSCRIPT_TOOL_RESULT_PERSIST_THRESHOLD + 1500)
    const message = createUserMessage({
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call_large_top_level',
          content: 'The file /tmp/example.ts has been updated successfully.',
        },
      ],
      toolUseResult: {
        originalFile: largeContent,
        oldString: 'before',
        newString: 'after',
      },
    })

    const result = await sanitizeTranscriptToolResultMessage(message)

    expect(result.replacements).toHaveLength(0)
    expect(result.message.toolUseResult).toBe(TOOL_RESULT_CLEARED_MESSAGE)
    const blocks = result.message.message.content
    expect(Array.isArray(blocks)).toBe(true)
    if (Array.isArray(blocks)) {
      const first = blocks[0]
      expect(first?.type).toBe('tool_result')
      if (first && first.type === 'tool_result') {
        expect(first.content).toBe('The file /tmp/example.ts has been updated successfully.')
      }
    }
  })

  test('leaves small tool_result unchanged', async () => {
    const message = createUserMessage({
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call_test_small',
          content: 'small output',
        },
      ],
    })

    const result = await sanitizeTranscriptToolResultMessage(message)
    expect(result.replacements).toHaveLength(0)
    expect(result.message).toEqual(message)
  })
})

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true })
})
