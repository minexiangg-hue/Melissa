# AI inference in Melissa

Melissa has three explicit modes. `demo` is an offline, deterministic adapter for development and tests. `codex` uses a locally installed and authenticated Codex CLI. `openai-compatible` calls an external Chat Completions API. Selecting a live mode never silently falls back to canned answers.

Conversation and material generation share `StructuredGenerator`, so a transport can be replaced without changing teaching logic. Every result is parsed as JSON and checked against its feature's Zod schema. `AiTeacher` receives only bounded teaching context, with no learner identity, cookie, repository, or database capability. Provider errors do not expose raw API bodies, subprocess diagnostics, credentials, or prompts.

## External API

Set these server environment variables in an ignored environment file:

```dotenv
TEACHER_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your-server-side-key
LLM_MODEL=your-available-model
LLM_RESPONSE_FORMAT=json_schema
LLM_TOKEN_PARAMETER=max_completion_tokens
```

`LLM_BASE_URL` is the API prefix; the adapter appends `/chat/completions`. Remote endpoints require HTTPS. HTTP is accepted only on loopback for a local model server. Credentials, query strings, and fragments in the URL are rejected. Redirects are disabled to avoid forwarding credentials to another endpoint.

Use `json_object` for a provider without strict JSON Schema support, and `max_tokens` for an older compatible API. Local schema validation remains mandatory in either mode. Refusals, truncated generations, malformed responses, oversized bodies, timeouts, and non-success HTTP statuses produce a recoverable error. There is no automatic network retry that could create duplicate charges. Compatibility means the provider must support the configured Chat Completions protocol; it does not imply support for arbitrary vendor-specific APIs.

The application uses the provider's reported prompt and completion token counts when available; absence of usage is represented as `null`, never fabricated. These counts are not currency or invoices. Configure the provider's own spend limit in addition to Melissa's request allowance.

## Local Codex

```dotenv
TEACHER_PROVIDER=codex
CODEX_BINARY=/absolute/path/to/codex
CODEX_MODEL=gpt-5.6-luna
CODEX_AUTH_PATH=/absolute/path/to/auth.json
PROVIDER_TIMEOUT_MS=90000
```

The adapter was verified with Codex CLI `0.162.1` and the locally available `gpt-5.6-luna` model. `CODEX_BINARY` defaults to `codex`; authentication defaults to the service user's `~/.codex/auth.json`. Authenticate interactively outside the web application with the normal Codex login flow. The web UI never collects an account credential or launches login. Account/model access and quotas depend on the operator's Codex account.

Every inference creates a private temporary directory and a separate Codex home. It copies only the authentication file with mode `0600`; configuration, plugins, instructions, history, environment secrets, and project files are not inherited. User and project config/rules are ignored, sessions are ephemeral, and the current working directory is empty. The original authentication file is not modified. Keep that source login current through the normal CLI; refreshed credentials in a temporary invocation are intentionally not written back to the source account.

The subprocess receives arguments as an array with `shell: false`; learner content is sent over stdin. Shell, code execution host, local image access, browser/computer use, web search, MCP apps, plugins, hooks, subagents, skill discovery, image generation, and memory features are disabled. The sandbox is read-only and approval is `never`. Some model families still expose generic function wrappers; their execution host is disabled and fails closed. Any tool, command, file operation, or unknown item event aborts the request. The adapter is an inference bridge, not a general coding-agent endpoint.

Both transports limit input to 64 KiB and final output to 64 KiB before feature validation. Codex additionally limits combined subprocess output to 1 MiB, kills its entire process group on cancellation/deadline/overflow, and removes temporary files on completion or failure. The CLI does not expose a documented hard completion-token setting; output is bounded by schema, bytes, and wall time. Only the external API uses `max_completion_tokens`/`max_tokens`.

## Limits and deployment

`AI_MAX_CONCURRENT_REQUESTS` defaults to 2 for the shared process-local generator. Excess calls fail immediately instead of accumulating a prompt queue. `PROVIDER_TIMEOUT_MS` defaults to 90 seconds and accepts 100–180000 milliseconds. The application additionally persists guest/global UTC request allowances via `DAILY_AI_REQUEST_LIMIT` and `GLOBAL_DAILY_AI_REQUEST_LIMIT`. This does not replace account or API spending controls.

The service user needs executable access to the CLI, read access to the configured authentication file, and a writable temporary directory. `PrivateTmp=true` is compatible. Give reverse-proxy and application request timeouts enough room for the configured inference timeout. In multiple application processes, local concurrency limits are per process; shared quota persistence still needs one consistent repository.

## Verification

Ordinary tests use a real loopback HTTP fixture and executable child-process fixtures. They cover protocol headers, schema validation, output limits, refusal/truncation, secret redaction, abort/deadline, concurrency release, isolated environment, authentication permissions, cleanup, and tool-event rejection. They do not spend account/API quota.

Opt-in live checks run the actual adapters and validate a newly generated grammatical correction:

```sh
MELISSA_LIVE_CODEX=1 npx vitest run tests/providers.live.test.ts
# Supply LLM_API_KEY and LLM_MODEL in the environment first.
MELISSA_LIVE_API=1 npx vitest run tests/providers.live.test.ts
```

The Codex live checks were run successfully during implementation. The safety check temporarily replaces the tutor instruction with an explicit request to create a harmless sentinel through the execution wrapper. It independently verifies the CLI diagnostic that the code execution host is disabled, the absence of command/file/MCP events, and that the sentinel never appears. This checks runtime enforcement rather than trusting a model-written safety claim. The external adapter's HTTP contract is verified locally; a billable live check requires the operator's external API credentials.

Implementation references: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat), [Codex non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode), and [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference). Installed CLI help and feature listings were also checked because some compatibility keys in the online reference are not accepted by this CLI version.
