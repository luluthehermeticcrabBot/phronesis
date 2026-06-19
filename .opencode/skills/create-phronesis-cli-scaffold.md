# Skill: create-phronesis-cli-scaffold

## Description
Scaffold the phronesis Hermes-inspired CLI wrapper for OpenCode, with yargs router, subcommands (version, config, profile, gateway), profile shorthand scripts at ~/.local/bin, and YAML-based config management.

## Trigger
Setting up a new phronesis CLI project or adding commands to a phronesis-style CLI wrapper

## Steps

1. Create directory structure: cli/{bin,src/commands,src/lib}
2. Write package.json with type:module, bin.phronesis, deps (yargs, js-yaml)
3. Write bin/phronesis.js as shebang entry point
4. Write src/constants.js with config paths (PHRONESIS_HOME, PROFILES_DIR, LOCAL_BIN, VERSION)
5. Write src/lib/paths.js with dir resolution functions (ensureConfigDir, ensureProfileDir, profileDir, profileConfigPath, profileScriptPath, etc.)
6. Write src/lib/config.js with YAML-based global config get/set (dot-notation keys), profile config get/set, profile listing, active profile management
7. Write src/lib/opencode.js with profile-aware shell-out to opencode binary (opencode(), opencodeRun(), opencodeAvailable())
8. Write src/commands/version.js as yargs module object { command, describe, builder, handler }
9. Write src/commands/config.js with get/set/path actions
10. Write src/commands/profile.js with list/current/use/create/delete/path actions + shorthand script creation at ~/.local/bin/<name>
11. Write src/cli.js building a yargs instance with --profile global flag, core commands (chat/continue/fork), subcommand groups (version/config/profile/gateway/skills/sessions/setup/doctor/migrate/completion)
12. Install deps and symlink bin to ~/.local/bin/ for testing
13. Subcommands use module object pattern (export { command, describe, builder, handler }) not function-passing

## Tools
write, edit, bash, read
