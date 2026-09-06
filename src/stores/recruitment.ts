import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';

import { recruitmentService } from '@/services/recruitment.service';
import { friendlyError } from '@/utils/errors';
import {
  OPEN_LEAD_STAGES,
  type LeadSource,
  type LeadStage,
  type RecruitmentLead,
  type RecruitmentLeadCreatePayload,
  type StreetLeadStatus,
} from '@/types/recruitmentLead';
import { weekStartFor } from '@/types/shift';
import { todayLocalISO, toLocalISODate } from '@/utils/date';

/**
 * Recruitment leads store. Same shape as employees/shifts stores: a live
 * `subscribe(officeId)` plus one-shot write helpers, rules do the real
 * authorization (staff write, member read-only).
 */
export const useRecruitmentStore = defineStore('recruitment', () => {
  const leads = ref<RecruitmentLead[]>([]);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  let unsub: Unsubscribe | null = null;

  const byStage = computed(() => {
    const grouped = new Map<LeadStage, RecruitmentLead[]>();
    for (const lead of leads.value) {
      const bucket = grouped.get(lead.stage) ?? [];
      bucket.push(lead);
      grouped.set(lead.stage, bucket);
    }
    return grouped;
  });

  const funnelCounts = computed(() => ({
    new: byStage.value.get('new')?.length ?? 0,
    contacted: byStage.value.get('contacted')?.length ?? 0,
    interviewPlanned: byStage.value.get('interview_planned')?.length ?? 0,
    attended: byStage.value.get('attended')?.length ?? 0,
    hired: byStage.value.get('hired')?.length ?? 0,
  }));

  /** "Zoveel leads deze week" — client transcript's weekly leads bar. */
  const leadsThisWeek = computed(() => {
    const thisWeekStart = weekStartFor(todayLocalISO());
    return leads.value.filter(
      (l) => weekStartFor(toLocalISODate(new Date(l.createdAtMs))) === thisWeekStart,
    ).length;
  });

  const openCount = computed(() => leads.value.filter((l) => OPEN_LEAD_STAGES.includes(l.stage)).length);

  /**
   * FRD §15 — attendance rate / no-show rate / conversion / source
   * performance. Everyone who's actually reached an interview decision
   * (attended, no-show, or moved on to hired/rejected after attending) is
   * "invited" for the attendance/no-show split — a lead still sitting in
   * new/contacted/interview_planned hasn't had that outcome yet, so counting
   * them would water down the rate with leads that haven't been decided.
   */
  const qualityStats = computed(() => {
    const invited = leads.value.filter((l) => l.stage === 'attended' || l.stage === 'no_show' || l.stage === 'hired' || l.stage === 'rejected');
    const attended = invited.filter((l) => l.stage !== 'no_show');
    const total = Math.max(1, leads.value.length);
    const invitedTotal = Math.max(1, invited.length);
    return {
      attendanceRate: Math.round((attended.length / invitedTotal) * 100),
      noShowRate: Math.round(((invited.length - attended.length) / invitedTotal) * 100),
      conversionRate: Math.round((byStage.value.get('hired')?.length ?? 0) / total * 100),
      invitedCount: invited.length,
    };
  });

  const bySourcePerformance = computed(() => {
    const grouped = new Map<LeadSource, RecruitmentLead[]>();
    for (const lead of leads.value) {
      const bucket = grouped.get(lead.source) ?? [];
      bucket.push(lead);
      grouped.set(lead.source, bucket);
    }
    return [...grouped.entries()]
      .map(([source, sourceLeads]) => {
        const hired = sourceLeads.filter((l) => l.stage === 'hired').length;
        return {
          source,
          total: sourceLeads.length,
          hired,
          hiredRate: Math.round((hired / Math.max(1, sourceLeads.length)) * 100),
        };
      })
      .sort((a, b) => b.total - a.total);
  });

  /** Leads someone signed up on the street — the ones a street status applies to. */
  const streetLeads = computed(() => leads.value.filter((l) => l.recruitedBy));

  /**
   * Per-recruiter street performance — the analytics half of §3 in
   * meetings/2026-08-25-client-callback-new-asks.md. Groups by `recruitedBy`
   * and counts `streetStatus`, NOT `stage`: the client tracks street signups on
   * their own three-state axis (decisions/009). `pending` is a lead whose
   * street outcome hasn't been recorded yet, so it's reported rather than
   * folded into a rate that would understate every recruiter.
   */
  const byRecruiterPerformance = computed(() => {
    const grouped = new Map<string, RecruitmentLead[]>();
    for (const lead of streetLeads.value) {
      const bucket = grouped.get(lead.recruitedBy as string) ?? [];
      bucket.push(lead);
      grouped.set(lead.recruitedBy as string, bucket);
    }
    return [...grouped.entries()]
      .map(([recruiterId, recruited]) => {
        const hired = recruited.filter((l) => l.streetStatus === 'hired').length;
        const noShow = recruited.filter((l) => l.streetStatus === 'no_show').length;
        const planned = recruited.filter((l) => l.streetStatus === 'planned').length;
        const decided = hired + noShow;
        return {
          recruiterId,
          total: recruited.length,
          hired,
          noShow,
          planned,
          pending: recruited.length - hired - noShow - planned,
          /** Share of *decided* signups that were hired — pending/planned excluded. */
          hiredRate: decided ? Math.round((hired / decided) * 100) : 0,
        };
      })
      .sort((a, b) => b.hired - a.hired || b.total - a.total);
  });

  function subscribe(officeId: string): void {
    unsubscribe();
    isLoading.value = true;
    unsub = recruitmentService.subscribe(
      officeId,
      (list) => {
        leads.value = list;
        isLoading.value = false;
        error.value = null;
      },
      (err) => {
        error.value = friendlyError(err);
        isLoading.value = false;
      },
    );
  }

  function unsubscribe(): void {
    unsub?.();
    unsub = null;
  }

  async function create(officeId: string, nowMs: number, payload: RecruitmentLeadCreatePayload): Promise<boolean> {
    error.value = null;
    try {
      await recruitmentService.create(officeId, nowMs, payload);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function setStage(officeId: string, leadId: string, stage: LeadStage): Promise<boolean> {
    error.value = null;
    try {
      await recruitmentService.update(officeId, leadId, { stage });
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function setStreetStatus(
    officeId: string,
    leadId: string,
    streetStatus: StreetLeadStatus | null,
  ): Promise<boolean> {
    error.value = null;
    try {
      await recruitmentService.update(officeId, leadId, { streetStatus });
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  return {
    leads,
    isLoading,
    error,
    byStage,
    streetLeads,
    byRecruiterPerformance,
    funnelCounts,
    leadsThisWeek,
    openCount,
    qualityStats,
    bySourcePerformance,
    subscribe,
    unsubscribe,
    create,
    setStage,
    setStreetStatus,
  };
});
