# External Integrations

**Analysis Date:** 2026-04-29

## APIs & External Services

### AI Model Providers

**Anthropic Claude API (Default):**
- Service: Primary AI model access via Messages API
- SDK: `@anthropic-ai/sdk` 0.80.0
- Auth: `ANTHROPIC_API_KEY` environment variable or OAuth via `/login`
- Client: `src/services/api/client.ts`

**AWS Bedrock:**
- Service: Claude models via AWS Bedrock
- SDK: `@anthropic-ai/bedrock-sdk` 0.26.4, `@aws-sdk/client-bedrock-runtime`
- Enable: `CLAUDE_CODE_USE_BEDROCK=1`
- Auth: AWS credentials via environment, IAM roles, or AWS profiles
- Region: `AWS_REGION` or `AWS_DEFAULT_REGION` (default: us-east-1)
- Client: `src/utils/model/bedrock.ts`

**Google Vertex AI:**
- Service: Claude models via Google Cloud Vertex AI
- SDK: `@anthropic-ai/vertex-sdk` 0.14.4, `google-auth-library`
- Enable: `CLAUDE_CODE_USE_VERTEX=1`
- Auth: GCP credentials via `gcloud` ADC or service account
- Project: `ANTHROPIC_VERTEX_PROJECT_ID` (required)
- Region: `CLOUD_ML_REGION` (default: us-east5)
- Client: `src/services/api/client.ts`

**Microsoft Azure Foundry:**
- Service: Claude models via Azure AI Foundry
- SDK: `@anthropic-ai/foundry-sdk` 0.2.3, `@azure/identity`
- Enable: `CLAUDE_CODE_USE_FOUNDRY=1`
- Auth: `ANTHROPIC_FOUNDRY_API_KEY` or Azure AD (DefaultAzureCredential)
- Resource: `ANTHROPIC_FOUNDRY_RESOURCE` or `ANTHROPIC_FOUNDRY_BASE_URL`
- Client: `src/services/api/client.ts`

**OpenAI Codex:**
- Service: Alternative model provider via OpenAI OAuth
- Auth: OAuth 2.0 PKCE flow at `auth.openai.com`
- Enable: `CLAUDE_CODE_USE_OPENAI=1`
- Client ID: `claude-code-client`
- Port: Fixed port 1455 for OAuth callback
- Client: `src/services/oauth/codex-client.ts`

### OAuth Providers

**Claude.ai (Anthropic):**
- Service: Subscription-based authentication for Pro/Max/Team/Enterprise users
- Authorize URL: `https://claude.com/cai/oauth/authorize`
- Token URL: `https://platform.claude.com/v1/oauth/token`
- Client ID: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- Scopes: `user:profile`, `user:inference`, `user:sessions:claude_code`, etc.
- Config: `src/constants/oauth.ts`

**OpenAI:**
- Service: OAuth for Codex users
- Authorize URL: `https://auth.openai.com/oauth/authorize`
- Token URL: `https://auth.openai.com/oauth/token`
- Scopes: `api`, `codex`
- Config: `src/constants/codex-oauth.ts`

### Model Context Protocol (MCP)

**MCP Server Integration:**
- SDK: `@modelcontextprotocol/sdk` 1.29.0
- Client: `src/services/mcp/client.ts`
- Config storage: `~/.claude/mcp.json` or project-level `.mcp.json`
- Supports: stdio, SSE, WebSocket transports
- Dynamic Client Registration (DCR): RFC 7591 for OAuth-enabled servers
- MCP Proxy: `https://mcp-proxy.anthropic.com/v1/mcp/{server_id}`

**MCP Server Types:**
- Stdio: Local process communication
- SSE: HTTP Server-Sent Events
- WebSocket: Real-time bidirectional communication
- In-process: Direct module import

## Data Storage

**Databases:**
- None (stateless CLI)
- Session data: File-based JSON storage in `~/.claude/`

**File Storage:**
- Local filesystem: Configuration, tokens, session history
- Config directory: `~/.claude/` (customizable via `CLAUDE_CONFIG_DIR`)
- Session history: `~/.claude/projects/{project-hash}/`
- OAuth tokens: `~/.claude/tokens-{suffix}.json` or keychain

**Caching:**
- In-memory LRU cache via `lru-cache` 11.2.7
- Package cache via `cacache` 20.0.4
- Token cache in memory with TTL

## Authentication & Identity

**Auth Providers:**

**OAuth (Claude.ai):**
- Provider: Anthropic OAuth server
- Implementation: `src/services/oauth/client.ts`
- Token refresh: Automatic with 5-minute buffer
- Token storage: Keychain (macOS), plaintext (other platforms)

**API Key:**
- Direct: `ANTHROPIC_API_KEY` environment variable
- Helper script: `apiKeyHelper` setting (custom credential provider)
- File descriptor: `CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR`

**AWS Credentials:**
- Provider: AWS SDK credential chain
- Methods: Environment variables, IAM roles, AWS profiles, SSO
- Client: `src/utils/aws.ts`

**GCP Credentials:**
- Provider: google-auth-library (ADC)
- Methods: Service account, gcloud ADC, metadata server
- Client: `src/services/api/client.ts`

**Azure Credentials:**
- Provider: @azure/identity
- Methods: Environment, CLI, managed identity
- Client: `src/services/api/client.ts`

**Secure Storage:**
- macOS: Keychain via Security framework
- Linux: Plaintext files (TODO: libsecret support)
- Windows: Plaintext files
- Implementation: `src/utils/secureStorage/index.ts`

## IDE Integrations

