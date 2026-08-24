import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';

import { recruitmentService } from '@/services/recruitment.service';
import { friendlyError } from '@/utils/errors';
import { OPEN_LEAD_STAGES, type LeadStage, type RecruitmentLead, type RecruitmentLeadCreatePayload } from '@/types/recruitmentLead';
import { weekStartFor } from '@/types/shift';

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
    const thisWeekStart = weekStartFor(new Date().toISOString().slice(0, 10));
    return leads.value.filter(
      (l) => weekStartFor(new Date(l.createdAtMs).toISOString().slice(0, 10)) === thisWeekStart,
    ).length;
  });

  const openCount = computed(() => leads.value.filter((l) => OPEN_LEAD_STAGES.includes(l.stage)).length);

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

  return {
    leads,
    isLoading,
    error,
    byStage,
    funnelCounts,
    leadsThisWeek,
    openCount,
    subscribe,
    unsubscribe,
    create,
    setStage,
  };
});
