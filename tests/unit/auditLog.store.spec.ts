import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/services/auditLog.service', () => ({
  auditLogService: {
    subscribe: vi.fn(() => () => {}),
    log: vi.fn(),
  },
}));

import { auditLogService } from '@/services/auditLog.service';
import { useAuditLogStore } from '@/stores/auditLog';
import type { AuditLogCreatePayload } from '@/types/auditLog';

const PAYLOAD: AuditLogCreatePayload = {
  actorUid: 'emp-lead',
  actorEmail: 'emp-lead@peoplemarketing.nl',
  action: 'location_created',
  targetLabel: 'Korenmarkt',
  details: null,
  createdAtMs: 1_700_000_000_000,
};

describe('auditLog store — log()', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(auditLogService.log).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 2026-09-24 audit — a rejected write used to vanish with no trace, which
  // is how the team-leader location_* rule gap went unnoticed.
  it('does not throw on a rejected write but warns with the action and error code', async () => {
    vi.mocked(auditLogService.log).mockRejectedValueOnce(
      Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(useAuditLogStore().log('office-main', PAYLOAD)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('location_created');
    expect(warn.mock.calls[0][0]).toContain('permission-denied');
  });

  it('warns with "unknown" when the error carries no code', async () => {
    vi.mocked(auditLogService.log).mockRejectedValueOnce(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await useAuditLogStore().log('office-main', PAYLOAD);

    expect(warn.mock.calls[0][0]).toContain('unknown');
  });

  it('stays quiet on a successful write', async () => {
    vi.mocked(auditLogService.log).mockResolvedValueOnce(undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await useAuditLogStore().log('office-main', PAYLOAD);

    expect(auditLogService.log).toHaveBeenCalledWith('office-main', PAYLOAD);
    expect(warn).not.toHaveBeenCalled();
  });
});
