/**
 * Generic webhook handler.
 * Accepts a simple JSON payload and returns the OpenCode response.
 */
import { queryOpenCode } from "../lib/opencode-client.js";
import { formatGenericResponse } from "../lib/response-formatter.js";

/**
 * @param {object} payload - JSON body expected: { message: "...", channel?: "..." }
 * @param {string} [opencodeUrl]
 * @returns {Promise<object>}
 */
export async function handleGeneric(payload, opencodeUrl) {
  const message = (payload.message || "").trim();
  const channel = payload.channel || "webhook";

  if (!message) {
    return formatGenericResponse("Please include a 'message' field.", channel);
  }

  try {
    const result = await queryOpenCode(message, { opencodeUrl, channel });
    const responseText = result.response || result.text || JSON.stringify(result);
    return formatGenericResponse(responseText, channel);
  } catch (err) {
    console.error(`[webhook-adapter] generic error: ${err.message}`);
    return formatGenericResponse(`Error: ${err.message}`, channel);
  }
}
