// Demo access gate (same mechanism as UC5). THIS IS NOT SECURITY: everything ships to the browser.
// Only a salted SHA-256 hash of the password is embedded (VITE_ACCESS_PASSWORD_HASH, set at build time), so the
// password is not shown in plain text, but the hash is public and a weak password can be guessed offline.
// There is no default password: without a valid hash the gate fails closed. The data behind it is synthetic.
export const ACCESS_SALT = 'weis-uc3-demo-gate:v1:';
export const SESSION_KEY = 'uc3-report-access';
export const PASSWORD_MAX = 200;

const HEX = /^[0-9a-f]{64}$/;

/** The configured hash, or null when the deployment has no valid gate configuration (the gate then fails closed). */
export function configuredHash(raw: unknown): string | null {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return HEX.test(v) ? v : null;
}

export async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(ACCESS_SALT + password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two equal-length strings. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(password: unknown, expectedHash: string | null): Promise<boolean> {
  if (!expectedHash || typeof password !== 'string' || password.length === 0 || password.length > PASSWORD_MAX) return false;
  return constantTimeEqual(await hashPassword(password), expectedHash);
}

/** Session value tied to the configured hash, so changing the password ends existing sessions. */
export const sessionValue = (expectedHash: string) => `granted:v1:${expectedHash.slice(0, 16)}`;
