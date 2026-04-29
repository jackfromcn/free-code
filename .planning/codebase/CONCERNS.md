# Codebase Concerns

**Analysis Date:** 2026-04-29

## Tech Debt

**Feature Flags (34 broken):**
- Issue: 34 out of 88 `feature('FLAG')` compile-time flags fail to bundle
- Files: `scripts/build.ts`, `FEATURES.md`
- Impact: Several experimental features cannot be built and will cause compile errors
- Fix approach: Restore missing files for each broken flag as documented in FEATURES.md. Categories include:
  - Easy reconstruction (16 flags): Missing wrapper files like `src/cli/bg.js`, `src/commands/buddy/index.js`
  - Medium gaps (14 flags): Missing core subsystems like `src/daemon/workerRegistry.js`, `src/coordinator/workerAgent.js`
  - Large gaps (3 flags): `KAIROS`, `KAIROS_DREAM`, `PROACTIVE` require substantial new code

**Analytics Module Made Inert:**
- Issue: Telemetry removed but module skeleton remains as compatibility boundary
- Files: `src/services/analytics/index.ts`
- Impact: All `logEvent()` calls are no-ops; cannot be re-enabled without restoring the module
- Fix approach: This appears intentional for the "free-code" fork. Monitor if analytics features need restoration.

**GrowthBook Feature Flags:**
- Issue: Heavy dependency on GrowthBook for feature gating with complex caching
- Files: `src/services/analytics/growthbook.ts` (1100+ lines)
- Impact: Multiple workarounds for SDK bugs, stale cache handling, and malformed API responses
- Fix approach: The `getFeatureValue_CACHED_MAY_BE_STALE()` pattern works but adds complexity. Consider simplifying.

**Deprecated Functions Still in Use:**
- Issue: Multiple deprecated functions remain actively called throughout codebase
- Files: `src/utils/execSyncWrapper.ts`, `src/utils/auth.ts`, `src/utils/config.ts`
- Impact: Technical debt accumulates; new code may continue using deprecated patterns
- Fix approach: Replace with async alternatives; update callers

## Known Bugs

**Bun spawnSync CPU Issue:**
- Issue: `spawnSync` in tight loops causes CPU spikes (documented at 7.2% of total CPU)
- Files: `src/services/mcp/auth.ts:1546-1547`
- Trigger: High-frequency token operations
- Workaround: Caching implemented; noted in comments

**GrowthBook Malformed API Response:**
- Issue: API returns `value` instead of `defaultValue` in feature responses
- Files: `src/services/analytics/growthbook.ts:50-57, 330`
- Trigger: Feature flag evaluation
- Workaround: Type `MalformedFeatureDefinition` with optional `value?: unknown`

**e2e Test Fails Without Optional Chaining:**
- Issue: Test fails if `?.` is removed from a specific line
- Files: `src/services/mcp/utils.ts:357`
- Trigger: Unknown - likely timing or race condition in e2e test
- Workaround: Optional chaining preserved despite linting rules

**Buffer.allocUnsafe Usage:**
- Issue: Multiple uses of `Buffer.allocUnsafe()` throughout codebase
- Files: `src/utils/sessionStorage.ts`, `src/utils/sessionStoragePortable.ts`, `src/utils/fsOperations.ts`
- Impact: Potential security concern if buffer is used before initialization
- Fix approach: Use `Buffer.alloc()` instead where possible

## Security Considerations

**Bash Security:**
- Risk: Command injection through malicious shell input
- Files: `src/tools/BashTool/bashSecurity.ts` (2000+ lines), `src/tools/BashTool/bashPermissions.ts`
- Current mitigation: Extensive pattern matching for dangerous constructs including:
  - Process substitution `<()`, `>()`, `=()`
  - Command substitution `$()`, backticks
  - Parameter expansion `${}`, `$[]`
  - Zsh dangerous commands (zmodload, ztcp, zpty, etc.)
  - PowerShell comment injection protection
- Recommendations: Continue denylist approach; consider allowlist for restricted environments

**OAuth Token Storage:**
- Risk: Tokens stored in secure storage but refresh has race condition
- Files: `src/services/mcp/auth.ts:1743-1749`
- Current mitigation: Single-process deduplication via `_refreshInProgress` flag
- Recommendations: Add cross-process lockfile for multi-instance scenarios

**Environment Variable Exposure:**
- Risk: Sensitive values potentially logged or exposed
- Files: Multiple files access `process.env.*` for API keys and secrets
- Current mitigation: Never read .env contents; access pattern is `process.env.VAR_NAME`
- Recommendations: Continue current practice; audit any new logging of env vars

**Secret Scanning in Team Memory:**
- Risk: Scanner may miss new secret patterns
- Files: `src/services/teamMemorySync/secretScanner.ts`
- Current mitigation: Extensive rule set including Sentry, GitHub, AWS tokens
- Recommendations: Add rules for new secret formats as they're discovered

