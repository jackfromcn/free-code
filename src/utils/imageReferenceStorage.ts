/**
 * Image Reference Storage Module
 *
 * Handles conversion between base64 image blocks and lightweight reference blocks
 * for session storage. Reduces session file size by storing images as references
 * instead of embedding full base64 data.
 *
 * Flow:
 * 1. Write to session: convertImageBlockToReference() - base64 -> reference
 * 2. Read from session: restoreImageFromReference() - reference -> base64 (on-demand)
 * 3. API send: normalizeMessagesForAPI() restores references before sending
 */

import { createHash } from 'crypto'
import { mkdir, readFile, writeFile, stat } from 'fs/promises'
import { join, dirname, extname } from 'path'
import { getSessionId } from '../bootstrap/state.js'
import { getClaudeConfigHomeDir } from './envUtils.js'
import { logError } from './log.js'

// Directory for storing image cache files
const IMAGE_CACHE_DIR = 'image-cache'

// Map of session -> image hashes to avoid re-storing identical images
const imageHashCache = new Map<string, Map<string, string>>()

/**
 * Image reference block - stored in session instead of base64
 */
export type ImageReferenceBlock = {
  type: 'image_reference'
  path: string
  summary: string
  metadata: {
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    original_size_bytes: number
    width?: number
    height?: number
  }
  original_type: 'file_read_image' | 'pasted_image' | 'external_image'
}

/**
 * Document reference block - stored in session instead of base64
 * For PDFs and other base64 document blocks nested in tool_results.
 */
export type DocumentReferenceBlock = {
  type: 'document_reference'
  path: string
  summary: string
  metadata: {
    media_type: string // e.g. 'application/pdf'
    original_size_bytes: number
  }
  original_type: 'tool_result_document'
}

/**
 * Content replacement record for resume reconstruction
 */
export type ImageReplacementRecord = {
  kind: 'image-reference' | 'document-reference'
  toolUseId: string
  blockIndex: number
  subIndex?: number // index within tool_result.content for nested blocks
  replacement: ImageReferenceBlock | DocumentReferenceBlock
}

/**
 * Check if a content block is a base64 image block
 */
export function isImageBlock(block: unknown): block is {
  type: 'image'
  source: { type: 'base64'; data: string; media_type: string }
} {
  if (typeof block !== 'object' || block === null) return false
  const b = block as Record<string, unknown>
  return (
    b.type === 'image' &&
    typeof b.source === 'object' &&
    b.source !== null &&
    (b.source as Record<string, unknown>).type === 'base64'
  )
}

/**
 * Check if a content block is a base64 document block (e.g. PDF)
 */
export function isDocumentBlock(block: unknown): block is {
  type: 'document'
  source: { type: 'base64'; data: string; media_type: string }
} {
  if (typeof block !== 'object' || block === null) return false
  const b = block as Record<string, unknown>
  return (
    b.type === 'document' &&
    typeof b.source === 'object' &&
    b.source !== null &&
    (b.source as Record<string, unknown>).type === 'base64'
  )
}

/**
 * Check if a content block is a tool_result block that may contain nested media
 */
export function isToolResultBlock(block: unknown): block is {
  type: 'tool_result'
  content: unknown[]
  tool_use_id: string
} {
  if (typeof block !== 'object' || block === null) return false
  const b = block as Record<string, unknown>
  return (
    b.type === 'tool_result' &&
    Array.isArray(b.content)
  )
}

/**
 * Check if a content block is an image reference block
 */
export function isImageReferenceBlock(
  block: unknown,
): block is ImageReferenceBlock {
  if (typeof block !== 'object' || block === null) return false
  const b = block as Record<string, unknown>
  return b.type === 'image_reference'
}

/**
 * Check if a content block is a document reference block
 */
export function isDocumentReferenceBlock(
  block: unknown,
): block is DocumentReferenceBlock {
  if (typeof block !== 'object' || block === null) return false
  const b = block as Record<string, unknown>
  return b.type === 'document_reference'
}

/**
 * Check if content contains any media blocks (base64 or reference, including nested in tool_result)
 */
