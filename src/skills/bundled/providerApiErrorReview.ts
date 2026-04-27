import { registerBundledSkill } from '../bundledSkills.js'
import {
  getProviderApiErrorBlacklistPath,
  getProviderApiErrorLogPath,
  loadProviderApiErrorBlacklist,
} from '../../services/api/nonOfficialProviderRetry.js'

export function registerProviderApiErrorReviewSkill(): void {
  registerBundledSkill({
    name: 'provider-api-error-review',
    description:
      'Review non-official provider API error logs, group them by provider, recommend new blacklist entries, and optionally update the blacklist file.',
    allowedTools: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'AskUserQuestion'],
    userInvocable: true,
    disableModelInvocation: true,
    argumentHint: '[focus or provider name]',
    async getPromptForCommand(args) {
      await loadProviderApiErrorBlacklist()
      const blacklistPath = getProviderApiErrorBlacklistPath()
      const logPath = getProviderApiErrorLogPath()
      const focus = args
        ? `Focus the review on: ${args}\n`
        : 'Review all available providers.\n'

      return [
        {
          type: 'text',
          text: `# Provider API Error Review

Review the non-official provider API error backlog and recommend new blacklist entries.

${focus}
## Files

- Blacklist JSON: \`${blacklistPath}\`
- Error log JSONL: \`${logPath}\`

## Required workflow

1. Read the blacklist file first.
2. Read the error log file.
3. Group errors by provider/providerKey.
4. Ignore any error patterns already covered by the current blacklist.
5. Deduplicate recommendations in your response. Similar errors should produce one candidate recommendation.
6. Present a short provider-by-provider recommendation list.
7. Ask the user which candidate IDs should be added to the blacklist.
8. If the user selects candidates:
   - update the blacklist JSON file
   - remove matching handled records from the error log JSONL file
   - then summarize what was added and what log records were cleared

## Recommendation rules

- Prefer \`substring\` rules.
- Keep patterns stable and short.
- Include provider-specific rules under the matching provider key when possible.
- Do not recommend duplicates that already exist in the blacklist.
- Do not clear log records until the user has explicitly chosen candidates.
`,
        },
      ]
    },
  })
}
