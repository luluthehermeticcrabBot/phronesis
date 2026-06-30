/**
 * CLI error helpers — wrap common Node.js/spawn errors with fix suggestions.
 */

/**
 * Enhance an error object with a human-readable fix suggestion based on
 * common error patterns (ENOENT, EACCES, non-zero exit codes).
 *
 * @param {Error} error  - The original error (from spawnSync, execSync, etc.)
 * @param {object} [context] - Optional context object
 * @param {string} [context.command] - Human-readable command name for the error message
 * @returns {Error} A new error with the original message + suggestion appended
 */
export function enhanceError(error, context = {}) {
  if (!error) return error;

  const message = error.message || String(error);
  const cmd = context.command || "";
  let suggestion = "";

  if (message.includes("ENOENT")) {
    // Missing binary / file not found
    const match = message.match(/'([^']+)'/);
    const what = match ? match[1] : cmd || "the required tool";
    suggestion = `\n  Suggestion: "${what}" not found. Install it with your package manager.`;
  } else if (message.includes("EACCES")) {
    // Permission denied
    suggestion = `\n  Suggestion: Permission denied. Try running with 'sudo' or check file permissions.`;
  } else if (error.status !== undefined && error.status !== 0) {
    // Non-zero exit
    const stderr = error.stderr?.trim();
    if (stderr) {
      suggestion = `\n  Stderr: ${stderr}`;
    }
    if (cmd) {
      suggestion += `\n  Suggestion: "${cmd}" failed. Check your configuration and try again.`;
    }
  }

  const enhanced = new Error(`${message}${suggestion}`);
  enhanced.originalError = error;
  return enhanced;
}