## Performance Bottlenecks

**Large Files (5000+ lines):**
- Problem: Several files exceed 5000 lines causing potential maintainability issues
- Files:
  - `src/cli/print.ts` (5594 lines)
  - `src/utils/messages.ts` (5591 lines)
  - `src/utils/sessionStorage.ts` (5153 lines)
  - `src/utils/hooks.ts` (5022 lines)
  - `src/screens/REPL.tsx` (5009 lines)
  - `src/main.tsx` (4684 lines)
- Cause: Feature-rich CLI with many responsibilities consolidated
- Improvement path: Extract cohesive subunits into separate modules

**GrowthBook Caching Complexity:**
- Problem: Multiple layers of caching (memory, disk, stale-while-revalidate)
- Files: `src/services/analytics/growthbook.ts`
- Cause: Balancing fresh feature values with network performance
- Improvement path: Simplify to single cache layer if acceptable

**Session Storage Large File Handling:**
- Problem: 8MB+ read buffers using unsafe allocation
- Files: `src/utils/sessionStoragePortable.ts:734`
- Improvement path: Stream processing instead of full read

## Fragile Areas

**Bash Parser:**
- Files: `src/utils/bash/bashParser.ts` (4436 lines), `src/utils/bash/ast.ts` (2679 lines)
- Why fragile: Complex AST generation from shell syntax; edge cases in parsing can cause misclassification
- Safe modification: Add comprehensive test cases for any new parsing rules
- Test coverage: No dedicated test files found; relies on integration testing

**MCP Client Connection Management:**
- Files: `src/services/mcp/client.ts` (3350 lines)
- Why fragile: Complex memoization for connection reuse; timeout handling with AbortSignal
- Safe modification: Understand the memoization before modifying connection logic
- Test coverage: No dedicated test files

**Plugin Loader:**
- Files: `src/utils/plugins/pluginLoader.ts` (3302 lines), `src/utils/plugins/marketplaceManager.ts` (2643 lines)
- Why fragile: Dynamic loading with security checks; market place fetching with caching
- Safe modification: Ensure plugin validation runs before any dynamic import

**REPL Screen Rendering:**
- Files: `src/screens/REPL.tsx` (5009 lines)
- Why fragile: Large React component with many states; Ink rendering optimizations critical
- Safe modification: Profile any changes with large conversation histories

## Scaling Limits

**Feature Flag Expansion:**
- Current capacity: 88 flags with complex dependency chains
- Limit: Build times increase with each flag; maintenance burden grows
- Scaling path: Consider runtime configuration for less critical flags

**Session History:**
- Current capacity: Full message history retained until compaction
- Limit: Context window limits; large conversations hit token limits
- Scaling path: Compaction already implemented; verify effectiveness at scale

**Concurrent MCP Connections:**
- Current capacity: Managed per-server with keep-alive
- Limit: Network file descriptor limits; each connection uses resources
- Scaling path: Connection pooling for high-scale deployments

## Dependencies at Risk

**GrowthBook SDK:**
- Risk: Heavy coupling to `@growthbook/growthbook` SDK behavior
- Impact: Workarounds in `src/services/analytics/growthbook.ts` suggest SDK quirks
- Migration plan: Could replace with direct API calls if SDK becomes problematic

**Axios:**
- Risk: Several direct axios imports for HTTP operations
- Impact: Could be standardized to use native fetch or single HTTP client
- Migration plan: Consider centralizing on undici (already a dependency)

**OpenTelemetry:**
- Risk: Heavy instrumentation with multiple exporters
- Impact: Complex initialization; potential for export failures to impact main flow
- Migration plan: Could simplify to basic logging if full observability not needed

**Lodash-es:**
- Risk: Many lodash imports for utility functions
- Impact: Bundle size impact; many utilities now native in modern JS
- Migration plan: Gradual replacement with native equivalents

## Missing Critical Features

**Test Suite:**
- Problem: No test files found in `src/` directory
- Blocks: Safe refactoring; regression detection; confidence in changes
- Priority: HIGH - Without tests, any refactoring carries significant risk

**CI/CD Pipeline:**
- Problem: Not detected in this analysis
- Blocks: Automated builds; PR validation; release automation
- Priority: MEDIUM - Manual build process works but limits collaboration

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: All core functionality lacks unit tests
- Files: Entire codebase (no test files found)
- Risk: Silent regressions; bug introduction goes unnoticed
- Priority: CRITICAL

**No Integration Tests:**
- What's not tested: Service interactions, API flows, MCP connections
- Risk: Integration points break without detection
- Priority: HIGH

**No E2E Tests:**
- What's not tested: Full user flows through the CLI
- Risk: End-to-end functionality breaks without warning
- Priority: HIGH

---

*Concerns audit: 2026-04-29*