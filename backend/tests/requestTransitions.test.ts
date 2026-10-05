import { describe, expect, it } from 'vitest';
import {
  REQUEST_TRANSITIONS,
  assertRequestTransition,
  canTransitionAssignment,
  canTransitionAllocation,
  canTransitionRequest,
  canTransitionResourceRequest,
  canTransitionVolunteerTask,
  RequestTransitionError,
  type RequestStatus,
} from '../src/utils/enums.js';

describe('REQUEST_TRANSITIONS state machine', () => {
  it('allows the full SRS lifecycle SUBMITTED → VERIFIED → ASSIGNED → RESCUE_IN_PROGRESS → RESOLVED', () => {
    const path: RequestStatus[] = ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUE_IN_PROGRESS', 'RESOLVED'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionRequest(path[i], path[i + 1])).toBe(true);
    }
  });

  it('allows SUBMITTED exits to DUPLICATE / REJECTED / CANCELLED and VERIFIED → CANCELLED', () => {
    expect(canTransitionRequest('SUBMITTED', 'DUPLICATE')).toBe(true);
    expect(canTransitionRequest('SUBMITTED', 'REJECTED')).toBe(true);
    expect(canTransitionRequest('SUBMITTED', 'CANCELLED')).toBe(true);
    expect(canTransitionRequest('VERIFIED', 'CANCELLED')).toBe(true);
  });

  it('rejects skips and backward moves', () => {
    expect(canTransitionRequest('SUBMITTED', 'ASSIGNED')).toBe(false);
    expect(canTransitionRequest('SUBMITTED', 'RESOLVED')).toBe(false);
    expect(canTransitionRequest('VERIFIED', 'RESOLVED')).toBe(false);
    expect(canTransitionRequest('ASSIGNED', 'VERIFIED')).toBe(false);
    expect(canTransitionRequest('RESOLVED', 'VERIFIED')).toBe(false);
    expect(canTransitionRequest('REJECTED', 'VERIFIED')).toBe(false);
    expect(canTransitionRequest('DUPLICATE', 'VERIFIED')).toBe(false);
    expect(canTransitionRequest('CANCELLED', 'SUBMITTED')).toBe(false);
  });

  it('terminal states have no exits', () => {
    for (const s of ['RESOLVED', 'REJECTED', 'DUPLICATE', 'CANCELLED'] as RequestStatus[]) {
      expect(REQUEST_TRANSITIONS[s]).toEqual([]);
    }
  });

  it('assertRequestTransition throws a 422 RequestTransitionError on invalid moves', () => {
    expect(() => assertRequestTransition('SUBMITTED', 'ASSIGNED')).toThrow(RequestTransitionError);
    try {
      assertRequestTransition('SUBMITTED', 'ASSIGNED');
      expect.unreachable();
    } catch (err) {
      expect((err as { status: number }).status).toBe(422);
    }
    expect(() => assertRequestTransition('VERIFIED', 'ASSIGNED')).not.toThrow();
  });

  it('every status appears as a key (single source of truth)', () => {
    expect(Object.keys(REQUEST_TRANSITIONS).sort()).toEqual(
      ['ASSIGNED', 'CANCELLED', 'DUPLICATE', 'REJECTED', 'RESCUE_IN_PROGRESS', 'RESOLVED', 'SUBMITTED', 'VERIFIED'].sort(),
    );
  });
});

describe('assignment / volunteer / resource transitions', () => {
  it('assignment flows ASSIGNED → ACKNOWLEDGED → ON_THE_WAY → RESCUE_IN_PROGRESS → COMPLETED', () => {
    expect(canTransitionAssignment('ASSIGNED', 'ACKNOWLEDGED')).toBe(true);
    expect(canTransitionAssignment('ACKNOWLEDGED', 'ON_THE_WAY')).toBe(true);
    expect(canTransitionAssignment('ON_THE_WAY', 'RESCUE_IN_PROGRESS')).toBe(true);
    expect(canTransitionAssignment('RESCUE_IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(canTransitionAssignment('ASSIGNED', 'COMPLETED')).toBe(false);
    expect(canTransitionAssignment('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('volunteer tasks need accept before progress', () => {
    expect(canTransitionVolunteerTask('ASSIGNED', 'ACCEPTED')).toBe(true);
    expect(canTransitionVolunteerTask('ASSIGNED', 'IN_PROGRESS')).toBe(false);
    expect(canTransitionVolunteerTask('ACCEPTED', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionVolunteerTask('IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(canTransitionVolunteerTask('DECLINED', 'ACCEPTED')).toBe(false);
  });

  it('resource requests and allocations progress forward only', () => {
    expect(canTransitionResourceRequest('PENDING', 'APPROVED')).toBe(true);
    expect(canTransitionResourceRequest('PENDING', 'FULFILLED')).toBe(false);
    expect(canTransitionAllocation('ALLOCATED', 'IN_TRANSIT')).toBe(true);
    expect(canTransitionAllocation('ALLOCATED', 'DELIVERED')).toBe(false);
    expect(canTransitionAllocation('IN_TRANSIT', 'DELIVERED')).toBe(true);
  });
});
