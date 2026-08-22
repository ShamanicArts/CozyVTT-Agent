# CozyVTT-Agent

CozyVTT-Agent is an installed, trusted CozyVTT plugin that adapts the host's
campaign-scoped capability interface to MCP Streamable HTTP. CozyVTT owns OAuth,
campaign authorization, approvals, command execution, replay, audit, and result
validation. This plugin owns MCP protocol behavior only.

It does not import CozyVTT backend code, access its database, or proxy through
an agent-specific HTTP API.

## Development

```sh
npm install
npm test
```

## Build an Installable Package

Use the same review key configured in CozyVTT. The command creates a bundled,
signed package under `build/cozyvtt-agent/` and prints its immutable checksum.

```sh
TRUSTED_EXTENSION_REVIEW_KEY=local-review-key npm run package:extension
```

Configure CozyVTT with:

```sh
EXTENSION_PACKAGE_ROOT=/path/to/CozyVTT-Agent/build
TRUSTED_EXTENSION_REVIEW_KEY=local-review-key
TRUSTED_EXTENSION_ALLOWLIST='[{"extensionId":"cozyvtt.agent","version":"0.2.0","checksum":"sha256:..."}]'
```

An administrator can then install and activate `cozyvtt.agent` through the
generic extension administration API. Its MCP resource is exposed at
`/api/plugin-transports/cozyvtt.agent/mcp`; OAuth discovery and token issuance
are provided by CozyVTT.
