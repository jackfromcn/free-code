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
 * Image replacement record for resume reconstruction
 */
export type ImageReplacementRecord = {
  kind: 'image-reference'
  toolUseId: string
  blockIndex: number
  replacement: ImageReferenceBlock
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
 * Check if content contains any image blocks (base64 or reference)
 */
export function hasImageContent(
  content: unknown,
): boolean {
  if (!Array.isArray(content)) return false
  return content.some(
    block =>
      typeof block === 'object' &&
      block !== null &&
      'type' in block &&
      (block.type === 'image' || block.type === 'image_reference'),
  )
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
 * Convert image blocks in message content to reference blocks
 * Returns the converted content and replacement records
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

    // Only process base64 image blocks
    if (!isImageBlock(block)) continue

    // Check if it's already a reference (skip if so)
    if (isImageReferenceBlock(block)) continue

    // Convert base64 image to reference
    const reference = await convertImageBlockToReference(
      block as { type: 'image'; source: { type: 'base64'; data: string; media_type: string } },
      { sessionId },
    )

    // Replace the block
    convertedContent[i] = reference

    // Record the replacement for resume
    replacements.push({
      kind: 'image-reference',
      toolUseId,
      blockIndex: i,
      replacement: reference,
    })
  }

  return { content: convertedContent, replacements }
}

/**
 * Restore image reference blocks to base64 image blocks in message content
 * Returns the restored content
 */
export async function restoreMessageImageBlocks(
  content: unknown[],
): Promise<unknown[]> {
  const restoredContent = [...content]

  for (let i = 0; i < restoredContent.length; i++) {
    const block = restoredContent[i]

    // Only process image reference blocks
    if (!isImageReferenceBlock(block)) continue

    // Try to restore from reference
    const restored = await restoreImageFromReference(block as ImageReferenceBlock)

    if (restored) {
      restoredContent[i] = restored
    } else {
      // Fallback: replace with text showing the summary
      const ref = block as ImageReferenceBlock
      restoredContent[i] = {
        type: 'text',
        text: `[Image: ${ref.summary}]`,
      }
    }
  }

  return restoredContent
}