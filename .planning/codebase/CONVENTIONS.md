# Coding Conventions

**Analysis Date:** 2026-04-29

## Naming Patterns

**Files:**
- Use kebab-case for file and directory names: `add-dir/`, `autofix-pr/`, `bash-permissions.ts`
- TypeScript files use `.ts` extension, React components use `.tsx`
- Barrel files use `index.ts` or `index.tsx`

**Functions:**
- camelCase for exported functions: `errorMessage()`, `toError()`, `isAbortError()`
- Hook functions use `use` prefix: `useApiKeyVerification`, `useAfterFirstRender`
- Async functions use `async function` declaration: `async function refreshGrowthBookFeatures()`

**Variables:**
- camelCase for local variables and parameters
- UPPER_SNAKE_CASE for constants: `MAX_IN_MEMORY_ERRORS`, `DEFAULT_MAX_RETRIES`

**Types:**
- PascalCase for type names: `ConvertedMessage`, `RemoteSessionConfig`, `AppState`
- Interfaces follow same PascalCase convention
- Type aliases use PascalCase: `AxiosErrorKind`

**Classes:**
- PascalCase for class names: `ClaudeError`, `ShellError`, `AbortError`
- Custom error classes extend `Error` and set `this.name = this.constructor.name`

**Exports:**
- Named exports preferred for utilities: `export function errorMessage()`, `export class ClaudeError`
- Default exports used for commands and main components: `export default session`, `export default help`
- Re-export pattern for backwards compatibility: `export { type AppState } from './AppStateStore.js'`

## Code Style

**Formatting:**
- TypeScript with `verbatimModuleSyntax: true` in `tsconfig.json`
- JSX compile target: `react-jsx`
- Module system: ESM with `module: "Preserve"` and `moduleResolution: "bundler"`
- No explicit formatting tool configuration detected (no `.prettierrc`, `biome.json` in root)

**Linting:**
- ESLint-style inline disable comments used for dynamic imports:
  ```typescript
  /* eslint-disable @typescript-eslint/no-require-imports */
  const foo = feature('FLAG') ? require('./path.js').default : null
  /* eslint-enable @typescript-eslint/no-require-imports */
  ```
- Biome ignore comments for import ordering:
  ```typescript
  // biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
  ```

**TypeScript Settings:**
- `strict: false` in tsconfig (non-strict mode)
- `skipLibCheck: true` for faster compilation
- `noFallthroughCasesInSwitch: true` enabled

## Import Organization

**Order:**
1. Bun bundle feature imports: `import { feature } from 'bun:bundle'`
2. External package imports (SDKs, libraries): `import type { z } from 'zod/v4'`
3. Node built-in imports: `import { randomUUID } from 'crypto'`
4. Internal imports using `src/` path alias or relative paths
5. Type-only imports last: `import type { AppState } from './state/AppState.js'`

**Path Aliases:**
- `src/*` alias configured in tsconfig for internal imports
- Imports use `.js` extension for ESM compatibility: `import { logError } from '../utils/log.js'`
- Type imports use `import type` syntax (required by `verbatimModuleSyntax`)

**Example Import Block:**
```typescript
// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { feature } from 'bun:bundle'
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { randomUUID } from 'crypto'
import type { Command } from './commands.js'
import type { AppState } from './state/AppState.js'
```

## Error Handling

**Custom Error Classes:**
Located in `src/utils/errors.ts`:
- `ClaudeError` - Generic Claude-related errors
- `MalformedCommandError` - Invalid command parsing
- `AbortError` - Operation cancellation
- `ConfigParseError` - Configuration file parsing failures (includes filePath and defaultConfig)
- `ShellError` - Shell command failures (includes stdout, stderr, code, interrupted)
- `TeleportOperationError` - Teleport-specific errors
- `TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS` - Errors safe for telemetry logging

**Error Helper Functions:**
```typescript
// Normalize caught values to Error instances
toError(e: unknown): Error

// Extract message from unknown error
errorMessage(e: unknown): string

// Check for abort-shaped errors
isAbortError(e: unknown): boolean

// Extract errno codes (ENOENT, EACCES, etc.)
getErrnoCode(e: unknown): string | undefined

// Check filesystem accessibility errors
isFsInaccessible(e: unknown): boolean

// Truncate stack traces for context efficiency
shortErrorStack(e: unknown, maxFrames?: number): string

// Classify axios errors into buckets
classifyAxiosError(e: unknown): { kind: AxiosErrorKind; status?: number; message: string }
```

