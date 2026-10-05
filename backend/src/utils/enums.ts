// Canonical status/role value sets (mirrors Prisma schema comments).
// SQLite has no native enums → stored as String, validated with Zod.

export const ROLES = ['CITIZEN', 'VOLUNTEER', 'RESCUE_TEAM', 'SHELTER_MANAGER', 'NGO', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const DISASTER_STATUSES = ['ACTIVE', 'MONITORING', 'RESOLVED'] as const;
export type DisasterStatus = (typeof DISASTER_STATUSES)[number];

export const EMERGENCY_TYPES = ['RESCUE', 'MEDICAL', 'FOOD', 'WATER', 'SHELTER', 'FIRE', 'MISSING_PERSON', 'INFRASTRUCTURE'] as const;
export type EmergencyType = (typeof EMERGENCY_TYPES)[number];

export const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const REQUEST_STATUSES = ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUE_IN_PROGRESS', 'RESOLVED', 'REJECTED', 'DUPLICATE', 'CANCELLED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Allowed forward transitions for EmergencyRequest.status (SRS Appendix B Fig. 4). */
export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  SUBMITTED: ['VERIFIED', 'DUPLICATE', 'REJECTED', 'CANCELLED'],
  VERIFIED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['RESCUE_IN_PROGRESS'],
  RESCUE_IN_PROGRESS: ['RESOLVED'],
  RESOLVED: [],
  REJECTED: [],
  DUPLICATE: [],
  CANCELLED: [],
};

/**
 * Single state-machine predicate for EmergencyRequest.
 * Every status change in services MUST go through this (no ad-hoc transitions).
 */
export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  if (from === to) return true;
  return (REQUEST_TRANSITIONS[from] ?? []).includes(to);
}

export function assertRequestTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransitionRequest(from, to)) {
    throw new RequestTransitionError(from, to);
  }
}

export class RequestTransitionError extends Error {
  readonly from: RequestStatus;
  readonly to: RequestStatus;
  readonly status = 422;
  constructor(from: RequestStatus, to: RequestStatus) {
    super(`Invalid request status transition: ${from} → ${to}`);
    this.from = from;
    this.to = to;
  }
}

export const TEAM_AVAILABILITY = ['AVAILABLE', 'ASSIGNED', 'ON_THE_WAY', 'RESCUE_IN_PROGRESS'] as const;
export type TeamAvailability = (typeof TEAM_AVAILABILITY)[number];

