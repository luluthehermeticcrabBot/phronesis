import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..", "..");

const PLUGIN_INDEX_TPL = (name) => `import { tool } from "@opencode-ai/plugin";

/**
 * ${name} plugin
 *
 * Describe what this plugin does here.
 */
export default async function plugin(ctx) {
  // Register tools
  ctx.registerTool(
    tool("${name}-hello", "A friendly greeting tool", async (input, context) => {
      return { message: "Hello from the ${name} plugin!" };
    })
  );

  // Register hooks
  ctx.on("tool.execute.after", async (event) => {
    // React to tool executions
  });

  console.error("[${name}] plugin loaded");
}
`;

const PACKAGE_TPL = (name) => `{
  "name": "opencode-${name}",
  "version": "0.1.0",
  "description": "OpenCode plugin: ${name}",
  "type": "module",
  "main": "index.js",
  "opencode": {
    "type": "plugin",
    "hooks": ["tool.execute.after"]
  },
  "dependencies": {
    "@opencode-ai/plugin": "^1.14.19"
  }
}
`;

export const command = "create-plugin <name>";
export const describe = "Scaffold a new Phronesis plugin";

export function builder(yargs) {
  return yargs
    .positional("name", {
      describe: "Plugin name (kebab-case, e.g. 'code-review')",
      type: "string",
      demandOption: true,
    })
    .option("dir", {
      describe: "Target directory (default: src/<name>)",
      type: "string",
    })
    .option("skip-install", {
      describe: "Skip npm install after scaffolding",
      type: "boolean",
      default: false,
    });
}

export function handler(argv) {
  const name = argv.name;

  // Validate plugin name
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error(`[phronesis] Invalid plugin name "${name}". Use kebab-case: letters, numbers, and hyphens only.`);
    process.exit(1);
  }

  const targetDir = argv.dir || join(PROJECT_ROOT, "src", name);
  const indexFile = join(targetDir, "index.js");
  const pkgFile = join(targetDir, "package.json");

  // Check for conflicts
  if (existsSync(targetDir)) {
    console.error(`[phronesis] Directory already exists: ${targetDir}`);
    console.error(`  Use --dir to specify a different target.`);
    process.exit(1);
  }

  // Create directory tree
  mkdirSync(targetDir, { recursive: true });

  // Write files
  writeFileSync(indexFile, PLUGIN_INDEX_TPL(name), "utf8");
  writeFileSync(pkgFile, PACKAGE_TPL(name), "utf8");

  console.log(`[phronesis] Plugin "${name}" scaffolded at:`);
  console.log(`  ${indexFile}`);
  console.log(`  ${pkgFile}`);

  // npm install
  if (!argv["skip-install"]) {
    console.log(`[phronesis] Installing dependencies...`);
    const result = spawnSync("npm", ["install"], {
      cwd: targetDir,
      stdio: "inherit",
      encoding: "utf8",
      timeout: 120_000,
    });

    if (result.status === 0) {
      console.log(`[phronesis] Dependencies installed.`);
    } else {
      console.error(`[phronesis] npm install exited with code ${result.status}.`);
      console.error(`  Run "cd ${targetDir} && npm install" manually.`);
    }
  }

  // Registration instructions
  console.log(`\n  Next steps:`);
  console.log(`  1. Register the plugin in your opencode.json:`);
  console.log(`     {`);
  console.log(`       "plugins": ["file://${targetDir}"]`);
  console.log(`     }`);
  console.log(`  2. Edit ${indexFile} to add your plugin logic`);
  console.log(`  3. Reload the opencode server to pick up changes\n`);
}
