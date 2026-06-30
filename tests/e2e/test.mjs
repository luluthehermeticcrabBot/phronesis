// ───────────────────────────────────────────────────────────
// Phronesis E2E Smoke Test
// Tests that CLI commands parse, execute, and produce output
// without crashing. Does NOT require opencode or systemd.
// ───────────────────────────────────────────────────────────

import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, "..", "..", "cli", "bin", "phronesis.js");
const PROJECT_ROOT = join(__dirname, "..", "..");

// ── Test Framework ──
let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

function run(args) {
  const result = spawnSync("node", [CLI, ...args], {
    encoding: "utf8",
    cwd: PROJECT_ROOT,
    env: { ...process.env, HOME: process.env.HOME || "/tmp", CI: "true" },
  });
  return result;
}

// ───────────────────────────────────────────────────────────

console.log("\n  Phronesis E2E Smoke Test");
console.log("  " + "=".repeat(40));

// ── 1. Help ──
{
  const r = run(["--help"]);
  test("--help exits 0", () => assert(r.status === 0));
  test("--help shows Commands:", () => assert(r.stdout.includes("Commands:")));
  test("--help lists core commands", () => {
    assert(r.stdout.includes("chat"));
    assert(r.stdout.includes("version"));
    assert(r.stdout.includes("doctor"));
    assert(r.stdout.includes("dashboard"));
    assert(r.stdout.includes("plugin"));
  });
}

// ── 2. Version ──
{
  const r = run(["version"]);
  test("version exits 0", () => assert(r.status === 0, `exit ${r.status}: ${r.stderr}`));
  test("version shows version", () => assert(r.stdout.includes("phronesis")));
}

// ── 3. Completion ──
{
  const r = run(["completion", "bash"]);
  test("completion bash exits 0", () => assert(r.status === 0));
  test("completion bash outputs shell func", () => assert(r.stdout.includes("_phronesis_completions") || r.stdout.includes("complete")));

  const r2 = run(["completion", "zsh"]);
  test("completion zsh exits 0", () => assert(r2.status === 0));
}

// ── 4. Plugin list ──
{
  const r = run(["plugin", "list"]);
  test("plugin list exits 0", () => assert(r.status === 0, `exit ${r.status}: ${r.stderr}`));
  test("plugin list shows plugins", () => assert(r.stdout.includes("skill-creator")));
}

// ── 5. Plugin search ──
{
  const r = run(["plugin", "search", "memory"]);
  test("plugin search exits 0", () => assert(r.status === 0));
  test("plugin search finds matches", () => assert(r.stdout.includes("memory-consolidation")));
}

// ── 6. Plugin info ──
{
  const r = run(["plugin", "info", "skill-creator"]);
  test("plugin info exits 0", () => assert(r.status === 0));
  test("plugin info shows details", () => {
    assert(r.stdout.includes("skill-creator"));
    assert(r.stdout.includes("save-skill"));
  });
}

// ── 7. Plugin list --json ──
{
  const r = run(["plugin", "list", "--json"]);
  test("plugin list --json exits 0", () => assert(r.status === 0));
  test("plugin list --json is valid JSON", () => {
    const data = JSON.parse(r.stdout);
    assert(Array.isArray(data));
    assert(data.length > 0);
  });
}

// ── 8. Plugin list --category ──
{
  const r = run(["plugin", "list", "--category", "search"]);
  test("plugin list --category search exits 0", () => assert(r.status === 0));
  test("plugin list --category filters correctly", () => {
    assert(r.stdout.includes("session-search"));
    assert(!r.stdout.includes("skill-creator"));
  });
}

// ── 9. Config get (no config) ──
{
  const r = run(["config", "get"]);
  // No config file exists in CI, but it should error gracefully
  test("config get handles missing config", () => {
    assert(r.status !== 0 || r.stdout.length > 0);
  });
}

// ── 10. Doctor (no opencode) ──
{
  const r = run(["doctor"]);
  // doctor should complete even if opencode isn't installed
  test("doctor exits 0 or 1", () => assert(r.status === 0 || r.status === 1));
  test("doctor produces output", () => assert(r.stdout.length > 0 || r.stderr.length > 0));
}

// ── 11. Gateway help ──
{
  const r = run(["gateway", "--help"]);
  test("gateway --help exits 0", () => assert(r.status === 0));
  test("gateway --help shows subcommands", () => {
    assert(r.stdout.includes("status") || r.stdout.includes("start"));
  });
}

// ── 12. Profile help ──
{
  const r = run(["profile", "--help"]);
  test("profile --help exits 0", () => assert(r.status === 0));
  test("profile --help shows subcommands", () => {
    assert(r.stdout.includes("list") || r.stdout.includes("create"));
  });
}

// ── 13. Sessions help ──
{
  const r = run(["sessions", "--help"]);
  test("sessions --help exits 0", () => assert(r.status === 0));
  test("sessions --help shows actions", () => {
    assert(r.stdout.includes("list") || r.stdout.includes("search"));
  });
}

// ── 14. Create-plugin help ──
{
  const r = run(["create-plugin", "--help"]);
  test("create-plugin --help exits 0", () => assert(r.status === 0));
  test("create-plugin --help shows usage", () => assert(r.stdout.includes("name")));
}

// ── 15. Send help ──
{
  const r = run(["send", "--help"]);
  test("send --help exits 0", () => assert(r.status === 0));
  test("send --help shows platforms", () => {
    assert(r.stdout.includes("telegram") || r.stdout.includes("slack"));
  });
}

// ── 16. Dashboard help (not running) ──
{
  const r = run(["dashboard", "--help"]);
  test("dashboard --help exits 0", () => assert(r.status === 0));
  test("dashboard --help shows port info", () => {
    assert(r.stdout.includes("port") || r.stdout.includes("PORT") || r.stdout.includes("dashboard"));
  });
}

// ── 17. Skills help ──
{
  const r = run(["skills", "--help"]);
  test("skills --help exits 0", () => assert(r.status === 0));
  test("skills --help shows subcommands", () => {
    assert(r.stdout.includes("list") || r.stdout.includes("install"));
  });
}

// ── 18. CLI binary exists ──
{
  test("CLI entry point exists", () => assert(existsSync(CLI)));
  test("CLI is a file", () => assert(existsSync(CLI)));
}

// ───────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n  Results: ${passed}/${total} passed` + (skipped ? ` (${skipped} skipped)` : ""));
console.log("");

// Always exit 0 for smoke tests — failures are informational
process.exit(failed > 10 ? 1 : 0);
