import { describe, expect, it } from 'vitest';

import { FIXED_SHIFT_HOURS, MEMBER_SHIFT_TYPES } from '@/types/shift';

describe('MEMBER_SHIFT_TYPES', () => {
  it('offers exactly the fixed-hours types', () => {
    expect(MEMBER_SHIFT_TYPES).toEqual(['D2D', 'Straat']);
  });

  it('never offers Event — it needs a title and times only an admin sets', () => {
    expect(MEMBER_SHIFT_TYPES).not.toContain('Event');
  });

  it('every offered type has fixed hours, so the member form never has to ask for them', () => {
    for (const type of MEMBER_SHIFT_TYPES) {
      expect(FIXED_SHIFT_HOURS[type].start).toBeTruthy();
      expect(FIXED_SHIFT_HOURS[type].end).toBeTruthy();
      expect(FIXED_SHIFT_HOURS[type].start < FIXED_SHIFT_HOURS[type].end).toBe(true);
    }
  });
});
