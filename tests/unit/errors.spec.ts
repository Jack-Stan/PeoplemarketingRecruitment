import { describe, expect, it } from 'vitest';

import { friendlyError } from '@/utils/errors';

/**
 * `friendlyError` is the single funnel every store pushes SDK errors through
 * before they reach a toast, so a gap here leaks raw Firebase strings into the
 * UI. These tests assert the mapping is TOTAL and STABLE — every handled code
 * returns a non-empty, distinct-from-fallback message — rather than pinning
 * the exact wording. The strings are being translated to Dutch in parallel;
 * hardcoding them here would just make this spec fight that change.
 */

/** Every code the function is expected to handle explicitly. */
const HANDLED_CODES = [
  'auth/invalid-credential',
  'auth/wrong-password',
  'auth/user-not-found',
  'auth/too-many-requests',
  'auth/network-request-failed',
  'auth/email-already-in-use',
  'auth/weak-password',
  'auth/invalid-email',
  'permission-denied',
] as const;

/** Codes that intentionally share one message (same message to avoid leaking which half of a login was wrong). */
const CREDENTIAL_CODES = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'] as const;

const fallback = () => friendlyError({ code: 'some/code-that-will-never-exist' });

function err(code: string): unknown {
  return Object.assign(new Error(`raw sdk text for ${code}`), { code });
}

describe('friendlyError', () => {
  it.each(HANDLED_CODES)('maps %s to a specific, non-fallback message', (code) => {
    const message = friendlyError(err(code));
    expect(message).toBeTypeOf('string');
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toBe(fallback());
  });

  it.each(HANDLED_CODES)('never leaks the raw SDK text for %s', (code) => {
    expect(friendlyError(err(code))).not.toMatch(/raw sdk text/);
  });

  it.each(HANDLED_CODES)('never echoes the error code %s back to the user', (code) => {
    expect(friendlyError(err(code))).not.toContain(code);
  });

  it('the mapping is total — no handled code falls through to the default branch', () => {
    const fell = HANDLED_CODES.filter((c) => friendlyError(err(c)) === fallback());
    expect(fell).toEqual([]);
  });

  it('is stable — the same code always yields the same message', () => {
    for (const code of HANDLED_CODES) {
      expect(friendlyError(err(code))).toBe(friendlyError(err(code)));
    }
  });

  it('gives the three bad-credential codes ONE identical message (no account enumeration)', () => {
    const messages = new Set(CREDENTIAL_CODES.map((c) => friendlyError(err(c))));
    expect(messages.size).toBe(1);
  });

  it('produces distinct messages across the distinct failure kinds', () => {
    const distinctKinds = [
      'auth/invalid-credential',
      'auth/too-many-requests',
      'auth/network-request-failed',
      'auth/email-already-in-use',
      'auth/weak-password',
      'auth/invalid-email',
      'permission-denied',
    ];
    const messages = distinctKinds.map((c) => friendlyError(err(c)));
    expect(new Set(messages).size).toBe(distinctKinds.length);
  });

  it('falls back to a generic message for an unknown code', () => {
    const message = friendlyError(err('auth/some-brand-new-code'));
    expect(message).toBeTypeOf('string');
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toMatch(/raw sdk text/);
    expect(message).not.toContain('auth/some-brand-new-code');
  });

  it('uses one and the same fallback for every unknown code', () => {
    const a = friendlyError(err('x/one'));
    const b = friendlyError(err('y/two'));
    expect(a).toBe(b);
  });

  it('matches on `.code` rather than instanceof, so a plain object works', () => {
    // Deliberate: the SDK's FirebaseError class does not survive `instanceof`
    // across every bundler/test boundary (see the note in errors.ts).
    expect(friendlyError({ code: 'permission-denied' })).toBe(friendlyError(err('permission-denied')));
  });

  it('ignores a non-string `code` and falls through to the Error branch', () => {
    const weird = Object.assign(new Error('boom'), { code: 42 });
    expect(friendlyError(weird)).toBe('boom');
  });

  it('passes through a plain Error message when there is no code', () => {
    expect(friendlyError(new Error('That account is already on this office roster.'))).toBe(
      'That account is already on this office roster.',
    );
  });

  it('handles non-error inputs without throwing', () => {
    for (const input of [null, undefined, 'a string', 42, {}, []]) {
      expect(() => friendlyError(input)).not.toThrow();
      expect(friendlyError(input)).toBeTypeOf('string');
      expect(friendlyError(input).length).toBeGreaterThan(0);
    }
  });
});
