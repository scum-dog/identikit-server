import { log } from "./logger";

const requiredEnvVars = [
  "DATABASE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "NEWGROUNDS_APP_ID",
  "ITCH_IO_CLIENT_ID",
  "ITCH_IO_REDIRECT_URI",
];

export function validateConfig(): void {
  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    log.error("Missing required env vars:");
    missing.forEach((varName) => log.error(`  - ${varName}`));
    process.exit(1);
  }

  log.info("All required env vars are set");
}
