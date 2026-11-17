import { describe, expect, it } from 'vitest';
import { checkPassword, configuredHash, constantTimeEqual, hashPassword, PASSWORD_MAX, sessionValue } from './accessGate';

const TEST_PASSPHRASE = 'unit-test passphrase only';
/** sha256('weis-uc3-demo-gate:v1:' + TEST_PASSPHRASE), the same value `npm run set-access-password` would write. */
const TEST_HASH = '896be2cbbefffbf981e6c859a09a20b78c5686c31845dad611f118a6d765e9fa';

describe('demo access gate', () => {
  it('hashes with the same salt and algorithm as the setup script', async () => {
    expect(await hashPassword(TEST_PASSPHRASE)).toBe(TEST_HASH);
  });
  it('accepts the configured password', async () => {
    expect(await checkPassword(TEST_PASSPHRASE, configuredHash(TEST_HASH))).toBe(true);
  });
  it('rejects wrong, empty, oversized and non-string passwords', async () => {
    expect(await checkPassword('wrong passphrase', TEST_HASH)).toBe(false);
    expect(await checkPassword('', TEST_HASH)).toBe(false);
    expect(await checkPassword('x'.repeat(PASSWORD_MAX + 1), TEST_HASH)).toBe(false);
    expect(await checkPassword(undefined, TEST_HASH)).toBe(false);
    expect(await checkPassword(12345, TEST_HASH)).toBe(false);
  });
  it('fails closed without a valid configuration (no default password)', async () => {
    expect(configuredHash(undefined)).toBeNull();
    expect(configuredHash('')).toBeNull();
    expect(configuredHash('not-a-hash')).toBeNull();
    expect(configuredHash('g'.repeat(64))).toBeNull();
    expect(await checkPassword(TEST_PASSPHRASE, null)).toBe(false);
  });
  it('normalizes case and whitespace of the configured hash', () => {
    expect(configuredHash(` ${TEST_HASH.toUpperCase()} `)).toBe(TEST_HASH);
  });
  it('compares in constant time and rejects different lengths', () => {
    expect(constantTimeEqual('abcd', 'abcd')).toBe(true);
    expect(constantTimeEqual('abcd', 'abce')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
  it('ties the session to the configured hash so a new password ends old sessions', () => {
    expect(sessionValue(TEST_HASH)).not.toBe(sessionValue('f'.repeat(64)));
  });
});
