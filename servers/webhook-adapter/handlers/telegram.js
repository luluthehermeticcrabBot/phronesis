/**
 * Telegram webhook handler.
 * Handles Telegram bot updates (application/json).
 *
 * Note: Telegram expects a quick 200 OK response.
 * Responses are sent asynchronously via the Bot API.
 * This handler acknowledges the update and processes in the background.
 */
import { queryOpenCode } from "../lib/opencode-client.js";

/**
 * @param {object} payload - Telegram Update object
 * @param {string} [opencodeUrl]
 * @returns {Promise<{ok: boolean}>}
 */
export async function handleTelegram(payload, opencodeUrl) {
  const message = payload.message?.text;

  if (!message) {
    return { ok: true }; // Acknowledge non-text updates silently
  }

  // Process in background — Telegram doesn't wait for response
  queryOpenCode(message, { opencodeUrl, channel: "telegram" })
    .then((result) => {
      console.error(`[webhook-adapter] telegram response: ${result.response || "(no response)"}`);
    })
    .catch((err) => {
      console.error(`[webhook-adapter] telegram error: ${err.message}`);
    });

  // Acknowledge immediately
  return { ok: true };
}
