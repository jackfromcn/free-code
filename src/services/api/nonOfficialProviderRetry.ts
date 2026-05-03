import type { APIError } from '@anthropic-ai/sdk'
import { getOriginalCwd, getSessionId, getSessionProjectDir } from 'src/bootstrap/state.js'
import { appendFile, mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { APIProvider, ProviderRetryBucket } from 'src/utils/model/providers.js'
import {
  getAPIProvider,
  getProviderBaseUrl,
  getProviderRetryBucket,
  isOfficialProviderRequest,
} from 'src/utils/model/providers.js'
import { readJSONLFile, safeParseJSON } from 'src/utils/json.js'
import { logForDebugging } from 'src/utils/debug.js'
import { getProjectDir } from 'src/utils/sessionStorage.js'
import { jsonStringify } from 'src/utils/slowOperations.js'

export const NON_OFFICIAL_PROVIDER_RETRY_DELAY_MS = 3000

const PROVIDER_API_ERRORS_DIR_NAME = 'provider-api-errors'
const PROVIDER_API_ERRORS_LOG_NAME = 'errors.jsonl'
const PROVIDER_API_ERRORS_BLACKLIST_NAME = 'blacklist.json'

export type ProviderApiErrorBlacklistRule = {
  id: string
  type: 'exact' | 'substring'
  pattern: string
  reason?: string
  /** If true, trigger auto-compaction instead of hard failure */
  autoCompact?: boolean
}

type ProviderApiErrorBlacklist = {
  version: 1
  providers: Partial<Record<ProviderRetryBucket | 'global', ProviderApiErrorBlacklistRule[]>>
}

export type NonOfficialProviderRetryContext = {
  provider: APIProvider
  providerKey: ProviderRetryBucket
  baseUrl: string | null
  baseUrlHost: string | null
  isOfficialProvider: boolean
  model: string
}

type ProviderApiErrorLogRecord = {
  timestamp: string
  sessionId: string
  provider: APIProvider
  providerKey: ProviderRetryBucket
  isOfficialProvider: boolean
  baseUrl: string | null
  baseUrlHost: string | null
  model: string
  status: number | null
  message: string
  normalizedMessage: string
  attempt: number
  requestId: string | null
}

const DEFAULT_BLACKLIST: ProviderApiErrorBlacklist = {
  version: 1,
  providers: {
    global: [
      {
        id: 'credit-balance-too-low',
        type: 'substring',
        pattern: 'credit balance is too low',
        reason: 'billing stop',
      },
      {
        id: 'insufficient-balance',
        type: 'substring',
        pattern: 'insufficient balance',
        reason: 'billing stop',
      },
      {
        id: 'insufficient-quota',
        type: 'substring',
        pattern: 'insufficient_quota',
        reason: 'quota stop',
      },
      {
        id: 'insufficient-user-quota',
        type: 'substring',
        pattern: 'insufficient_user_quota',
        reason: 'quota stop',
      },
      {
        id: 'context-length-exceeded',
        type: 'substring',
        pattern: 'context length',
        reason: 'context limit',
        autoCompact: true,
      },
      {
        id: 'input-length-exceeded',
        type: 'substring',
        pattern: 'input length',
        reason: 'context limit',
        autoCompact: true,
      },
      {
        id: 'prompt-too-long',
        type: 'substring',
        pattern: 'prompt is too long',
        reason: 'context limit',
        autoCompact: true,
      },
      {
        id: 'organization-disabled',
        type: 'substring',
        pattern: 'organization has been disabled',
        reason: 'account stop',
      },
      {
        id: 'invalid-api-key',
        type: 'substring',
        pattern: 'invalid api key',
        reason: 'auth stop',
      },
      {
        id: 'incorrect-api-key-provided',
        type: 'substring',
        pattern: 'incorrect api key provided',
        reason: 'auth stop',
      },
    ],
  },
}

function getCurrentProjectDir(): string {
  return getSessionProjectDir() ?? getProjectDir(getOriginalCwd())
}

export function getProviderApiErrorsDir(): string {
  return join(getCurrentProjectDir(), PROVIDER_API_ERRORS_DIR_NAME)
}

export function getProviderApiErrorLogPath(): string {
  return join(getProviderApiErrorsDir(), PROVIDER_API_ERRORS_LOG_NAME)
}

export function getProviderApiErrorBlacklistPath(): string {
  return join(getProviderApiErrorsDir(), PROVIDER_API_ERRORS_BLACKLIST_NAME)
}

export function getNonOfficialProviderRetryContext(
  model: string,
): NonOfficialProviderRetryContext {
  const baseUrl = getProviderBaseUrl()
  let baseUrlHost: string | null = null
  if (baseUrl) {
    try {
      baseUrlHost = new URL(baseUrl).host
    } catch {
      baseUrlHost = null
    }
  }

  return {
    provider: getAPIProvider(),
    providerKey: getProviderRetryBucket(),
    baseUrl,
    baseUrlHost,
    isOfficialProvider: isOfficialProviderRequest(),
    model,
  }
}

export function normalizeProviderApiErrorMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/\(request id:[^)]+\)/gi, ' ')
    .replace(/request id:\s*[\w-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function getRequestId(error: unknown): string | null {
  const message = getErrorMessage(error)
  const match =
    message.match(/\(request id:\s*([^)]+)\)/i) ??
    message.match(/request id:\s*([\w-]+)/i)
  return match?.[1]?.trim() ?? null
}

async function ensureDefaultBlacklistFile(): Promise<void> {
  const path = getProviderApiErrorBlacklistPath()
  await mkdir(dirname(path), { recursive: true })
  try {
    await writeFile(path, jsonStringify(DEFAULT_BLACKLIST, null, 2), {
      encoding: 'utf8',
      flag: 'wx',
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}

export async function loadProviderApiErrorBlacklist(): Promise<ProviderApiErrorBlacklist> {
  await ensureDefaultBlacklistFile()
  try {
    const content = await readFile(getProviderApiErrorBlacklistPath(), 'utf8')
    const parsed = safeParseJSON(content, false) as ProviderApiErrorBlacklist | null
    if (parsed && parsed.version === 1 && parsed.providers) {
      return parsed
    }
  } catch (error) {
    logForDebugging(
      `Failed to read provider API blacklist, using defaults: ${error instanceof Error ? error.message : String(error)}`,
      { level: 'error' },
    )
  }
  return DEFAULT_BLACKLIST
}

function ruleMatches(
  rule: ProviderApiErrorBlacklistRule,
  normalizedMessage: string,
): boolean {
  const normalizedPattern = normalizeProviderApiErrorMessage(rule.pattern)
  switch (rule.type) {
    case 'exact':
      return normalizedMessage === normalizedPattern
    case 'substring':
      return normalizedMessage.includes(normalizedPattern)
  }
}

export async function matchProviderApiErrorBlacklist(
  error: unknown,
  context: NonOfficialProviderRetryContext,
): Promise<ProviderApiErrorBlacklistRule | null> {
  const blacklist = await loadProviderApiErrorBlacklist()
  const normalizedMessage = normalizeProviderApiErrorMessage(getErrorMessage(error))
  const rules = [
    ...(blacklist.providers.global ?? []),
    ...(blacklist.providers[context.providerKey] ?? []),
  ]
  return rules.find(rule => ruleMatches(rule, normalizedMessage)) ?? null
}

export async function appendProviderApiErrorLog(args: {
  error: unknown
  attempt: number
  context: NonOfficialProviderRetryContext
}): Promise<void> {
  const { error, attempt, context } = args
  const path = getProviderApiErrorLogPath()
  const message = getErrorMessage(error)
  const record: ProviderApiErrorLogRecord = {
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    provider: context.provider,
    providerKey: context.providerKey,
    isOfficialProvider: context.isOfficialProvider,
    baseUrl: context.baseUrl,
    baseUrlHost: context.baseUrlHost,
    model: context.model,
    status: error instanceof Error && 'status' in error ? ((error as APIError).status ?? null) : null,
    message,
    normalizedMessage: normalizeProviderApiErrorMessage(message),
    attempt,
    requestId: getRequestId(error),
  }

  try {
    await mkdir(dirname(path), { recursive: true })
    await appendFile(path, jsonStringify(record) + '\n', 'utf8')
  } catch (appendError) {
    logForDebugging(
      `Failed to append provider API error log: ${appendError instanceof Error ? appendError.message : String(appendError)}`,
      { level: 'error' },
    )
  }
}

export async function readProviderApiErrorLog(): Promise<ProviderApiErrorLogRecord[]> {
  try {
    return await readJSONLFile<ProviderApiErrorLogRecord>(getProviderApiErrorLogPath())
  } catch {
    return []
  }
}
