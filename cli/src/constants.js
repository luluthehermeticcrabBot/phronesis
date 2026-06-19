import { homedir } from "node:os";
import { join } from "node:path";

/** Root Phronesis config directory. */
export const PHRONESIS_HOME = join(homedir(), ".config", "phronesis");

/** Global config file. */
export const GLOBAL_CONFIG_PATH = join(PHRONESIS_HOME, "config.yaml");

/** Profiles directory. */
export const PROFILES_DIR = join(PHRONESIS_HOME, "profiles");

/** Default profile name. */
export const DEFAULT_PROFILE = "default";

/** Bin directory for profile shorthand scripts. */
export const LOCAL_BIN = join(homedir(), ".local", "bin");

/** phronesis CLI version (keep in sync with package.json). */
export const VERSION = "0.1.0";
