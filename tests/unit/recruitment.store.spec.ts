import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/services/recruitment.service', () => ({
  recruitmentService: {
    subscribe: vi.fn(() => () => {}),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

import { recruitmentService } from '@/services/recruitment.service';
import { useRecruitmentStore } from '@/stores/recruitment';
import type { RecruitmentLead } from '@/types/recruitmentLead';

const NOW = Date.parse('2026-08-25T10:00:00Z'); // Tuesday of the week starting 2026-08-24
const LAST_WEEK = Date.parse('2026-08-17T10:00:00Z');

const LEAD_A: RecruitmentLead = {
  leadId: 'l1',
  officeId: 'gent',
  name: 'Fleur Jansen',
  age: 24,
  email: null,
  phone: null,
  source: 'WhatsApp',
  stage: 'new',
  notes: null,
  createdBy: 'admin-1',
  createdAtMs: NOW,
};
const LEAD_B: RecruitmentLead = { ...LEAD_A, leadId: 'l2', stage: 'interview_planned', createdAtMs: NOW };
const LEAD_C: RecruitmentLead = { ...LEAD_A, leadId: 'l3', stage: 'hired', createdAtMs: LAST_WEEK };

describe('recruitment store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('funnelCounts tallies by stage', () => {
    vi.mocked(recruitmentService.subscribe).mockImplementationOnce((_officeId, onChange) => {
      onChange([LEAD_A, LEAD_B, LEAD_C]);
      return () => {};
    });

    const store = useRecruitmentStore();
    store.subscribe('gent');

    expect(store.funnelCounts).toEqual({
      new: 1,
      contacted: 0,
      interviewPlanned: 1,
      attended: 0,
      hired: 1,
    });
  });

  it('leadsThisWeek only counts leads created in the current ISO week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      vi.mocked(recruitmentService.subscribe).mockImplementationOnce((_officeId, onChange) => {
        onChange([LEAD_A, LEAD_B, LEAD_C]);
        return () => {};
      });

      const store = useRecruitmentStore();
      store.subscribe('gent');

      expect(store.leadsThisWeek).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('create stamps the given timestamp and delegates to the service', async () => {
    vi.mocked(recruitmentService.create).mockResolvedValueOnce('l4');

    const store = useRecruitmentStore();
    const ok = await store.create('gent', NOW, {
      name: 'New Candidate',
      age: 30,
      email: null,
      phone: null,
      source: 'Website',
      stage: 'new',
      notes: null,
      createdBy: 'admin-1',
    });

    expect(ok).toBe(true);
    expect(recruitmentService.create).toHaveBeenCalledWith(
      'gent',
      NOW,
      expect.objectContaining({ name: 'New Candidate' }),
    );
  });

  it('setStage delegates to the service', async () => {
    vi.mocked(recruitmentService.update).mockResolvedValueOnce(undefined);

    const store = useRecruitmentStore();
    const ok = await store.setStage('gent', 'l1', 'contacted');

    expect(ok).toBe(true);
    expect(recruitmentService.update).toHaveBeenCalledWith('gent', 'l1', { stage: 'contacted' });
  });

  it('surfaces a friendly error when create fails', async () => {
    vi.mocked(recruitmentService.create).mockRejectedValueOnce(
      Object.assign(new Error('nope'), { code: 'permission-denied' }),
    );

    const store = useRecruitmentStore();
    const ok = await store.create('gent', NOW, {
      name: 'Blocked',
      age: 28,
      email: null,
      phone: null,
      source: 'Website',
      stage: 'new',
      notes: null,
      createdBy: 'admin-1',
    });

    expect(ok).toBe(false);
    expect(store.error).toMatch(/permission/i);
  });
});
