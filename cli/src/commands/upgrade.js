import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolve path to the CLI package.json (two levels up from src/commands/). */
function resolvePackageJson() {
  return join(__dirname, "..", "..", "package.json");
}

export const command = "upgrade";
export const describe = "Check for and install phronesis upgrades";

export function builder(yargs) {
  return yargs
    .option("dry-run", {
      type: "boolean",
      describe: "Check only, don't install",
      default: false,
    })
    .option("json", {
      type: "boolean",
      describe: "Output as JSON",
      default: false,
    });
}

export async function handler(argv) {
  try {
    // Read current version from package.json
    let currentVersion;
    try {
      const pkg = JSON.parse(readFileSync(resolvePackageJson(), "utf8"));
      currentVersion = pkg.version;
    } catch {
      if (argv.json) {
        console.log(JSON.stringify({ error: "Could not read package.json" }));
      } else {
        console.error("[phronesis] Could not determine current version.");
      }
      process.exit(1);
    }

    // Fetch latest version from npm registry
    let latestVersion;
    try {
      const response = await fetch("https://registry.npmjs.org/phronesis/latest");
      if (!response.ok) {
        throw new Error(`npm registry returned HTTP ${response.status}`);
      }
      const data = await response.json();
      latestVersion = data.version;
    } catch (fetchErr) {
      if (argv.json) {
        console.log(
          JSON.stringify({
            error: `Network error: ${fetchErr.message}`,
            current: currentVersion,
          })
        );
      } else {
        console.error(`[phronesis] Failed to check for updates: ${fetchErr.message}`);
        console.error("[phronesis] Check your internet connection.");
      }
      process.exit(1);
    }

    const isOutdated = currentVersion !== latestVersion;

    // JSON output
    if (argv.json) {
      const result = {
        current: currentVersion,
        latest: latestVersion,
        outdated: isOutdated,
      };
      console.log(JSON.stringify(result));
      return;
    }

    // Up to date
    if (!isOutdated) {
      console.log(`[phronesis] Already up to date (v${currentVersion})`);
      return;
    }

    // Outdated
    console.log(`[phronesis] Update available: v${currentVersion} → v${latestVersion}`);

    if (argv.dryRun) {
      console.log(`[phronesis] Run 'npm install -g phronesis' to upgrade.`);
      return;
    }

    // Perform upgrade
    try {
      console.log(`[phronesis] Installing v${latestVersion}...`);
      execSync("npm install -g phronesis", { stdio: "inherit", encoding: "utf8", timeout: 120_000 });
      console.log(`[phronesis] Upgraded to v${latestVersion}`);
    } catch (installErr) {
      const msg = installErr.message || "";
      if (msg.includes("EACCES")) {
        console.error("[phronesis] Permission denied. Try: sudo npm install -g phronesis");
      } else if (msg.includes("ENOENT")) {
        console.error("[phronesis] npm not found. Is Node.js installed?");
      } else {
        console.error(`[phronesis] Install failed: ${installErr.message}`);
      }
      process.exit(1);
    }
  } catch (err) {
    console.error(`[phronesis] Upgrade error: ${err.message}`);
    process.exit(1);
  }
}
