import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProfile } from "../lib/opencode.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const command = "dashboard";
export const describe = "Launch the Phronesis web dashboard";
export const builder = {
  port: {
    describe: "Dashboard server port",
    type: "number",
    default: 4099,
  },
};

export function handler(argv) {
  const profile = resolveProfile(argv.profile);
  const dashboardServer = join(__dirname, "..", "..", "..", "servers", "dashboard", "index.js");

  if (!existsSync(dashboardServer)) {
    console.error(`Dashboard server not found at ${dashboardServer}`);
    console.error("Install the dashboard: npm install in servers/dashboard/");
    process.exit(1);
  }

  const env = {
    ...process.env,
    PORT: String(argv.port || 4099),
    PROFILE: profile,
  };

  console.log(`Starting Phronesis Dashboard for profile "${profile}"...`);
  console.log(`  URL: http://localhost:${argv.port || 4099}`);
  console.log("");

  const child = spawn("node", [dashboardServer], {
    env,
    stdio: "inherit",
    detached: false,
  });

  child.on("error", (err) => {
    console.error(`Failed to start dashboard: ${err.message}`);
    process.exit(1);
  });

  child.on("close", (code) => {
    if (code && code !== 0) {
      console.error(`Dashboard exited with code ${code}`);
      process.exit(code);
    }
  });
}
