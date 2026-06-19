import { readFileSync, writeFileSync, existsSync } from "node:fs";
import yaml from "js-yaml";
import { GLOBAL_CONFIG_PATH, PROFILES_DIR } from "../constants.js";
import { ensureConfigDir, profileConfigPath } from "./paths.js";

// ---------------------------------------------------------------------------
// Global config (~/.config/phronesis/config.yaml)
// ---------------------------------------------------------------------------

/**
 * Get the global config object.
 * Returns defaults if the file doesn't exist yet.
 */
export function getGlobalConfig() {
  if (!existsSync(GLOBAL_CONFIG_PATH)) {
    return {
      active_profile: "default",
      defaults: {
        model: "anthropic/claude-sonnet-4",
        agent: "orchestrator",
      },
    };
  }

  try {
    const raw = readFileSync(GLOBAL_CONFIG_PATH, "utf8");
    return yaml.load(raw) || {};
  } catch (err) {
    console.warn(`[phronesis] failed to read config: ${err.message}`);
    return {};
  }
}

/**
 * Write the global config file.
 */
export function writeGlobalConfig(config) {
  ensureConfigDir();
  writeFileSync(GLOBAL_CONFIG_PATH, yaml.dump(config, { indent: 2 }), "utf8");
}

/**
 * Get a single key from global config via dot-notation path.
 */
export function getConfigKey(key) {
  const config = getGlobalConfig();
  if (!key) return config;

  const parts = key.split(".");
  let value = config;
  for (const part of parts) {
    if (value === null || value === undefined || typeof value !== "object") {
      return undefined;
    }
    value = value[part];
  }
  return value;
}

/**
 * Set a single key in global config via dot-notation path.
 */
export function setConfigKey(key, value) {
  const config = getGlobalConfig();
  const parts = key.split(".");
  let current = config;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part];
  }

  // Coerce types
  const lastKey = parts[parts.length - 1];
  if (value === "true") value = true;
  else if (value === "false") value = false;
  else if (!isNaN(value) && value !== "") value = Number(value);

  current[lastKey] = value;

  writeGlobalConfig(config);
}

// ---------------------------------------------------------------------------
// Profile config (~/.config/phronesis/profiles/<name>/config.yaml)
// ---------------------------------------------------------------------------

/**
 * Get a profile's config.
 */
export function getProfileConfig(name) {
  const path = profileConfigPath(name);

  if (!existsSync(path)) {
    return {
      name,
      created: new Date().toISOString().slice(0, 10),
      gateways: {},
      plugins: {},
    };
  }

  try {
    const raw = readFileSync(path, "utf8");
    return yaml.load(raw) || {};
  } catch (err) {
    console.warn(`[phronesis] failed to read profile config: ${err.message}`);
    return { name };
  }
}

/**
 * Write a profile's config.
 */
export function writeProfileConfig(name, config) {
  const path = profileConfigPath(name);
  writeFileSync(path, yaml.dump(config, { indent: 2 }), "utf8");
}

// ---------------------------------------------------------------------------
// Profile listing
// ---------------------------------------------------------------------------

import { readdirSync } from "node:fs";
import { statSync } from "node:fs";

/**
 * List all available profiles (directories under PROFILES_DIR).
 */
export function listProfiles() {
  if (!existsSync(PROFILES_DIR)) return [];

  try {
    return readdirSync(PROFILES_DIR).filter((entry) => {
      const fullPath = profileConfigPath(entry);
      return statSync(fullPath).isFile() || existsSync(fullPath);
    });
  } catch {
    return [];
  }
}

/**
 * Get the active profile name.
 */
export function getActiveProfile() {
  const config = getGlobalConfig();
  return config.active_profile || "default";
}

/**
 * Set the active profile.
 */
export function setActiveProfile(name) {
  const config = getGlobalConfig();
  config.active_profile = name;
  writeGlobalConfig(config);
}
