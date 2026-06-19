import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PHRONESIS_HOME, PROFILES_DIR, GLOBAL_CONFIG_PATH, LOCAL_BIN } from "../constants.js";

/**
 * Ensure the Phronesis config directory exists.
 */
export function ensureConfigDir() {
  if (!existsSync(PHRONESIS_HOME)) {
    mkdirSync(PHRONESIS_HOME, { recursive: true });
  }
}

/**
 * Ensure a profile's directory tree exists.
 */
export function ensureProfileDir(name) {
  const dir = profileDir(name);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "gateways"), { recursive: true });
  mkdirSync(join(dir, "data"), { recursive: true });
  return dir;
}

/**
 * Get the directory for a profile.
 */
export function profileDir(name) {
  return join(PROFILES_DIR, name);
}

/**
 * Get the path to a profile's config file.
 */
export function profileConfigPath(name) {
  return join(profileDir(name), "config.yaml");
}

/**
 * Get the path to a profile's opencode.json.
 */
export function profileOpencodeConfigPath(name) {
  return join(profileDir(name), "opencode.json");
}

/**
 * Get the path to a profile's Telegram env file.
 */
export function profileTelegramEnvPath(name, botId = 1) {
  return join(profileDir(name), "gateways", `telegram-${botId}.env`);
}

/**
 * Get the path to a profile shorthand script.
 */
export function profileScriptPath(name) {
  return join(LOCAL_BIN, name);
}

export {
  PHRONESIS_HOME,
  PROFILES_DIR,
  GLOBAL_CONFIG_PATH,
  LOCAL_BIN,
};
