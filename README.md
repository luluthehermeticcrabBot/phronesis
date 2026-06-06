# Phronesis

**Practical wisdom from agent experience.**  

Phronesis bridges the gap between OpenCode's powerful plugin ecosystem and Hermes Agent's adaptive learning capabilities. It brings auto-skill creation, session memory, self-improving skills, and intelligent experience reuse to OpenCode — turning raw agent interactions into compounding practical wisdom.

## Why

OpenCode has a rich plugin architecture, full MCP support, and a solid skill system — but it lacks the learning loop that makes Hermes Agent feel alive:

- **No auto-skill creation** — complex workflows are forgotten after the session
- **No session search** — past conversations are opaque
- **No self-improving skills** — SKILL.md files are static
- **No multi-platform gateway** — agents are TUI/CLI/Desktop only

Phronesis fills these gaps, one plugin at a time.

## Project Structure

```
docs/
├── 01-analysis.md               Hermes vs OpenCode gap analysis
├── 02-roadmap.md                Strategic phases and priorities
├── 03-architecture.md           Technical architecture for plugins
├── 04-first-steps.md            Getting started guide
├── 05-plugin-api-reference.md   OpenCode plugin API reference
├── 06-telegram-gateway.md       Telegram bot setup & config
├── 07-telegram-multi-instance.md  Multi-instance deployment
├── 08-gateway-strategy.md       Gateway architecture & plan
├── 09-progress-report.md        Current progress & lessons learned
└── 10-contributing.md           Development guide

src/
├── skill-creator/               P1 — Auto-skill creation plugin
├── session-search/              P2 — FTS5 session search plugin
├── persona/                     P4 — Structured persona plugin
└── memory-consolidation/        P5 — Local-first memory plugin

tests/
└── container/                   Podman/Docker test container
    ├── Dockerfile               Multi-stage build
    ├── test.mjs                 48-test suite
    └── entrypoint.sh            Test runner
```

## Status

| Plugin | Phase | Tests | Status |
|--------|-------|-------|--------|
| `skill-creator` | 🟢 P1 | ✅ 48/48 | Active |
| `session-search` | 🟢 P2 | ✅ 48/48 | Active |
| `persona` | 🟡 P4 | ✅ 48/48 | Active |
| `memory-consolidation` | 🟡 P5 | ✅ 48/48 | Active |

### Gateway

| Platform | Component | Status | Details |
|----------|-----------|--------|---------|
| Telegram | Bot 1 | ✅ Production | `opencode-telegram.service`, port 4096 |
| Telegram | Bot 2 | ✅ Production | `opencode-telegram-2.service`, port 4097 |
| Email | AgentMail MCP | ✅ Configured | Remote MCP at `mcp.agentmail.to` (needs API key) |
| CLI | Native | ✅ Always available | Direct terminal |

## Core Philosophy

1. **Leverage existing infrastructure** — SKILL.md, SQLite sessions, 20+ plugin hooks, MCP. Never rebuild what's already there.
2. **Composability over monoliths** — Each capability is a standalone OpenCode plugin that works independently and together.
3. **Learning as the differentiator** — The single highest-leverage feature is auto-skill creation. It compounds every session.
