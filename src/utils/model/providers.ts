import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js'
import { isEnvTruthy } from '../envUtils.js'

export type APIProvider = 'firstParty' | 'bedrock' | 'vertex' | 'foundry' | 'openai'
export type ProviderRetryBucket = APIProvider | 'firstPartyProxy'

export function getAPIProvider(): APIProvider {
  return isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK)
    ? 'bedrock'
    : isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX)
      ? 'vertex'
      : isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)
        ? 'foundry'
        : isEnvTruthy(process.env.CLAUDE_CODE_USE_OPENAI)
          ? 'openai'
          : 'firstParty'
}

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}

/**
 * Check if ANTHROPIC_BASE_URL is a first-party Anthropic API URL.
 * Returns true if not set (default API) or points to api.anthropic.com
 * (or api-staging.anthropic.com for ant users).
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) {
    return true
  }
  try {
    const host = new URL(baseUrl).host
    const allowedHosts = ['api.anthropic.com']
    if (process.env.USER_TYPE === 'ant') {
      allowedHosts.push('api-staging.anthropic.com')
    }
    return allowedHosts.includes(host)
  } catch {
    return false
  }
}

/**
 * "Official provider config" means built-in provider integrations.
 * A custom ANTHROPIC_BASE_URL relay/proxy is treated as non-official retry mode.
 */
export function isOfficialProviderRequest(): boolean {
  const provider = getAPIProvider()
  if (provider !== 'firstParty') {
    return true
  }
  return isFirstPartyAnthropicBaseUrl()
}

export function isNonOfficialProviderRequest(): boolean {
  return !isOfficialProviderRequest()
}

export function getProviderRetryBucket(): ProviderRetryBucket {
  const provider = getAPIProvider()
  if (provider === 'firstParty' && !isFirstPartyAnthropicBaseUrl()) {
    return 'firstPartyProxy'
  }
  return provider
}

export function getProviderBaseUrl(): string | null {
  const provider = getAPIProvider()
  switch (provider) {
    case 'firstParty':
      return process.env.ANTHROPIC_BASE_URL ?? null
    case 'bedrock':
      return process.env.ANTHROPIC_BEDROCK_BASE_URL ?? null
    case 'vertex':
      return process.env.ANTHROPIC_VERTEX_BASE_URL ?? null
    case 'foundry':
      return process.env.ANTHROPIC_FOUNDRY_BASE_URL ?? null
    case 'openai':
      return null
  }
}
