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
import { friendlyError } from '@/utils/errors';
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
  recruitedBy: null,
  streetStatus: null,
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
      noShow: 0,
      hired: 1,
      rejected: 0,
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
      recruitedBy: 'emp-7',
      streetStatus: null,
      createdBy: 'admin-1',
    });

    expect(ok).toBe(true);
    expect(recruitmentService.create).toHaveBeenCalledWith(
      'gent',
      NOW,
      expect.objectContaining({ name: 'New Candidate', age: 30, recruitedBy: 'emp-7' }),
    );
  });

  it('byRecruiterPerformance groups street signups by recruiter and counts streetStatus', () => {
    // Two recruiters, plus a Website lead with no recruiter that must be excluded.
    const leads: RecruitmentLead[] = [
      { ...LEAD_A, leadId: 's1', recruitedBy: 'emp-1', streetStatus: 'hired' },
      { ...LEAD_A, leadId: 's2', recruitedBy: 'emp-1', streetStatus: 'no_show' },
      { ...LEAD_A, leadId: 's3', recruitedBy: 'emp-1', streetStatus: 'planned' },
      { ...LEAD_A, leadId: 's4', recruitedBy: 'emp-1', streetStatus: null },
      { ...LEAD_A, leadId: 's5', recruitedBy: 'emp-2', streetStatus: 'hired' },
      { ...LEAD_A, leadId: 'web', recruitedBy: null, streetStatus: null },
    ];
    vi.mocked(recruitmentService.subscribe).mockImplementationOnce((_officeId, onChange) => {
      onChange(leads);
      return () => {};
    });

    const store = useRecruitmentStore();
    store.subscribe('gent');

    expect(store.streetLeads).toHaveLength(5);
    expect(store.byRecruiterPerformance).toEqual([
      // Hires are tied at 1 here, so `total` decides the order — the
      // hires-first key is covered by the next test.
      { recruiterId: 'emp-1', total: 4, hired: 1, noShow: 1, planned: 1, pending: 1, hiredRate: 50 },
      { recruiterId: 'emp-2', total: 1, hired: 1, noShow: 0, planned: 0, pending: 0, hiredRate: 100 },
    ]);
  });

  it('byRecruiterPerformance ranks by hires before total', () => {
    // emp-low has more signups but fewer hires, so it must sort second.
    vi.mocked(recruitmentService.subscribe).mockImplementationOnce((_officeId, onChange) => {
      onChange([
        { ...LEAD_A, leadId: 'a1', recruitedBy: 'emp-low', streetStatus: 'no_show' },
        { ...LEAD_A, leadId: 'a2', recruitedBy: 'emp-low', streetStatus: 'no_show' },
        { ...LEAD_A, leadId: 'a3', recruitedBy: 'emp-low', streetStatus: 'hired' },
        { ...LEAD_A, leadId: 'b1', recruitedBy: 'emp-high', streetStatus: 'hired' },
        { ...LEAD_A, leadId: 'b2', recruitedBy: 'emp-high', streetStatus: 'hired' },
      ]);
      return () => {};
    });

    const store = useRecruitmentStore();
    store.subscribe('gent');

    expect(store.byRecruiterPerformance.map((r) => r.recruiterId)).toEqual(['emp-high', 'emp-low']);
    expect(store.byRecruiterPerformance[0]).toMatchObject({ total: 2, hired: 2, hiredRate: 100 });
  });

  it('byRecruiterPerformance reports 0% rather than dividing by zero when nothing is decided', () => {
    vi.mocked(recruitmentService.subscribe).mockImplementationOnce((_officeId, onChange) => {
      onChange([{ ...LEAD_A, leadId: 's1', recruitedBy: 'emp-1', streetStatus: 'planned' }]);
      return () => {};
    });

    const store = useRecruitmentStore();
    store.subscribe('gent');

    expect(store.byRecruiterPerformance[0]).toMatchObject({ hired: 0, noShow: 0, planned: 1, hiredRate: 0 });
  });

  it('setStreetStatus delegates to the service, clearing with null', async () => {
    vi.mocked(recruitmentService.update).mockResolvedValue(undefined);

    const store = useRecruitmentStore();

    expect(await store.setStreetStatus('gent', 'l1', 'hired')).toBe(true);
    expect(recruitmentService.update).toHaveBeenCalledWith('gent', 'l1', { streetStatus: 'hired' });

    expect(await store.setStreetStatus('gent', 'l1', null)).toBe(true);
    expect(recruitmentService.update).toHaveBeenLastCalledWith('gent', 'l1', { streetStatus: null });
  });

  it('setStage leaves streetStatus alone — the two axes are independent', async () => {
    vi.mocked(recruitmentService.update).mockResolvedValueOnce(undefined);

    const store = useRecruitmentStore();
    await store.setStage('gent', 'l1', 'rejected');

    expect(recruitmentService.update).toHaveBeenCalledWith('gent', 'l1', { stage: 'rejected' });
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
      recruitedBy: null,
      streetStatus: null,
      createdBy: 'admin-1',
    });

    expect(ok).toBe(false);
    expect(store.error).toBe(friendlyError({ code: 'permission-denied' }));
  });
});
