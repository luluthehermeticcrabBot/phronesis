import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..", "..");

const REGISTRY_URL =
  "https://raw.githubusercontent.com/luluthehungrycat/phronesis/main/plugins/registry.json";

/**
 * Load the plugin registry from a local file or remote URL.
 * Tries local file first, then remote fetch.
 */
async function loadRegistry() {
  // Try local file first
  const localPath = join(PROJECT_ROOT, "plugins", "registry.json");
  if (existsSync(localPath)) {
    try {
      const raw = readFileSync(localPath, "utf8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    } catch {
      // Fall through to remote
    }
  }

  // Try remote fetch
  try {
    const response = await fetch(REGISTRY_URL);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) return data;
    }
  } catch {
    // Fall through to error
  }

  return null;
}

/**
 * Format a table row with padded columns.
 */
function padEnd(str, len) {
  const visible = str.replace(/\x1b\[[0-9;]*m/g, "");
  const padding = Math.max(0, len - visible.length);
  return str + " ".repeat(padding);
}

/**
 * Display the plugin list output.
 */
function displayPluginList(plugins, opts = {}) {
  if (opts.json) {
    console.log(JSON.stringify(plugins, null, 2));
    return;
  }

  if (plugins.length === 0) {
    console.log("  (no matching plugins found)");
    return;
  }

  const nameWidth = Math.max(...plugins.map((p) => p.name.length)) + 2;

  for (const p of plugins) {
    const verified = p.verified ? "\u2713 verified" : "";
    console.log(
      `  ${padEnd(p.name, nameWidth)} ${p.description} ${verified ? "  " + verified : ""}`
    );
  }
}

export const command = "plugin <action> [query]";
export const describe = "Search and browse the Phronesis plugin registry";

export function builder(yargs) {
  return yargs
    .positional("action", {
      describe: "Action: search, info, list",
      choices: ["search", "info", "list"],
    })
    .positional("query", {
      describe: "Search term (for 'search') or plugin name (for 'info')",
      type: "string",
    })
    .option("verified", {
      describe: "Filter to verified plugins only (for 'list')",
      type: "boolean",
    })
    .option("json", {
      describe: "Output as JSON",
      type: "boolean",
      default: false,
    });
}

export async function handler(argv) {
  const registry = await loadRegistry();

  if (!registry) {
    console.error(
      "[phronesis] Could not load plugin registry from local file or remote."
    );
    console.error(
      `  Browse plugins manually at: ${REGISTRY_URL}`
    );
    process.exit(1);
  }

  switch (argv.action) {
    // ── list ───────────────────────────────────────────────
    case "list": {
      let plugins = registry;
      if (argv.verified) {
        plugins = plugins.filter((p) => p.verified);
      }
      if (argv.json) {
        console.log(JSON.stringify(plugins, null, 2));
      } else {
        console.log("Available plugins:");
        displayPluginList(plugins);
      }
      break;
    }

    // ── search ─────────────────────────────────────────────
    case "search": {
      if (!argv.query) {
        console.error("Usage: phronesis plugin search <query>");
        process.exit(1);
      }
      const q = argv.query.toLowerCase();
      const matches = registry.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.tools || []).some((t) => t.toLowerCase().includes(q))
      );

      if (argv.json) {
        console.log(JSON.stringify(matches, null, 2));
      } else {
        if (matches.length === 0) {
          console.log(`No results for "${argv.query}".`);
        } else {
          console.log(`Results for "${argv.query}":`);
          displayPluginList(matches);
        }
      }
      break;
    }

    // ── info ───────────────────────────────────────────────
    case "info": {
      if (!argv.query) {
        console.error("Usage: phronesis plugin info <name>");
        process.exit(1);
      }
      const plugin = registry.find((p) => p.name === argv.query);

      if (!plugin) {
        console.error(`Plugin "${argv.query}" not found in registry.`);
        process.exit(1);
      }

      if (argv.json) {
        console.log(JSON.stringify(plugin, null, 2));
      } else {
        console.log(`Plugin: ${plugin.name}`);
        console.log(`  Description: ${plugin.description}`);
        console.log(`  Path:       ${plugin.path}`);
        console.log(`  Tools:      ${(plugin.tools || []).join(", ")}`);
        console.log(`  Verified:   ${plugin.verified ? "\u2713" : "x"}`);
        console.log(`  Repo:       ${plugin.repo}`);
      }
      break;
    }
  }
}