export const ASSIGNMENT_STATUSES = ['ASSIGNED', 'ACKNOWLEDGED', 'ON_THE_WAY', 'RESCUE_IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/** Mission progression for RescueAssignment (SRS §3.2). COMPLETED only via RescueReport. */
export const ASSIGNMENT_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  ASSIGNED: ['ACKNOWLEDGED', 'CANCELLED'],
  ACKNOWLEDGED: ['ON_THE_WAY', 'CANCELLED'],
  ON_THE_WAY: ['RESCUE_IN_PROGRESS', 'CANCELLED'],
  RESCUE_IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionAssignment(from: AssignmentStatus, to: AssignmentStatus): boolean {
  if (from === to) return true;
  return (ASSIGNMENT_TRANSITIONS[from] ?? []).includes(to);
}

export const VOLUNTEER_TASK_STATUSES = ['ASSIGNED', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type VolunteerTaskStatus = (typeof VOLUNTEER_TASK_STATUSES)[number];

/** Volunteer task flow (SRS §3.3): accept/decline first, then work, then done. */
export const VOLUNTEER_TASK_TRANSITIONS: Record<VolunteerTaskStatus, VolunteerTaskStatus[]> = {
  ASSIGNED: ['ACCEPTED', 'DECLINED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  DECLINED: [],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionVolunteerTask(from: VolunteerTaskStatus, to: VolunteerTaskStatus): boolean {
  if (from === to) return true;
  return (VOLUNTEER_TASK_TRANSITIONS[from] ?? []).includes(to);
}

export const SHELTER_STATUSES = ['OPEN', 'FULL', 'TEMPORARILY_CLOSED', 'CLOSED'] as const;
export type ShelterStatus = (typeof SHELTER_STATUSES)[number];

export const RESOURCE_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'REJECTED', 'CANCELLED'] as const;
export type ResourceRequestStatus = (typeof RESOURCE_REQUEST_STATUSES)[number];

export const RESOURCE_REQUEST_TRANSITIONS: Record<ResourceRequestStatus, ResourceRequestStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'],
  PARTIALLY_FULFILLED: ['FULFILLED', 'CANCELLED'],
  FULFILLED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransitionResourceRequest(from: ResourceRequestStatus, to: ResourceRequestStatus): boolean {
  if (from === to) return true;
  return (RESOURCE_REQUEST_TRANSITIONS[from] ?? []).includes(to);
}

export const ALLOCATION_STATUSES = ['ALLOCATED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] as const;
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];

export const ALLOCATION_TRANSITIONS: Record<AllocationStatus, AllocationStatus[]> = {
  ALLOCATED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionAllocation(from: AllocationStatus, to: AllocationStatus): boolean {
  if (from === to) return true;
  return (ALLOCATION_TRANSITIONS[from] ?? []).includes(to);
}

export const NOTIFICATION_TYPES = ['REQUEST_UPDATE', 'ASSIGNMENT', 'SHELTER_ALERT', 'PUBLIC_ALERT', 'RESOURCE_UPDATE', 'SYSTEM'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ── Display metadata (single source for UI labels + color keys) ──
// The frontend MUST consume GET /api/meta and never hardcode these values.
// `color` is a stable palette key; the frontend maps keys → theme classes.

export type ColorKey =
  | 'slate' | 'gray' | 'red' | 'orange' | 'amber' | 'green'
  | 'blue' | 'indigo' | 'violet' | 'cyan' | 'pink' | 'lime';

export type EnumOption = { value: string; label: string; color: ColorKey };

function opts(values: readonly string[], labels: Record<string, string>, colors: Record<string, ColorKey>, fallback: ColorKey = 'slate'): EnumOption[] {
  return values.map((value) => ({
    value,
    label: labels[value] ?? value,
    color: colors[value] ?? fallback,
  }));
}

export const PUBLIC_ROLES: Role[] = ['CITIZEN', 'VOLUNTEER', 'SHELTER_MANAGER', 'NGO'];

export const META = {
  roles: opts(ROLES, {
    CITIZEN: 'Citizen', VOLUNTEER: 'Volunteer', RESCUE_TEAM: 'Rescue Team',
    SHELTER_MANAGER: 'Shelter Manager', NGO: 'NGO / Relief Org', ADMIN: 'Administrator',
  }, { CITIZEN: 'blue', VOLUNTEER: 'green', RESCUE_TEAM: 'orange', SHELTER_MANAGER: 'violet', NGO: 'cyan', ADMIN: 'red' }),
  publicRoles: opts(PUBLIC_ROLES, {
    CITIZEN: 'Citizen', VOLUNTEER: 'Volunteer', SHELTER_MANAGER: 'Shelter Manager', NGO: 'NGO / Relief Org',
  }, { CITIZEN: 'blue', VOLUNTEER: 'green', SHELTER_MANAGER: 'violet', NGO: 'cyan' }),
  requestStatuses: opts(REQUEST_STATUSES, {
    SUBMITTED: 'Submitted', VERIFIED: 'Verified', ASSIGNED: 'Assigned',
    RESCUE_IN_PROGRESS: 'Rescue in progress', RESOLVED: 'Resolved',
    REJECTED: 'Rejected', DUPLICATE: 'Duplicate', CANCELLED: 'Cancelled',
  }, { SUBMITTED: 'blue', VERIFIED: 'indigo', ASSIGNED: 'violet', RESCUE_IN_PROGRESS: 'amber', RESOLVED: 'green', REJECTED: 'red', DUPLICATE: 'gray', CANCELLED: 'gray' }),
  priorities: opts(PRIORITIES, {
    CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low',
  }, { CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'amber', LOW: 'green' }),
  emergencyTypes: opts(EMERGENCY_TYPES, {
    RESCUE: 'Rescue', MEDICAL: 'Medical', FOOD: 'Food', WATER: 'Water',
    SHELTER: 'Shelter', FIRE: 'Fire', MISSING_PERSON: 'Missing person', INFRASTRUCTURE: 'Infrastructure',
  }, { RESCUE: 'red', MEDICAL: 'pink', FOOD: 'amber', WATER: 'cyan', SHELTER: 'violet', FIRE: 'orange', MISSING_PERSON: 'indigo', INFRASTRUCTURE: 'slate' }),
  teamAvailability: opts(TEAM_AVAILABILITY, {
    AVAILABLE: 'Available', ASSIGNED: 'Assigned', ON_THE_WAY: 'On the way', RESCUE_IN_PROGRESS: 'Rescue in progress',
  }, { AVAILABLE: 'green', ASSIGNED: 'violet', ON_THE_WAY: 'blue', RESCUE_IN_PROGRESS: 'amber' }),
  assignmentStatuses: opts(ASSIGNMENT_STATUSES, {
    ASSIGNED: 'Assigned', ACKNOWLEDGED: 'Acknowledged', ON_THE_WAY: 'On the way',
    RESCUE_IN_PROGRESS: 'Rescue in progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
  }, { ASSIGNED: 'violet', ACKNOWLEDGED: 'indigo', ON_THE_WAY: 'blue', RESCUE_IN_PROGRESS: 'amber', COMPLETED: 'green', CANCELLED: 'gray' }),
  volunteerTaskStatuses: opts(VOLUNTEER_TASK_STATUSES, {
    ASSIGNED: 'Assigned', ACCEPTED: 'Accepted', DECLINED: 'Declined',
    IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
  }, { ASSIGNED: 'violet', ACCEPTED: 'indigo', IN_PROGRESS: 'amber', COMPLETED: 'green', DECLINED: 'red', CANCELLED: 'gray' }),
  volunteerTaskTypes: opts(
    ['FIRST_AID', 'LOGISTICS', 'COOKING', 'COMMUNICATION', 'DISTRIBUTION'] as const,
    { FIRST_AID: 'First aid', LOGISTICS: 'Logistics', COOKING: 'Cooking', COMMUNICATION: 'Communication', DISTRIBUTION: 'Distribution' },
    { FIRST_AID: 'pink', LOGISTICS: 'blue', COOKING: 'amber', COMMUNICATION: 'violet', DISTRIBUTION: 'green' },
  ),
  shelterStatuses: opts(SHELTER_STATUSES, {
    OPEN: 'Open', FULL: 'Full', TEMPORARILY_CLOSED: 'Temporarily closed', CLOSED: 'Closed',
  }, { OPEN: 'green', FULL: 'red', TEMPORARILY_CLOSED: 'amber', CLOSED: 'gray' }),
  resourceRequestStatuses: opts(RESOURCE_REQUEST_STATUSES, {
    PENDING: 'Pending', APPROVED: 'Approved', PARTIALLY_FULFILLED: 'Partially fulfilled',
    FULFILLED: 'Fulfilled', REJECTED: 'Rejected', CANCELLED: 'Cancelled',
  }, { PENDING: 'amber', APPROVED: 'indigo', PARTIALLY_FULFILLED: 'blue', FULFILLED: 'green', REJECTED: 'red', CANCELLED: 'gray' }),
  allocationStatuses: opts(ALLOCATION_STATUSES, {
    ALLOCATED: 'Allocated', IN_TRANSIT: 'In transit', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
  }, { ALLOCATED: 'violet', IN_TRANSIT: 'blue', DELIVERED: 'green', CANCELLED: 'gray' }),
  notificationTypes: opts(NOTIFICATION_TYPES, {
    REQUEST_UPDATE: 'Request update', ASSIGNMENT: 'Assignment', SHELTER_ALERT: 'Shelter alert',
    PUBLIC_ALERT: 'Public alert', RESOURCE_UPDATE: 'Resource update', SYSTEM: 'System',
  }, { REQUEST_UPDATE: 'blue', ASSIGNMENT: 'violet', SHELTER_ALERT: 'amber', PUBLIC_ALERT: 'red', RESOURCE_UPDATE: 'green', SYSTEM: 'slate' }),
  disasterStatuses: opts(DISASTER_STATUSES, {
    ACTIVE: 'Active', MONITORING: 'Monitoring', RESOLVED: 'Resolved',
  }, { ACTIVE: 'red', MONITORING: 'amber', RESOLVED: 'green' }),
  severities: opts(['LOW', 'MODERATE', 'SEVERE', 'CRITICAL'] as const, {
    LOW: 'Low', MODERATE: 'Moderate', SEVERE: 'Severe', CRITICAL: 'Critical',
  }, { LOW: 'green', MODERATE: 'amber', SEVERE: 'orange', CRITICAL: 'red' }),
  injurySeverities: opts(['NONE', 'MINOR', 'MODERATE', 'SEVERE', 'UNKNOWN'] as const, {
    NONE: 'None', MINOR: 'Minor', MODERATE: 'Moderate', SEVERE: 'Severe', UNKNOWN: 'Unknown',
  }, { NONE: 'green', MINOR: 'amber', MODERATE: 'orange', SEVERE: 'red', UNKNOWN: 'slate' }),
  // Canonical step orders for timelines (no new states — presentation only).
  requestLifecycle: ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUE_IN_PROGRESS', 'RESOLVED'] as RequestStatus[],
  assignmentLifecycle: ['ASSIGNED', 'ACKNOWLEDGED', 'ON_THE_WAY', 'RESCUE_IN_PROGRESS', 'COMPLETED'] as AssignmentStatus[],
};

/**
 * Citizen-friendly display status derived from request + mission status.
 * No new request states — presentation layer only.
 */
export function deriveDisplayStatus(requestStatus: RequestStatus, missionStatus: AssignmentStatus | null): string {
  switch (requestStatus) {
    case 'SUBMITTED': return 'Awaiting verification';
    case 'VERIFIED': return 'Verified — awaiting rescue team';
    case 'ASSIGNED':
      switch (missionStatus) {
        case 'ACKNOWLEDGED': return 'Team acknowledged';
        case 'ON_THE_WAY': return 'Team on the way';
        case 'RESCUE_IN_PROGRESS': return 'Rescue in progress';
        case 'COMPLETED': return 'Mission complete';
        case 'CANCELLED': return 'Team assigned — reassignment pending';
        default: return 'Team assigned';
      }
    case 'RESCUE_IN_PROGRESS': return 'Rescue in progress';
    case 'RESOLVED': return 'Resolved — mission complete';
    case 'REJECTED': return 'Rejected after review';
    case 'DUPLICATE': return 'Marked as duplicate';
    case 'CANCELLED': return 'Cancelled';
  }
}
