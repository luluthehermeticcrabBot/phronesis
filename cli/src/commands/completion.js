export const command = "completion [shell]";
export const describe = "Generate shell completion script";

export function builder(yargs) {
  return yargs.positional("shell", {
    describe: "Shell type",
    choices: ["bash", "zsh", "fish"],
    default: "bash",
  });
}

export function handler(argv) {
  switch (argv.shell || "bash") {
    case "bash":
      console.log(bashScript);
      break;
    case "zsh":
      console.log(zshScript);
      break;
    case "fish":
      console.log(fishScript);
      break;
    default:
      console.error("Unknown shell: " + argv.shell + ". Use bash, zsh, or fish.");
      process.exit(1);
  }
}

const bashScript = [
  "# phronesis bash completion",
  "# Source this file:  source <(phronesis completion bash)",
  "# Or install:       phronesis completion bash > ~/.local/share/bash-completion/completions/phronesis",
  "",
  "_phronesis_completions() {",
  '  local cur="${\"COMP_WORDS[COMP_CWORD]\"}"',
  '  local prev="${\"COMP_WORDS[COMP_CWORD-1]\"}"',
  "",
  "  # Complete flags",
  '  if [[ "$cur" == -* ]]; then',
  '    COMPREPLY=($(compgen -W "--profile -p --port --url --help -h" -- "$cur"))',
  "    return",
  "  fi",
  "",
  '  if [[ "$COMP_CWORD" -eq 1 ]]; then',
  '    COMPREPLY=($(compgen -W "chat continue fork version config profile gateway skills sessions setup doctor migrate completion" -- "$cur"))',
  "    return",
  "  fi",
  "",
  '  case "$prev" in',
  '    gateway) COMPREPLY=($(compgen -W "status start stop restart logs install uninstall" -- "$cur")) ;;',
  '    skills)  COMPREPLY=($(compgen -W "list install update feedback" -- "$cur")) ;;',
  '    sessions) COMPREPLY=($(compgen -W "list search" -- "$cur")) ;;',
  '    config)  COMPREPLY=($(compgen -W "get set path edit" -- "$cur")) ;;',
  '    profile) COMPREPLY=($(compgen -W "list current use create delete path" -- "$cur")) ;;',
  '    migrate) COMPREPLY=($(compgen -W "claw hermes" -- "$cur")) ;;',
  '    completion) COMPREPLY=($(compgen -W "bash zsh fish" -- "$cur")) ;;',
  "  esac",
  "}",
  "",
  "complete -F _phronesis_completions phronesis",
].join("\n");

const zshScript = [
  "# phronesis zsh completion",
  "# Source this file:  source <(phronesis completion zsh)",
  "# Or install:       phronesis completion zsh > ~/.zsh-completions/_phronesis",
  "",
  "#compdef phronesis",
  "",
  "_phronesis_commands() {",
  "  local -a commands",
  "  commands=(",
  "    'chat:Start an interactive session or send a single query'",
  "    'continue:Continue the most recent session'",
  "    'fork:Fork the most recent session'",
  "    'version:Show version information'",
  "    'config:Manage Phronesis configuration'",
  "    'profile:Manage Phronesis profiles'",
  "    'gateway:Manage Telegram gateways'",
  "    'skills:Manage Phronesis skills'",
  "    'sessions:Browse and search sessions'",
  "    'setup:Run the first-time setup wizard'",
  "    'doctor:Run system diagnostics'",
  "    'migrate:Migrate from other tools'",
  "    'completion:Generate shell completion script'",
  "  )",
  "  _describe 'command' commands",
  "}",
  "",
  "_phronesis() {",
  "  local context state state_descr line",
  "  typeset -A opt_args",
  "",
  "  _arguments \\",
  "    '(-p --profile)'{-p,--profile}'[Use a specific profile]:profile:()' \\",
  "    '--port[OpenCode server port]:port:' \\",
  "    '--url[OpenCode server URL]:url:' \\",
  "    '(-h --help)'{-h,--help}'[Show help]' \\",
  "    '1: :->command' \\",
  "    '*:: :->args'",
  "",
  '  case "$state" in',
  "    command)",
  "      _phronesis_commands",
  "      ;;",
  "    args)",
  '      case "$words[1]" in',
  "        config)    _arguments '2:action:(get set path edit)' ;;",
  "        profile)   _arguments '2:action:(list current use create delete path)' ;;",
  "        gateway)   _arguments '2:action:(status start stop restart logs install uninstall)' ;;",
  "        skills)    _arguments '2:action:(list install update feedback)' ;;",
  "        sessions)  _arguments '2:action:(list search)' ;;",
  "        migrate)   _arguments '2:source:(claw hermes)' ;;",
  "        completion) _arguments '2:shell:(bash zsh fish)' ;;",
  "      esac",
  "      ;;",
  "  esac",
  "}",
  "",
  "compdef _phronesis phronesis",
].join("\n");

const fishScript = [
  "# phronesis fish completion",
  "# Source this file:  phronesis completion fish | source",
  "# Or install:       phronesis completion fish > ~/.config/fish/completions/phronesis.fish",
  "",
  "complete -c phronesis -f",
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a chat -d "Start an interactive session or send a single query"',
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a continue -d "Continue the most recent session"',
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a fork -d "Fork the most recent session"',
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a version -d "Show version information"',
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a config -d "Manage Phronesis configuration"',
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a profile -d "Manage Phronesis profiles"',
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a gateway -d "Manage Telegram gateways"',
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a skills -d "Manage Phronesis skills"',
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a sessions -d "Browse and search sessions"',
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a setup -d "Run the first-time setup wizard"',
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a doctor -d "Run system diagnostics"',
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a migrate -d "Migrate from other tools"',
  'complete -c phronesis -n "test (count __fish_argv) -le 1" -a completion -d "Generate shell completion script"',
  "",
  "# Subcommands",
  'complete -c phronesis -n "__fish_phronesis_using_command config" -a "get set path edit" -f',
  'complete -c phronesis -n "__fish_phronesis_using_command profile" -a "list current use create delete path" -f',
  'complete -c phronesis -n "__fish_phronesis_using_command gateway" -a "status start stop restart logs install uninstall" -f',
  'complete -c phronesis -n "__fish_phronesis_using_command skills" -a "list install update feedback" -f',
  'complete -c phronesis -n "__fish_phronesis_using_command sessions" -a "list search" -f',
  'complete -c phronesis -n "__fish_phronesis_using_command migrate" -a "claw hermes" -f',
  'complete -c phronesis -n "__fish_phronesis_using_command completion" -a "bash zsh fish" -f',
  "",
  "# Flags",
  'complete -c phronesis -s p -l profile -d "Use a specific profile" -r',
  'complete -c phronesis -l port -d "OpenCode server port" -r',
  'complete -c phronesis -l url -d "OpenCode server URL" -r',
  'complete -c phronesis -s h -l help -d "Show help"',
].join("\n");
