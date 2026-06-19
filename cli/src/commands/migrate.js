import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import yaml from "js-yaml";
import { ensureProfileDir, profileTelegramEnvPath } from "../lib/paths.js";
import { writeProfileConfig, writeGlobalConfig, listProfiles, getGlobalConfig } from "../lib/config.js";

export const command = "migrate <source>";
export const describe = "Migrate from other tools";

export function builder(yargs) {
  return yargs
    .positional("source", {
      describe: "Source to migrate from: claw, hermes",
      choices: ["claw", "hermes"],
    })
    .option("dry-run", {
      describe: "Preview migration without making changes",
      type: "boolean",
      default: false,
    });
}

// -------------------------------------------------------------------------
// Hermes Agent Migration (~/.hermes/)
// -------------------------------------------------------------------------

const HERMES_HOME = join(homedir(), ".hermes");
const HERMES_CONFIG = join(HERMES_HOME, "config.yaml");

function readHermesTelegram() {
  const possiblePaths = [
    join(HERMES_HOME, "gateways", "telegram.env"),
    join(HERMES_HOME, "gateways", "telegram-1.env"),
    join(HERMES_HOME, "bots", "telegram.env"),
    join(HERMES_HOME, "bots", "telegram-1.env"),
    join(HERMES_HOME, "telegram.env"),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf8");
      const botToken = raw.match(/BOT_TOKEN=(.+)/)?.[1]?.trim();
      const userId = raw.match(/ALLOWED_USER_ID=(.+)/)?.[1]?.trim();
      if (botToken) {
        return { path: p, botToken, userId };
      }
    }
  }

  return null;
}

