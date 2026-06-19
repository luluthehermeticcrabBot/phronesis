import { VERSION } from "../constants.js";

export const command = "version";
export const describe = "Show version information";
export const builder = {};

export function handler() {
  console.log(`phronesis v${VERSION}`);
  console.log(`Node.js ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
}
