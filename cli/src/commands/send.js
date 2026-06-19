import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveProfile } from "../lib/opencode.js";
import { profileDir, profileTelegramEnvPath } from "../lib/paths.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a KEY=value env file, returning a map.
 */
function parseEnvFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return env;
}

/**
 * Load an env file from a profile's gateways directory.
 * Exits with a helpful message if the file doesn't exist.
 */
function loadEnv(profile, filename, hint) {
  const envPath = join(profileDir(profile), "gateways", filename);

  if (!existsSync(envPath)) {
    console.error(`Not configured for profile "${profile}".`);
    console.error(`Create ${envPath} with:`);
    console.error(hint);
    console.error(`Or run: phronesis setup`);
    process.exit(1);
  }

  try {
    return parseEnvFile(envPath);
  } catch (err) {
    console.error(`Failed to read ${envPath}: ${err.message}`);
    process.exit(1);
  }
}

/**
 * POST a JSON payload to a URL and report the result.
 */
async function sendMessage(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`❌ HTTP ${res.status}: ${text || res.statusText}`);
      process.exit(1);
    }

    console.log("📨 sent");
  } catch (err) {
    console.error(`❌ Request failed: ${err.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Subcommand: telegram
// ---------------------------------------------------------------------------

function telegramBuilder(yargs) {
  return yargs
    .positional("message", {
      describe: "Message text to send",
      type: "string",
    })
    .option("m", {
      alias: "message",
      describe: "Message text to send",
      type: "string",
    })
    .option("b", {
      alias: "bot",
      describe: "Bot ID (1 or 2)",
      type: "number",
      default: 1,
    })
    .option("chat-id", {
      describe: "Override the allowed user ID",
      type: "string",
    });
}

async function telegramHandler(argv) {
  const message = argv.message || argv.m;
  if (!message) {
    console.error("Usage: phronesis send telegram [--message <text>] [--bot <id>]");
    console.error("   or: phronesis send telegram \"<message text>\"");
    process.exit(1);
  }

  const profile = resolveProfile(argv.profile);
  const botId = argv.bot || 1;
  const envPath = profileTelegramEnvPath(profile, botId);

  if (!existsSync(envPath)) {
    console.error(`Telegram bot not configured for profile "${profile}".`);
    console.error(`Set up a bot token in ${envPath}:`);
    console.error(`  BOT_TOKEN=123456:ABC-DEF1234...`);
    console.error(`  ALLOWED_USER_ID=123456789`);
    console.error(`Or run: phronesis setup`);
    process.exit(1);
  }

  const env = loadEnv(profile, `telegram-${botId}.env`, "");

  const token = env.BOT_TOKEN;
  if (!token) {
    console.error(`BOT_TOKEN not found in ${envPath}`);
    process.exit(1);
  }

  const chatId = argv["chat-id"] || env.ALLOWED_USER_ID;
  if (!chatId) {
    console.error(`No chat target. Provide ALLOWED_USER_ID in ${envPath} or pass --chat-id`);
    process.exit(1);
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await sendMessage(url, {
    chat_id: chatId,
    text: message,
    parse_mode: "Markdown",
  });
}

// ---------------------------------------------------------------------------
// Subcommand: webhook
// ---------------------------------------------------------------------------

function webhookBuilder(yargs) {
  return yargs
    .positional("message", {
      describe: "Message text to send",
      type: "string",
    })
    .option("m", {
      alias: "message",
      describe: "Message text to send",
      type: "string",
    })
    .option("url", {
      describe: "Webhook URL (overrides WEBHOOK_URL in config)",
      type: "string",
    });
}

async function webhookHandler(argv) {
  const message = argv.message || argv.m;
  if (!message) {
    console.error("Usage: phronesis send webhook [--message <text>] [--url <url>]");
    process.exit(1);
  }

  const profile = resolveProfile(argv.profile);
  const env = loadEnv(profile, "webhook.env",
    "  WEBHOOK_URL=https://hooks.example.com/endpoint");

  const url = argv.url || env.WEBHOOK_URL;
  if (!url) {
    console.error(`WEBHOOK_URL not found. Pass --url or set it in the env file.`);
    process.exit(1);
  }

  await sendMessage(url, { text: message });
}

// ---------------------------------------------------------------------------
// Subcommand: slack
// ---------------------------------------------------------------------------

function slackBuilder(yargs) {
  return yargs
    .positional("message", {
      describe: "Message text to send",
      type: "string",
    })
    .option("m", {
      alias: "message",
      describe: "Message text to send",
      type: "string",
    })
    .option("url", {
      describe: "Slack webhook URL (overrides SLACK_WEBHOOK_URL in config)",
      type: "string",
    });
}

async function slackHandler(argv) {
  const message = argv.message || argv.m;
  if (!message) {
    console.error("Usage: phronesis send slack [--message <text>] [--url <url>]");
    process.exit(1);
  }

  const profile = resolveProfile(argv.profile);
  const env = loadEnv(profile, "slack.env",
    "  SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...");

  const url = argv.url || env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.error(`SLACK_WEBHOOK_URL not found. Pass --url or set it in the env file.`);
    process.exit(1);
  }

  await sendMessage(url, { text: message });
}

// ---------------------------------------------------------------------------
// Subcommand: discord
// ---------------------------------------------------------------------------

function discordBuilder(yargs) {
  return yargs
    .positional("message", {
      describe: "Message text to send",
      type: "string",
    })
    .option("m", {
      alias: "message",
      describe: "Message text to send",
      type: "string",
    })
    .option("url", {
      describe: "Discord webhook URL (overrides DISCORD_WEBHOOK_URL in config)",
      type: "string",
    });
}

async function discordHandler(argv) {
  const message = argv.message || argv.m;
  if (!message) {
    console.error("Usage: phronesis send discord [--message <text>] [--url <url>]");
    process.exit(1);
  }

  const profile = resolveProfile(argv.profile);
  const env = loadEnv(profile, "discord.env",
    "  DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...");

  const url = argv.url || env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.error(`DISCORD_WEBHOOK_URL not found. Pass --url or set it in the env file.`);
    process.exit(1);
  }

  await sendMessage(url, {
    username: "Phronesis",
    content: message,
  });
}

// ---------------------------------------------------------------------------
// Command group
// ---------------------------------------------------------------------------

export const command = "send <platform>";
export const describe = "Send a message via Telegram, webhook, Slack, or Discord";

export function builder(yargs) {
  return yargs
    .command(["telegram [message]", "tg"], "Send a Telegram message", telegramBuilder, telegramHandler)
    .command("webhook [message]", "Send a message to a generic webhook", webhookBuilder, webhookHandler)
    .command("slack [message]", "Send a message to Slack", slackBuilder, slackHandler)
    .command("discord [message]", "Send a message to Discord", discordBuilder, discordHandler)
    .demandCommand(1, "Specify a platform: telegram, webhook, slack, or discord");
}
