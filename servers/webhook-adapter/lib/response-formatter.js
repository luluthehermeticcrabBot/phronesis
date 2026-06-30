/**
 * Response formatters for each platform.
 */

/**
 * Format a response for Slack.
 * @param {string} text
 * @returns {object}
 */
export function formatSlackResponse(text) {
  return {
    response_type: "in_channel",
    text,
  };
}

/**
 * Format a response for Discord interaction webhook.
 * @param {string} text
 * @returns {object}
 */
export function formatDiscordResponse(text) {
  return {
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      content: text,
    },
  };
}

/**
 * Format a response for generic webhook.
 * @param {string} text
 * @param {string} [channel]
 * @returns {object}
 */
export function formatGenericResponse(text, channel = "webhook") {
  return {
    response: text,
    channel,
  };
}