**VS Code:**
- Terminal detection: `TERM_PROGRAM=vscode`
- Extension integration: Claude Code extension
- MCP server support in extension
- Tips: `src/services/tips/tipRegistry.ts`

**JetBrains IDEs:**
- Supported: IntelliJ, PyCharm, WebStorm, etc.
- Integration: Claude Code plugin
- Detection: `src/utils/ide.ts`
- Status: `src/hooks/notifs/useIDEStatusIndicator.tsx`

**Claude Desktop:**
- MCP import: Import MCP servers from Claude Desktop config
- Deep links: Resume CLI sessions in Claude Desktop
- Platforms: macOS, WSL on Windows
- Config detection: `src/utils/claudeDesktop.ts`

## Monitoring & Observability

**OpenTelemetry:**
- API: `@opentelemetry/api` 1.9.1
- Logs SDK: `@opentelemetry/sdk-logs` 0.214.0
- Metrics SDK: `@opentelemetry/sdk-metrics` 2.6.1
- Traces SDK: `@opentelemetry/sdk-trace-base` 2.6.1
- Exporters: OTLP (grpc/http/proto), Prometheus
- Enable: `OTEL_LOG_TOOL_DETAILS=1` for tool parameter logging
- Config: Environment variables (`OTEL_EXPORTER_*`)

**Feature Flags:**
- Provider: GrowthBook
- SDK: `@growthbook/growthbook` 1.6.5
- Client: `src/services/analytics/growthbook.ts`

**Analytics:**
- Internal events: `src/services/analytics/`
- Event logging: First-party event exporter
- Metadata collection: Platform, CI, environment detection

## CI/CD & Deployment

**GitHub Actions:**
- Workflow: Pre-built workflow template
- Action: `anthropics/claude-code-action@v1`
- Trigger: `@claude` mentions in issues/PRs
- Config: `src/constants/github-app.ts`
- Setup docs: `https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md`

**Hosting:**
- Standalone binary: Built via `bun build --compile`
- Platform: macOS, Linux (Windows via WSL)
- No runtime dependencies

**Build System:**
- Builder: Bun build
- Features: Compile-time feature flags via `feature()`
- Output: Native executable

## Remote Sessions

**CCR (Claude Cloud Runtime):**
- Service: Remote session management
- WebSocket: `wss://api.anthropic.com/v1/sessions/ws/{sessionId}/subscribe`
- Client: `src/remote/RemoteSessionManager.ts`
- Transport: `src/remote/SessionsWebSocket.ts`

**SSH Tunneling:**
- Service: Auth proxy via SSH -R forward
- Socket: `ANTHROPIC_UNIX_SOCKET` environment variable
- Use case: Remote development sessions
- Implementation: `src/utils/proxy.ts`

**Bridge Mode:**
- Service: IDE remote control
- Feature flag: `BRIDGE_MODE`
- Client: `src/bridge/bridgeMain.ts`
- API: `src/bridge/bridgeApi.ts`

## Webhooks & Callbacks

**Incoming:**
- OAuth callbacks: Local HTTP server on random port (Anthropic) or fixed port 1455 (OpenAI)
- MCP elicitation: User prompts from MCP servers
- Bridge callbacks: IDE-initiated requests

**Outgoing:**
- MCP server calls: Via configured transports
- Remote agent scheduling: `src/skills/bundled/scheduleRemoteAgents.ts`

## Environment Configuration

**Required env vars (by provider):**

**Anthropic:**
- `ANTHROPIC_API_KEY` - API key for direct access

**AWS Bedrock:**
- `CLAUDE_CODE_USE_BEDROCK=1`
- `AWS_REGION` / `AWS_DEFAULT_REGION`
- AWS credentials via standard chain

**Vertex AI:**
- `CLAUDE_CODE_USE_VERTEX=1`
- `ANTHROPIC_VERTEX_PROJECT_ID`
- `CLOUD_ML_REGION` (optional)
- GCP credentials via ADC

**Azure Foundry:**
- `CLAUDE_CODE_USE_FOUNDRY=1`
- `ANTHROPIC_FOUNDRY_RESOURCE` or `ANTHROPIC_FOUNDRY_BASE_URL`
- `ANTHROPIC_FOUNDRY_API_KEY` (optional, uses Azure AD if not set)

**OpenAI Codex:**
- `CLAUDE_CODE_USE_OPENAI=1`
- OAuth via `/login`

**Optional env vars:**
- `CLAUDE_CONFIG_DIR` - Custom config directory
- `ANTHROPIC_BASE_URL` - Custom API endpoint
- `ANTHROPIC_AUTH_TOKEN` - Bearer token auth
- `CLAUDE_CODE_OAUTH_CLIENT_ID` - Custom OAuth client ID
- `CLAUDE_CODE_CUSTOM_OAUTH_URL` - FedStart/custom OAuth endpoint
- `OTEL_*` - OpenTelemetry configuration

**Secrets location:**
- OAuth tokens: `~/.claude/tokens*.json` or system keychain
- API keys: Environment variables or keychain
- MCP credentials: `~/.claude/mcp-auth.json` or keychain

## Voice Integration

**Speech-to-Text:**
- Service: Claude.ai voice endpoint
- Auth: Claude.ai OAuth subscription required
- Feature flag: `VOICE_MODE` (default in all builds)
- Client: `src/services/voiceStreamSTT.ts`

**Audio Capture:**
- Native module: `audio-capture-napi` (optional)
- Fallback: SoX, `rec` command
- Push-to-talk: Terminal UI integration

---

*Integration audit: 2026-04-29*