/**
 * Slack webhook handler.
 * Handles Slack slash commands (application/x-www-form-urlencoded).
 */
import { queryOpenCode } from "../lib/opencode-client.js";
import { formatSlackResponse } from "../lib/response-formatter.js";

/**
 * @param {object} body - Parsed URL-encoded body
 * @param {string} [opencodeUrl]
 * @returns {Promise<object>}
 */
export async function handleSlack(body, opencodeUrl) {
  const text = (body.text || "").trim();

  if (!text) {
    return formatSlackResponse("Please include a message after the command.");
  }

  try {
    const result = await queryOpenCode(text, { opencodeUrl, channel: "slack" });
    const responseText = result.response || result.text || JSON.stringify(result);
    return formatSlackResponse(responseText);
  } catch (err) {
    console.error(`[webhook-adapter] slack error: ${err.message}`);
    return formatSlackResponse(`Error: ${err.message}`);
  }
}
