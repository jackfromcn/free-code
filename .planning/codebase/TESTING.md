# Testing Patterns

**Analysis Date:** 2026-04-29

## Test Framework

**Status:** Not configured

**Observation:** This codebase does not have a configured test framework. No test files (`.test.ts`, `.spec.ts`) were found in the source tree. The project lacks:

- Jest configuration
- Vitest configuration
- Test dependencies in package.json
- Test scripts in package.json

**Package.json test-related entries (none found):**
```json
{
  "scripts": {
    "build": "bun run ./scripts/build.ts",
    "build:dev": "bun run ./scripts/build.ts --dev",
    "build:dev:full": "bun run ./scripts/build.ts --dev --feature-set=dev-full",
    "compile": "bun run ./scripts/build.ts --compile",
    "dev": "bun run ./src/entrypoints/cli.tsx"
  },
  "devDependencies": {
    "@types/bun": "^1.3.11",
    "typescript": "^6.0.2"
  }
}
```

## Test File Organization

**Location:** Not applicable - no test files exist

**Expected pattern for a project of this size:**
- Co-located tests: `{filename}.test.ts` alongside `{filename}.ts`
- Or separate `__tests__/` directories in each module

## Test Structure

**Patterns that would be expected if tests existed:**

**Unit Test Suite Structure:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest' // or jest

describe('ModuleName', () => {
  beforeEach(() => {
    // Reset state
  })

  describe('functionName', () => {
    it('should do X when Y', () => {
      // Arrange
      const input = ...
      // Act
      const result = functionName(input)
      // Assert
      expect(result).toBe(...)
    })
  })
})
```

**Testing Patterns Observed in Code:**

Given the absence of formal tests, certain patterns in the codebase suggest how tests would be structured if they existed:

**1. Error Handling Tests (manual):**
```typescript
// In src/utils/errors.ts - tested implicitly through catch blocks
try {
  // operation
} catch (error: unknown) {
  const message = errorMessage(error)
  logError(message)
}
```

**2. Zod Schema Validation (manual testing in services):**
```typescript
// In src/services/api/bootstrap.ts
const schema = z.object({
  model: z.string(),
  name: z.string(),
  description: z.string(),
})
```

**3. Tool Validation (manual testing via CLI):**
```typescript
// In src/tools/BashTool/BashTool.tsx
// Tool definitions use Zod for input validation
const bashTool = buildTool({
  name: 'bash',
  inputSchema: BashSchema,
  execute: async (params) => { /* ... */ }
})
```

## Mocking

**Framework:** Not applicable

**What would be mocked in this project:**
- API calls (`src/services/api/claude.ts`)
- File system operations (`src/utils/file.ts`)
- OAuth flows (`src/services/oauth/client.ts`)
- WebSocket connections (`src/remote/SessionsWebSocket.ts`)

**Mock Patterns (based on existing code structure):**
```typescript
// Would use vi.fn() or jest.fn() for mocks
const mockLogEvent = vi.fn()
vi.mock('../services/analytics/index.js', () => ({
  logEvent: mockLogEvent,
}))
```

## Fixtures and Factories

**Test Data:** Not applicable

**Would be expected:**
- Mock API responses in `__fixtures__/` directories
- Test data factories for complex objects like `AppState`, `Message`, `ToolResult`

## Coverage

**Requirements:** None enforced

**Current state:** No coverage configuration or reporting

**Would typically require:**
```bash
bun test --coverage  # or jest --coverage
```

## Test Types

**Unit Tests:** Not implemented
- Would test individual utility functions in `src/utils/`
- Would test component logic in hooks (`src/hooks/`)
- Would test tool implementations (`src/tools/*/`)

**Integration Tests:** Not implemented
- Would test API client integration (`src/services/api/`)
- Would test OAuth flow end-to-end (`src/services/oauth/`)
- Would test MCP connection handling (`src/services/mcp/`)

**E2E Tests:** Not implemented
- Would test CLI interaction flow (`src/entrypoints/cli.tsx`)
- Would test REPL screen interactions (`src/screens/REPL.tsx`)
- Would test command execution

## Common Patterns (if tests existed)

**Async Testing:**
```typescript
it('should resolve with data', async () => {
  const result = await asyncFunction()
  expect(result).toEqual(expectedData)
})

it('should reject on error', async () => {
  await expect(asyncFunction()).rejects.toThrow('Error message')
})
```

**Error Testing:**
```typescript
it('should throw ClaudeError for invalid input', () => {
  expect(() => validateInput(invalidInput)).toThrow(ClaudeError)
})
```

## CI/CD Testing

**Status:** No CI/CD pipeline detected

**Observation:** No `.github/workflows/` directory exists in the repository. Build and development runs via:
```bash
bun run build        # Standard build
bun run build:dev    # Dev build
bun run compile      # Compiled binary
bun run dev          # Run from source
```

---

*Testing analysis: 2026-04-29*