# CozyVTT-Agent Instructions

This repository owns MCP and agent transport adaptation plus external runtime
concerns for CozyVTT.

- Use only CozyVTT's public campaign-scoped command and query capabilities.
- Never import CozyVTT backend internals or access its database, repositories,
  raw REST implementation routes, or Socket.IO events.
- CozyVTT remains authoritative for game state, authorization, approvals,
  execution, idempotent replay outcomes, auditing, and result redaction.
- Keep credentials and runtime state out of the repository.