export function hasImageContent(
  content: unknown,
): boolean {
  if (!Array.isArray(content)) return false
  return content.some(block => {
    if (typeof block !== 'object' || block === null || !('type' in block)) return false
    if (block.type === 'image' || block.type === 'image_reference') return true
    if (block.type === 'document' || block.type === 'document_reference') return true
    // Check nested content inside tool_result
    if (block.type === 'tool_result' && Array.isArray((block as Record<string, unknown>).content)) {
      return hasImageContent((block as Record<string, unknown>).content)
    }
    return false
  })
}

/**
 * Compute a deterministic ID for image content using SHA256
 */
function computeImageHash(base64Data: string): string {
  return createHash('sha256')
    .update(base64Data)
    .digest('hex')
    .slice(0, 16)
}

/**
 * Get the file extension for a media type
 */
function getExtensionForMediaType(
  mediaType: string,
): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }
  return map[mediaType] || 'png'
}

/**
 * Store base64 image data to cache directory
 * Returns the path to the stored file
 */
async function storeImageToCache(
  base64Data: string,
  mediaType: string,
  sessionId: string,
): Promise<string> {
  const imageHash = computeImageHash(base64Data)
  const ext = getExtensionForMediaType(mediaType)
  const dir = join(getClaudeConfigHomeDir(), IMAGE_CACHE_DIR, sessionId)
  const filename = `${imageHash}.${ext}`
  const filepath = join(dir, filename)

  // Check if already stored (deduplication)
  let existingHashes = imageHashCache.get(sessionId)
  if (!existingHashes) {
    existingHashes = new Map()
    imageHashCache.set(sessionId, existingHashes)
  }

  const existingPath = existingHashes.get(imageHash)
  if (existingPath) {
    return existingPath
  }

  // Check if file already exists on disk
  try {
    await stat(filepath)
    existingHashes.set(imageHash, filepath)
    return filepath
  } catch {
    // File doesn't exist, proceed to store
  }

  // Store the file
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(filepath, base64Data, 'base64')
    existingHashes.set(imageHash, filepath)
    return filepath
  } catch (error) {
    logError(error as Error)
    throw error
  }
}

/**
 * Generate a summary for the image based on its metadata and context
 */
function generateImageSummary(
  mediaType: string,
  originalSizeBytes: number,
  sourcePath?: string,
): string {
  const sizeKB = Math.round(originalSizeBytes / 1024)
  const typeLabel = mediaType.split('/')[1]?.toUpperCase() || 'IMAGE'

  // Try to extract a meaningful name from the source path
  let context = ''
  if (sourcePath) {
    const basename = sourcePath.split('/').pop() || sourcePath
    // Remove extension for cleaner display
    const name = basename.replace(/\.[^/.]+$/, '')
    if (name.length > 0 && name.length < 50) {
      context = name
    }
  }

  if (context) {
    return `${typeLabel}: ${context} (${sizeKB}KB)`
  }

  return `${typeLabel} (${sizeKB}KB)`
}

/**
 * Convert a base64 image block to a reference block
 * Stores the image to cache and returns a lightweight reference
 */
export async function convertImageBlockToReference(
  block: {
    type: 'image'
    source: { type: 'base64'; data: string; media_type: string }
  },
  options: {
    sessionId: string
    sourcePath?: string
    width?: number
    height?: number
  },
): Promise<ImageReferenceBlock> {
  const { data, media_type } = block.source
  const { sessionId, sourcePath, width, height } = options

  // Store image to cache and get the path
  const path = await storeImageToCache(data, media_type, sessionId)

  // Generate a summary
  const summary = generateImageSummary(media_type, data.length, sourcePath)

  return {
    type: 'image_reference',
    path,
    summary,
    metadata: {
      media_type: media_type as ImageReferenceBlock['metadata']['media_type'],
      original_size_bytes: data.length,
      width,
      height,
    },
    original_type: sourcePath
      ? 'file_read_image'
      : 'pasted_image',
  }
}

/**
 * Restore an image reference block to a base64 image block
 * Used before sending to API
 */
export async function restoreImageFromReference(
  ref: ImageReferenceBlock,
): Promise<{
  type: 'image'
  source: { type: 'base64'; data: string; media_type: string }
} | null> {
  try {
    const data = await readFile(ref.path, 'base64')
    return {
      type: 'image',
      source: {
        type: 'base64',
        data,
        media_type: ref.metadata.media_type,
      },
    }
  } catch (error) {
    // File not found or read error
    console.error(`Failed to restore image from reference: ${ref.path}`, error)
    return null
  }
}