**Catch Block Pattern:**
```typescript
try {
  // operation
} catch (error: unknown) {
  // Use helper functions for type narrowing
  logError(errorMessage(error))
  if (isENOENT(error)) {
    // handle missing file
  }
}
```

**Throw Pattern:**
```typescript
// Simple descriptive errors
throw new Error('Codex token exchange failed. Please try again.')

// Context-rich errors
throw new ConfigParseError(
  `Invalid JSON in ${filePath}`,
  filePath,
  defaultConfig
)
```

## Logging

**Framework:** Custom logging utilities in `src/utils/log.ts`

**Log Functions:**
- `logError(message: string)` - Error logging with in-memory buffer
- `logForDebugging(message: string)` - Debug logging from `src/utils/debug.js`
- `getInMemoryErrors()` - Retrieve recent error log entries

**Patterns:**
- Use `logError` for error conditions in catch blocks
- Use `logForDebugging` for development/debug traces
- Console methods (`console.error`, `console.log`) used sparingly, primarily in:
  - Plugin CLI commands (`src/services/plugins/pluginCliCommands.ts`)
  - Auth utilities (`src/utils/auth.ts`)
  - SDK client debugging (`src/services/api/client.ts`)

**When to Log:**
- Log errors at catch boundaries before propagation
- Log debug information during complex flows (message processing, API calls)
- Avoid logging sensitive data (use `TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS` for telemetry-safe messages)

## Comments

**When to Comment:**
- TODO/FIXME comments for incomplete features or known issues
- Inline comments explaining non-obvious logic or business rules
- Biome/ESLint disable comments with explanation

**TODO Comments:**
```typescript
// TODO: Remove this once the API is fixed to return correct format
// TODO(keybindings-migration): Remove fallback parameter after migration is complete
// TODO(ANT-344): the keep-alive via SystemAPIErrorMessage yields is a stopgap
```

**JSDoc/TSDoc:**
- Used for complex public functions with detailed parameter/return documentation
- Example from `src/utils/errors.ts`:
```typescript
/**
 * True iff `e` is any of the abort-shaped errors the codebase encounters:
 * our AbortError class, a DOMException from AbortController.abort()
 * (.name === 'AbortError'), or the SDK's APIUserAbortError.
 */
export function isAbortError(e: unknown): boolean
```

## Function Design

**Size:** Functions vary from small utilities (~5 lines) to large orchestration functions (~100+ lines)

**Parameters:**
- Multiple parameters use object destructuring for clarity:
```typescript
export function getLogDisplayTitle(
  log: LogOption,
  defaultTitle?: string,
): string
```
- Zod schemas for tool input validation

**Return Values:**
- Utility functions return specific types with clear purposes
- Async functions return `Promise<T>`
- Functions that may fail return result objects or throw errors
- Pattern: `ValidationResult = { result: true } | { result: false; message: string; errorCode: number }`

## Module Design

**Exports:**
- Named exports for utilities and types
- Default exports for commands and main components
- Re-exports for backwards compatibility during migrations

**Barrel Files:**
- `index.ts` files in directories for grouping exports
- Commands directory uses per-command subdirectories with index.ts

**Feature-Gated Imports:**
```typescript
// Dead code elimination: conditional imports
/* eslint-disable @typescript-eslint/no-require-imports */
const voiceCommand = feature('VOICE_MODE')
  ? require('./commands/voice/index.js').default
  : null
/* eslint-enable @typescript-eslint/no-require-imports */
```

## React/Ink Patterns

**Component Structure:**
- React functional components with hooks
- Ink terminal UI framework for CLI rendering
- Components use PascalCase: `ConsoleOAuthFlow`, `ThemePicker`

**Hook Patterns:**
- Custom hooks in `src/hooks/` directory
- `use` prefix convention: `useApiKeyVerification`, `useAfterFirstRender`
- React Compiler runtime usage: `import { c as _c } from "react/compiler-runtime"`

**State Management:**
- `AppStateStore` pattern with React context
- `createStore()` from `src/state/store.js`
- Provider pattern: `AppStateProvider`, `MailboxProvider`

## Zod Validation

**Schema Definition:**
```typescript
import { z } from 'zod/v4'

const schema = z.object({
  entries: z.record(z.string(), z.string()),
  version: z.number().int().positive(),
  lastModified: z.string(), // ISO 8601 timestamp
})
```

**Tool Input Validation:**
- Tools use Zod schemas for parameter validation
- Schema built using `buildTool()` from `src/Tool.ts`

---

*Convention analysis: 2026-04-29*