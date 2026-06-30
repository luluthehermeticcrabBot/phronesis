import { execSync } from "node:child_process";
import { getConfigKey, setConfigKey, getGlobalConfig } from "../lib/config.js";
import { GLOBAL_CONFIG_PATH } from "../constants.js";

export const command = "config [action] [key] [value]";
export const describe = "Manage Phronesis configuration";

export function builder(yargs) {
  return yargs
    .positional("action", {
      describe: "Action: get, set, path, edit",
      choices: ["get", "set", "path", "edit"],
    })
    .positional("key", {
      describe: "Config key (dot-notation, e.g. defaults.model)",
      type: "string",
    })
    .positional("value", {
      describe: "Config value (for 'set')",
      type: "string",
    })
    .option("json", {
      describe: "Output as JSON",
      type: "boolean",
      default: false,
    });
}

export function handler(argv) {
  switch (argv.action) {
    case undefined: {
      // `phronesis config` with no action — show the full config
      const config = getGlobalConfig();
      console.log(JSON.stringify(config, null, 2));
      break;
    }

    case "get": {
      const value = getConfigKey(argv.key);
      if (argv.json) {
        console.log(JSON.stringify({ key: argv.key, value: value ?? null }));
        return;
      }
      if (value === undefined || value === null) {
        console.log("(not set)");
      } else if (typeof value === "object") {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(String(value));
      }
      break;
    }

    case "set": {
      if (!argv.key || argv.value === undefined) {
        console.error("Usage: phronesis config set <key> <value>");
        process.exit(1);
      }
      setConfigKey(argv.key, argv.value);
      console.log(`Set ${argv.key} = ${argv.value}`);
      break;
    }

    case "path": {
      console.log(GLOBAL_CONFIG_PATH);
      break;
    }

    case "edit": {
      const editor = process.env.EDITOR || process.env.VISUAL || "nano";
      execSync(`${editor} "${GLOBAL_CONFIG_PATH}"`, {
        stdio: "inherit",
        encoding: "utf8",
      });
      break;
    }

    default:
      console.error("Unknown action. Use: get, set, path, edit");
      process.exit(1);
  }
}
