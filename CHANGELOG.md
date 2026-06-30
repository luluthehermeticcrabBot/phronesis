# Changelog

## [0.1.0] — 2026-06-30

### Added
- CLI with 17 commands: chat, continue, fork, version, config, profile, gateway,
  skills, sessions, create-plugin, plugin, dashboard, completion, doctor, setup,
  send (telegram/webhook/slack/discord), migrate (claw/hermes)
- Plugin registry with 7 verified + 3 community plugins
- Dashboard SPA (Express + vanilla JS) with session browser, config viewer, gateway controls
- Webhook adapter (Express) supporting Slack, Discord, Telegram, and generic webhooks
- MkDocs documentation site deployed to GitHub Pages
- CI/CD: test.yml, publish.yml, docs.yml workflows
- Container build with HEALTHCHECK for serve-2
- Install script (`curl | bash` via raw.githubusercontent.com)
- 7 Phronesis plugins: skill-creator, session-search, persona, memory-consolidation,
  user-profiling, skill-lifecycle, remote-execution

### Tests
- 40 CLI unit tests (config, paths, opencode wrapper, search, constants)
- 78 container integration tests (plugin runtime)
- 63 plugin integration tests (per-plugin tool registration and logic)
- 1 E2E smoke test
