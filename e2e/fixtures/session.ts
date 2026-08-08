import fs from "node:fs";
import path from "node:path";

import { SignJWT } from "jose";

/**
 * Reads AUTH_JWT_SECRET straight out of .env.local/.env rather than hardcoding a duplicate test
 * value — the local `next start` webServer (playwright.config.ts) loads the same files itself, so
 * this stays in sync automatically instead of drifting if the secret is ever rotated.
 */
export function loadAuthJwtSecret(cwd: string = process.cwd()): string {
  if (process.env.AUTH_JWT_SECRET) return process.env.AUTH_JWT_SECRET;

  for (const file of [".env.local", ".env"]) {
    const filePath = path.join(cwd, file);
    if (!fs.existsSync(filePath)) continue;
    const match = fs
      .readFileSync(filePath, "utf-8")
      .split("\n")
      .map((line) => line.match(/^AUTH_JWT_SECRET=(.*)$/))
      .find(Boolean);
    if (match) return match[1].trim();
  }

  throw new Error("AUTH_JWT_SECRET not found in the environment or .env.local/.env");
}

/**
 * Mints a session JWT with the exact same shape as the backend's create_session_token
 * (app/auth.py) / this app's own /api/auth/complete-verify — sub=customer_id, email, HS256. Used
 * to skip the real magic-link flow entirely in tests that only care about what /app renders, not
 * about login itself (that's live-login.spec.ts's job).
 */
export async function mintSessionToken(email: string, customerId = 1): Promise<string> {
  const secret = loadAuthJwtSecret();
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(customerId))
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(secret));
}
