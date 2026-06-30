import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveProfile, systemctl, opencodeAvailable } from "../lib/opencode.js";
import { getActiveProfile, getProfileConfig, getGlobalConfig, listProfiles } from "../lib/config.js";
import { enhanceError } from "../lib/error-helpers.js";
import { GLOBAL_CONFIG_PATH } from "../constants.js";

function ok(label, msg) {
  console.log(`  ${label.padEnd(22)} \u2705 ${msg || ""}`);
}

function warn(label, msg) {
  console.log(`  ${label.padEnd(22)} \u26a0\ufe0f  ${msg || ""}`);
}

function fail(label, msg) {
  console.log(`  ${label.padEnd(22)} \u274c ${msg || ""}`);
}

function skip(label) {
  console.log(`  ${label.padEnd(22)} \ud83d\udd36 not checked`);
}

export const command = "doctor";
export const describe = "Run system diagnostics";

export function builder(yargs) {
  return yargs.option("json", {
    type: "boolean",
    describe: "Output as JSON",
    default: false,
  });
}

function collectDiagnostics(argv) {
  const profile = resolveProfile(argv.profile);
  const checks = [];

  // 1. opencode CLI
  if (opencodeAvailable()) {
    let verStr = "available";
    try {
      const ver = spawnSync("opencode", ["--version"], { encoding: "utf8", timeout: 5000 });
      verStr = ver.stdout?.trim() || "available";
    } catch (e) {
      const enhanced = enhanceError(e, { command: "opencode --version" });
      verStr = enhanced.message;
    }
    checks.push({ name: "opencode CLI", status: "ok", message: verStr });
  } else {
    checks.push({ name: "opencode CLI", status: "fail", message: "Not found in PATH. Install opencode first." });
  }

  // 2. Active profile
  checks.push({ name: "active profile", status: "ok", message: profile });

  // 3. Config file
  if (existsSync(GLOBAL_CONFIG_PATH)) {
    checks.push({ name: "config file", status: "ok", message: GLOBAL_CONFIG_PATH });
  } else {
    checks.push({ name: "config file", status: "fail", message: `not found at ${GLOBAL_CONFIG_PATH}` });
  }

  // 4. Config validity
  try {
    const config = getGlobalConfig();
    if (config && typeof config === "object") {
      checks.push({ name: "config valid", status: "ok", message: "" });
    } else {
      checks.push({ name: "config valid", status: "fail", message: "invalid YAML" });
    }
  } catch {
    checks.push({ name: "config valid", status: "fail", message: "parse error" });
  }

  // 5. Profiles
  const profiles = listProfiles();
  const activeProfile = getActiveProfile();
  if (profiles.length > 0) {
    checks.push({
      name: "profiles",
      status: "ok",
      message: `${profiles.length} found (active: ${activeProfile})`,
      details: profiles,
    });
  } else {
    checks.push({ name: "profiles", status: "fail", message: "none found" });
  }

  // 6. Node.js
  const [major] = process.version.slice(1).split(".").map(Number);
  if (major >= 18) {
    checks.push({ name: "Node.js", status: "ok", message: `v${process.versions.node}` });
  } else {
    checks.push({ name: "Node.js", status: "fail", message: `v${process.versions.node} (need >= 18)` });
  }

  // 7. Server config (profile overrides global)
  const profileCfg = getProfileConfig(profile);
  const globalCfg = getGlobalConfig();
  const serverCfg = profileCfg?.server || globalCfg?.server || {};
  const serverPort = serverCfg.port;
  const serverUrl = serverCfg.url;

  if (serverUrl) {
    checks.push({ name: "server URL", status: "ok", message: serverUrl });
  } else if (serverPort) {
    checks.push({ name: "server URL", status: "ok", message: `http://localhost:${serverPort}` });
  } else {
    checks.push({ name: "server URL", status: "skip", message: "not configured" });
  }

  // 8. Server health
  const checkUrl = serverUrl || (serverPort ? `http://localhost:${serverPort}` : null);
  if (checkUrl) {
    try {
      const result = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "3", checkUrl], {
        encoding: "utf8",
        timeout: 10000,
      });
      const httpCode = result.stdout?.trim();
      if (httpCode && httpCode !== "000") {
        checks.push({ name: "server health", status: "ok", message: `HTTP ${httpCode}` });
      } else {
        checks.push({
          name: "server health",
          status: "fail",
          message: `unreachable at ${checkUrl} (is opencode serve running?)`,
        });
      }
    } catch (e) {
      const enhanced = enhanceError(e, { command: "curl health check" });
      checks.push({ name: "server health", status: "fail", message: `unreachable at ${checkUrl}` });
    }
  } else {
    checks.push({ name: "server health", status: "skip", message: "no URL configured" });
  }

  // 9. Gateway
  try {
    const out = systemctl("is-active", `phronesis-gateway-${profile}-telegram-1`, { profile });
    checks.push({ name: "gateway", status: "ok", message: "active (telegram-1)" });
  } catch {
    try {
      const out = systemctl("is-active", "opencode-telegram", { profile });
      if (out?.trim() === "active") {
        checks.push({ name: "gateway", status: "ok", message: "active (legacy opencode-telegram)" });
      } else {
        checks.push({ name: "gateway", status: "ok", message: "inactive" });
      }
    } catch {
      checks.push({ name: "gateway", status: "ok", message: "not installed" });
    }
  }

  // 10. Search DB
  const searchDbPaths = [
    join(homedir(), ".local", "share", "opencode", "phronesis_search.db"),
    join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "opencode", "phronesis_search.db"),
  ];
  const foundDb = searchDbPaths.find((p) => existsSync(p));
  if (foundDb) {
    checks.push({ name: "search DB", status: "ok", message: foundDb });
  } else {
    checks.push({
      name: "search DB",
      status: "warn",
      message: "not found \u2014 run the server plugin to build the index",
    });
  }

  // 11. Shell completions
  const completionPaths = [
    join(homedir(), ".local", "share", "bash-completion", "completions", "phronesis"),
    join(homedir(), ".zsh-completions", "_phronesis"),
    join(homedir(), ".config", "fish", "completions", "phronesis.fish"),
  ];
  const foundCompletion = completionPaths.find((p) => existsSync(p));
  if (foundCompletion) {
    checks.push({ name: "completions", status: "ok", message: foundCompletion });
  } else {
    checks.push({
      name: "completions",
      status: "warn",
      message: "not installed \u2014 run 'phronesis completion bash | source'",
    });
  }

  return { profile, timestamp: new Date().toISOString(), checks };
}

function printDiagnostics(data) {
  console.log(`\n  Phronesis Diagnostics\n`);
  for (const check of data.checks) {
    if (check.status === "ok") ok(check.name, check.message);
    else if (check.status === "warn") warn(check.name, check.message);
    else if (check.status === "fail") fail(check.name, check.message);
    else skip(check.name);
  }
  console.log("");
}

export function handler(argv) {
  const data = collectDiagnostics(argv);
  if (argv.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  printDiagnostics(data);
}
