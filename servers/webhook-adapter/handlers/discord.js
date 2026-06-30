/**
 * Discord interaction handler.
 * Handles Discord slash commands (application/json).
 */
import { queryOpenCode } from "../lib/opencode-client.js";
import { formatDiscordResponse } from "../lib/response-formatter.js";

/**
 * Extract the message text from a Discord interaction payload.
 * Supports both simple text commands and slash commands with options.
 *
 * @param {object} data - Discord interaction data object
 * @returns {string|null}
 */
function extractMessage(data) {
  // Simple content (from message content commands)
  if (data.content && typeof data.content === "string") {
    return data.content.trim();
  }

  // Slash command with options
  if (data.options && Array.isArray(data.options)) {
    const firstOption = data.options[0];
    if (firstOption && firstOption.value) {
      return String(firstOption.value).trim();
    }
  }

  return null;
}

/**
 * @param {object} payload - Full Discord interaction payload
 * @param {string} [opencodeUrl]
 * @returns {Promise<object>}
 */
export async function handleDiscord(payload, opencodeUrl) {
  const message = extractMessage(payload.data || {});

  if (!message) {
    return formatDiscordResponse("Please include a message.");
  }

  try {
    const result = await queryOpenCode(message, { opencodeUrl, channel: "discord" });
    const responseText = result.response || result.text || JSON.stringify(result);
    return formatDiscordResponse(responseText);
  } catch (err) {
    console.error(`[webhook-adapter] discord error: ${err.message}`);
    return formatDiscordResponse(`Error: ${err.message}`);
  }
}
