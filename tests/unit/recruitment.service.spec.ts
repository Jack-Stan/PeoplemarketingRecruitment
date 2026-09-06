import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({ db: {} }));

const onSnapshotMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
}));

import { recruitmentService } from '@/services/recruitment.service';
import type { RecruitmentLead } from '@/types/recruitmentLead';

/** Minimal stand-in for the QuerySnapshot shape `subscribe` actually reads. */
function snapshotOf(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

describe('recruitmentService.subscribe', () => {
  function capture(docs: Array<{ id: string; data: Record<string, unknown> }>): RecruitmentLead[] {
    let received: RecruitmentLead[] = [];
    onSnapshotMock.mockImplementationOnce((_ref, onNext) => {
      onNext(snapshotOf(docs));
      return () => {};
    });
    recruitmentService.subscribe(
      'gent',
      (leads) => {
        received = leads;
      },
      () => {},
    );
    return received;
  }

  it('stamps leadId and officeId onto each doc', () => {
    const [lead] = capture([{ id: 'l1', data: { name: 'Fleur', age: 24, recruitedBy: 'emp-7' } }]);

    expect(lead.leadId).toBe('l1');
    expect(lead.officeId).toBe('gent');
    expect(lead.age).toBe(24);
    expect(lead.recruitedBy).toBe('emp-7');
  });

  it('normalizes fields missing from legacy docs to null, not undefined', () => {
    // A document written before `age`/`recruitedBy` existed omits them entirely.
    const [lead] = capture([{ id: 'old', data: { name: 'Legacy Lead', stage: 'new' } }]);

    expect(lead.age).toBeNull();
    expect(lead.recruitedBy).toBeNull();
  });

  it('preserves an explicit null rather than treating it as missing', () => {
    const [lead] = capture([{ id: 'l2', data: { name: 'No Recruiter', age: null, recruitedBy: null } }]);

    expect(lead.age).toBeNull();
    expect(lead.recruitedBy).toBeNull();
  });
});