/**
 * Convert a base64 document block to a reference block
 * Stores the document to cache and returns a lightweight reference
 */
export async function convertDocumentBlockToReference(
  block: {
    type: 'document'
    source: { type: 'base64'; data: string; media_type: string }
  },
  options: {
    sessionId: string
  },
): Promise<DocumentReferenceBlock> {
  const { data, media_type } = block.source
  const { sessionId } = options

  const path = await storeImageToCache(data, media_type, sessionId)
  const summary = generateImageSummary(media_type, data.length)

  return {
    type: 'document_reference',
    path,
    summary,
    metadata: {
      media_type,
      original_size_bytes: data.length,
    },
    original_type: 'tool_result_document',
  }
}

/**
 * Restore a document reference block to a base64 document block
 * Used before sending to API
 */
export async function restoreDocumentFromReference(
  ref: DocumentReferenceBlock,
): Promise<{
  type: 'document'
  source: { type: 'base64'; data: string; media_type: string }
} | null> {
  try {
    const data = await readFile(ref.path, 'base64')
    return {
      type: 'document',
      source: {
        type: 'base64',
        data,
        media_type: ref.metadata.media_type,
      },
    }
  } catch (error) {
    console.error(`Failed to restore document from reference: ${ref.path}`, error)
    return null
  }
}

/**
 * Convert media blocks in message content to reference blocks.
 * Handles both top-level image/document blocks AND nested ones inside
 * tool_result content arrays — the same pattern stripImagesFromMessages
 * uses in compact.ts.
 * Returns the converted content and replacement records.
 */
export async function convertMessageImageBlocks(
  content: unknown[],
  sessionId: string,
  toolUseId: string,
): Promise<{
  content: unknown[]
  replacements: ImageReplacementRecord[]
}> {
  const replacements: ImageReplacementRecord[] = []
  const convertedContent = [...content]

  for (let i = 0; i < convertedContent.length; i++) {
    const block = convertedContent[i]

    // Top-level base64 image block
    if (isImageBlock(block)) {
      if (isImageReferenceBlock(block)) continue
      const reference = await convertImageBlockToReference(
        block as { type: 'image'; source: { type: 'base64'; data: string; media_type: string } },
        { sessionId },
      )
      convertedContent[i] = reference
      replacements.push({
        kind: 'image-reference',
        toolUseId,
        blockIndex: i,
        replacement: reference,
      })
      continue
    }

    // Top-level base64 document block
    if (isDocumentBlock(block)) {
      if (isDocumentReferenceBlock(block)) continue
      const reference = await convertDocumentBlockToReference(
        block as { type: 'document'; source: { type: 'base64'; data: string; media_type: string } },
        { sessionId },
      )
      convertedContent[i] = reference
      replacements.push({
        kind: 'document-reference',
        toolUseId,
        blockIndex: i,
        replacement: reference,
      })
      continue
    }

    // Nested media inside tool_result content arrays
    if (isToolResultBlock(block)) {
      let hasReplacement = false
      const newToolContent = await Promise.all(
        block.content.map(async (item, subIndex) => {
          if (isImageBlock(item)) {
            hasReplacement = true
            const reference = await convertImageBlockToReference(
              item as { type: 'image'; source: { type: 'base64'; data: string; media_type: string } },
              { sessionId },
            )
            replacements.push({
              kind: 'image-reference',
              toolUseId,
              blockIndex: i,
              subIndex,
              replacement: reference,
            })
            return reference
          }
          if (isDocumentBlock(item)) {
            hasReplacement = true
            const reference = await convertDocumentBlockToReference(
              item as { type: 'document'; source: { type: 'base64'; data: string; media_type: string } },
              { sessionId },
            )
            replacements.push({
              kind: 'document-reference',
              toolUseId,
              blockIndex: i,
              subIndex,
              replacement: reference,
            })
            return reference
          }
          return item
        }),
      )
      if (hasReplacement) {
        convertedContent[i] = { ...block, content: newToolContent }
      }
    }
  }

  return { content: convertedContent, replacements }
}

