/**
 * Zero-dependency spinner for CLI progress indication.
 *
 * Automatically degrades to plain text when stderr is not a TTY
 * (pipe-friendly, CI-safe).
 */

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Create and start a spinner.
 *
 * @param {string} text - Label text shown next to the spinner
 * @returns {{ succeed: (msg: string) => void, fail: (msg: string) => void, stop: () => void }}
 */
export function spinner(text) {
  if (!process.stderr.isTTY) {
    // Non-TTY: just print text once, return no-op controls
    process.stderr.write(text + "...\n");
    return {
      succeed(msg) {
        process.stderr.write(msg + "\n");
      },
      fail(msg) {
        process.stderr.write(msg + "\n");
      },
      stop() {
        // no-op
      },
    };
  }

  let i = 0;
  const interval = setInterval(() => {
    process.stderr.write("\r\x1b[K");
    process.stderr.write(`\r${FRAMES[i]} ${text}`);
    i = (i + 1) % FRAMES.length;
  }, 80);

  return {
    succeed(msg) {
      clearInterval(interval);
      process.stderr.write("\r\x1b[K");
      process.stderr.write(`\u2713 ${msg}\n`);
    },
    fail(msg) {
      clearInterval(interval);
      process.stderr.write("\r\x1b[K");
      process.stderr.write(`\u2717 ${msg}\n`);
    },
    stop() {
      clearInterval(interval);
      process.stderr.write("\r\x1b[K");
    },
  };
}
