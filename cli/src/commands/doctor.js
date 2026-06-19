import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveProfile, systemctl, opencodeAvailable } from "../lib/opencode.js";
import { getActiveProfile, getProfileConfig, getGlobalConfig, listProfiles } from "../lib/config.js";

import { GLOBAL_CONFIG_PATH } from "../constants.js";

function ok(label, msg) {
  console.log(`  ${label.padEnd(22)} ✅ ${msg || ""}`);
}

function warn(label, msg) {
  console.log(`  ${label.padEnd(22)} ⚠️  ${msg || ""}`);
}

function fail(label, msg) {
  console.log(`  ${label.padEnd(22)} ❌ ${msg || ""}`);
}

function skip(label) {
  console.log(`  ${label.padEnd(22)} 🔶 not checked`);
}

export const command = "doctor";
export const describe = "Run system diagnostics";
export const builder = {};

export function handler(argv) {
  const profile = resolveProfile(argv.profile);
  const config = getGlobalConfig();

  console.log(`\n  Phronesis Diagnostics\n`);

  // 1. opencode CLI
  if (opencodeAvailable()) {
    const ver = spawnSync("opencode", ["--version"], { encoding: "utf8", timeout: 5000 });
    ok("opencode CLI", ver.stdout?.trim() || "available");
  } else {
    fail("opencode CLI", "not found in PATH");
  }

  // 2. Active profile
  ok("active profile", profile);

  // 3. Config file
  if (existsSync(GLOBAL_CONFIG_PATH)) {
    ok("config file", GLOBAL_CONFIG_PATH);
  } else {
    fail("config file", `not found at ${GLOBAL_CONFIG_PATH}`);
  }

  // 4. Config validity
  try {
    if (config && typeof config === "object") {
      ok("config valid", "");
    } else {
      fail("config valid", "invalid YAML");
    }
  } catch {
    fail("config valid", "parse error");
  }

  // 5. Profiles
  const profiles = listProfiles();
  const activeProfile = getActiveProfile();
  if (profiles.length > 0) {
    ok("profiles", `${profiles.length} found (active: ${activeProfile})`);
    for (const p of profiles) {
      console.log(`    ${p === activeProfile ? "*" : " "} ${p}`);
    }
  } else {
    fail("profiles", "none found");
  }

  // 6. Node.js
  const [major] = process.version.slice(1).split(".").map(Number);
  if (major >= 18) {
    ok("Node.js", `v${process.versions.node}`);
  } else {
    fail("Node.js", `v${process.versions.node} (need >= 18)`);
  }

  // 7. Server config (profile overrides global)
  const profileCfg = getProfileConfig(profile);
  const globalCfg = getGlobalConfig();
  const serverCfg = profileCfg?.server || globalCfg?.server || {};
  const serverPort = serverCfg.port;
  const serverUrl = serverCfg.url;

  if (serverUrl) {
    ok("server URL", serverUrl);
  } else if (serverPort) {
    ok("server URL", `http://localhost:${serverPort}`);
  } else {
    skip("server URL");
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
        ok("server health", `HTTP ${httpCode}`);
      } else {
        fail("server health", `unreachable at ${checkUrl} (is opencode serve running?)`);
      }
    } catch {
      fail("server health", `unreachable at ${checkUrl}`);
    }
  } else {
    skip("server health");
  }

  // 9. Gateway
  try {
    const out = systemctl("is-active", `phronesis-gateway-${profile}-telegram-1`, { profile });
    ok("gateway", `active (telegram-1)`);
  } catch {
    try {
      const out = systemctl("is-active", "opencode-telegram", { profile });
      if (out?.trim() === "active") {
        ok("gateway", "active (legacy opencode-telegram)");
      } else {
        ok("gateway", "inactive");
      }
    } catch {
      ok("gateway", "not installed");
    }
  }

  // 10. Search DB
  const searchDbPaths = [
    join(homedir(), ".local", "share", "opencode", "phronesis_search.db"),
    join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "opencode", "phronesis_search.db"),
  ];
  const foundDb = searchDbPaths.find((p) => existsSync(p));
  if (foundDb) {
    ok("search DB", foundDb);
  } else {
    warn("search DB", "not found — run the server plugin to build the index");
  }

  // 11. Shell completions
  const completionPaths = [
    join(homedir(), ".local", "share", "bash-completion", "completions", "phronesis"),
    join(homedir(), ".zsh-completions", "_phronesis"),
    join(homedir(), ".config", "fish", "completions", "phronesis.fish"),
  ];
  const foundCompletion = completionPaths.find((p) => existsSync(p));
  if (foundCompletion) {
    ok("completions", foundCompletion);
  } else {
    warn("completions", "not installed — run 'phronesis completion bash | source'");
  }

  console.log("");
}