/**
 * Restore media reference blocks to base64 blocks in message content.
 * Handles both top-level and nested (inside tool_result) references.
 * Returns the restored content.
 */
export async function restoreMessageImageBlocks(
  content: unknown[],
): Promise<unknown[]> {
  const restoredContent = [...content]

  for (let i = 0; i < restoredContent.length; i++) {
    const block = restoredContent[i]

    // Top-level image reference
    if (isImageReferenceBlock(block)) {
      const restored = await restoreImageFromReference(block as ImageReferenceBlock)
      if (restored) {
        restoredContent[i] = restored
      } else {
        const ref = block as ImageReferenceBlock
        restoredContent[i] = { type: 'text', text: `[Image: ${ref.summary}]` }
      }
      continue
    }

    // Top-level document reference
    if (isDocumentReferenceBlock(block)) {
      const restored = await restoreDocumentFromReference(block as DocumentReferenceBlock)
      if (restored) {
        restoredContent[i] = restored
      } else {
        const ref = block as DocumentReferenceBlock
        restoredContent[i] = { type: 'text', text: `[Document: ${ref.summary}]` }
      }
      continue
    }

    // Nested references inside tool_result content arrays
    if (isToolResultBlock(block)) {
      let hasReference = false
      const newToolContent = await Promise.all(
        block.content.map(async (item) => {
          if (isImageReferenceBlock(item)) {
            hasReference = true
            const restored = await restoreImageFromReference(item as ImageReferenceBlock)
            return restored ?? { type: 'text', text: `[Image: ${(item as ImageReferenceBlock).summary}]` }
          }
          if (isDocumentReferenceBlock(item)) {
            hasReference = true
            const restored = await restoreDocumentFromReference(item as DocumentReferenceBlock)
            return restored ?? { type: 'text', text: `[Document: ${(item as DocumentReferenceBlock).summary}]` }
          }
          return item
        }),
      )
      if (hasReference) {
        restoredContent[i] = { ...block, content: newToolContent }
      }
    }
  }

  return restoredContent
}

/**
 * Strip large base64 data from toolUseResult metadata before persisting to session.
 * toolUseResult is a side-channel copy of the raw tool output (used for UI/search),
 * not part of message.content, so convertMessageImageBlocks doesn't touch it.
 * When a tool (especially MCP) returns an image/document, the entire base64 payload
 * ends up here redundantly — sometimes 3+ MB for a single PNG.
 *
 * For image/document toolUseResults, we replace the base64 data with a reference
 * to the already-cached file (created by convertMessageImageBlocks on the content
 * side). This keeps the type/metadata intact for UI display while eliminating the
 * redundant large data.
 */
export function stripToolUseResultMedia(
  toolUseResult: unknown,
): unknown {
  if (typeof toolUseResult !== 'object' || toolUseResult === null) return toolUseResult
  const obj = toolUseResult as Record<string, unknown>

  // Handle { type: 'image', file: { base64: '...', type: 'image/png', ... } }
  if (obj.type === 'image' && typeof obj.file === 'object' && obj.file !== null) {
    const fileObj = obj.file as Record<string, unknown>
    if (typeof fileObj.base64 === 'string' && fileObj.base64.length > 10000) {
      return {
        ...obj,
        file: {
          ...fileObj,
          base64: `[REMOVED: ${fileObj.type || 'image'} base64 data (${Math.round(fileObj.base64.length / 1024)}KB) stripped for session storage]`,
          originalSize: fileObj.base64.length,
        },
      }
    }
  }

  // Handle { type: 'document', file: { base64: '...', type: 'application/pdf', ... } }
  if (obj.type === 'document' && typeof obj.file === 'object' && obj.file !== null) {
    const fileObj = obj.file as Record<string, unknown>
    if (typeof fileObj.base64 === 'string' && fileObj.base64.length > 10000) {
      return {
        ...obj,
        file: {
          ...fileObj,
          base64: `[REMOVED: ${fileObj.type || 'document'} base64 data (${Math.round(fileObj.base64.length / 1024)}KB) stripped for session storage]`,
          originalSize: fileObj.base64.length,
        },
      }
    }
  }

  return toolUseResult
}