function migrateHermes(dryRun) {
  if (!existsSync(HERMES_CONFIG)) {
    console.log("❌ Hermes Agent not found at ~/.hermes/");
    return;
  }

  const raw = readFileSync(HERMES_CONFIG, "utf8");
  const cfg = yaml.load(raw) || {};

  console.log("✅ Hermes Agent installation found at ~/.hermes/");

  const model = cfg.model?.default || "anthropic/claude-sonnet-4";
  const baseUrl = cfg.model?.base_url || "";

  console.log(`   Model: ${model}`);
  if (baseUrl) console.log(`   Base URL: ${baseUrl}`);

  // Telegram gateway
  const telegram = readHermesTelegram();
  if (telegram) {
    console.log(`   Telegram bot token: ✅ found (${telegram.botToken.slice(0, 8)}...${telegram.botToken.slice(-4)})`);
    if (telegram.userId) console.log(`   Allowed user ID: ${telegram.userId}`);
  }

  // Multi-profile
  const hermesProfilesDir = join(HERMES_HOME, "profiles");
  let hermesProfiles = [];
  if (existsSync(hermesProfilesDir)) {
    hermesProfiles = readdirSync(hermesProfilesDir).filter((entry) => {
      return existsSync(join(hermesProfilesDir, entry, "config.yaml"));
    });
  }

  if (hermesProfiles.length > 0) {
    console.log(`   Hermes profiles: ${hermesProfiles.length} found`);
    for (const p of hermesProfiles) console.log(`     - ${p}`);
  }

  // Determine what to create
  const existing = listProfiles();
  const toCreate = ["default", ...hermesProfiles].filter((n) => !existing.includes(n));

  if (toCreate.length === 0) {
    console.log("\n⚠️  All profiles already exist in Phronesis. Nothing to migrate.");
    return;
  }

  if (dryRun) {
    console.log("\n🔍 Dry-run — no changes made. Would create:");
    for (const name of toCreate) {
      console.log(`   - Profile "${name}"`);
      if (name === "default" && telegram) console.log(`     Telegram bot 1: configured`);
    }
    return;
  }

  // Create profiles
  for (const name of toCreate) {
    ensureProfileDir(name);

    const profileCfg = {
      name,
      created: new Date().toISOString().slice(0, 10),
      server: { port: 4097 },
      model,
      gateways: {},
      plugins: {},
    };

    if (name === "default" && telegram) {
      profileCfg.gateways = {
        telegram: {
          bots: [{ id: 1, enabled: true }],
        },
      };

      const envContent = [
        `BOT_TOKEN=${telegram.botToken}`,
        telegram.userId ? `ALLOWED_USER_ID=${telegram.userId}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      writeFileSync(profileTelegramEnvPath(name, 1), envContent, "utf8");
    }

    writeProfileConfig(name, profileCfg);
    console.log(`   ✅ Profile "${name}" created`);
  }

  // Set active if first profile
  const globalCfg = getGlobalConfig();
  if (!globalCfg.active_profile || globalCfg.active_profile === "") {
    globalCfg.active_profile = toCreate[0];
    writeGlobalConfig(globalCfg);
  }

  console.log("\n✅ Migration complete!");
  console.log(`   Run 'phronesis profile use ${toCreate[0]}' to switch.`);
}

// -------------------------------------------------------------------------
// OpenClaw / Claude Code Migration
// -------------------------------------------------------------------------

function migrateClaw(dryRun) {
  const projectDir = process.cwd();
  console.log(`📁 Scanning project: ${projectDir}`);

  // Find settings
  const settingsPaths = [
    join(projectDir, ".claude", "settings.json"),
    join(homedir(), ".claude", "settings.json"),
  ];

  let settings = null;
  for (const p of settingsPaths) {
    if (existsSync(p)) {
      try {
        settings = { path: p, config: JSON.parse(readFileSync(p, "utf8")) };
        break;
      } catch { /* ignore parse errors */ }
    }
  }

  // Find CLAW.md
  const mdPaths = [
    join(projectDir, "CLAW.md"),
    join(projectDir, ".claude", "CLAW.md"),
  ];

  let clawMd = null;
  for (const p of mdPaths) {
    if (existsSync(p)) {
      clawMd = { path: p, content: readFileSync(p, "utf8") };
      break;
    }
  }

  if (!settings && !clawMd) {
    console.log("❌ No OpenClaw/Claude Code config found.");
    console.log("   Looked for: .claude/settings.json, CLAW.md (project + home)");
    return;
  }

  if (settings) console.log(`✅ Claude Code settings: ${settings.path}`);
  if (clawMd) console.log(`✅ OpenClaw markdown: ${clawMd.path}`);

  const projectName = settings?.config?.projectName
    || dirname(projectDir).split("/").pop()
    || "default";

  const model = settings?.config?.model
    || settings?.config?.settings?.model
    || "anthropic/claude-sonnet-4";

  const permissions = settings?.config?.permissions?.allow
    || settings?.config?.settings?.permissions?.allow
    || [];

  console.log(`   Project: ${projectName}`);
  console.log(`   Model: ${model}`);
  if (permissions.length > 0) console.log(`   Permissions: ${permissions.length} rules found`);

  if (listProfiles().includes(projectName)) {
    console.log(`\n⚠️  Profile "${projectName}" already exists. Skipping.`);
    return;
  }

  if (dryRun) {
    console.log("\n🔍 Dry-run — no changes. Would create:");
    console.log(`   - Profile "${projectName}" (model: ${model})`);
    return;
  }

  ensureProfileDir(projectName);

  const profileCfg = {
    name: projectName,
    description: `Migrated from OpenClaw: ${projectDir}`,
    created: new Date().toISOString().slice(0, 10),
    server: { port: 4097 },
    model,
    plugins: {},
  };

  writeProfileConfig(projectName, profileCfg);
  console.log(`   ✅ Profile "${projectName}" created`);
  console.log("\n✅ Migration complete!");
  console.log(`   Run 'phronesis profile use ${projectName}' to switch.`);
}

// -------------------------------------------------------------------------
// Handler
// -------------------------------------------------------------------------

export function handler(argv) {
  const dryRun = argv["dry-run"] || false;

  switch (argv.source) {
    case "claw":
      migrateClaw(dryRun);
      break;
    case "hermes":
      migrateHermes(dryRun);
      break;
  }
}
