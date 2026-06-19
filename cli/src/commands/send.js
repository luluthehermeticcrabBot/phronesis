import { readFileSync, existsSync } from "node:fs";
import { resolveProfile } from "../lib/opencode.js";
import { getProfileConfig } from "../lib/config.js";
import { profileTelegramEnvPath } from "../lib/paths.js";

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

export const command = "telegram [message]";
export const describe = "Send a one-off Telegram message";

export function builder(yargs) {
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

export async function handler(argv) {
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

  let env;
  try {
    env = parseEnvFile(envPath);
  } catch (err) {
    console.error(`Failed to read ${envPath}: ${err.message}`);
    process.exit(1);
  }

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

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    const body = await res.json();
    if (body.ok) {
      console.log("📨 sent");
    } else {
      console.error(`❌ Telegram error: ${body.description || "unknown"}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Telegram request failed: ${err.message}`);
    process.exit(1);
  }
}
