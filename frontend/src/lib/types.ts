// Central API + domain types. Enum VALUES come from GET /api/meta at runtime;
// these TS types mirror the backend canonical sets for compile-time safety.

export type Role = 'CITIZEN' | 'VOLUNTEER' | 'RESCUE_TEAM' | 'SHELTER_MANAGER' | 'NGO' | 'ADMIN';

export type ColorKey =
  | 'slate' | 'gray' | 'red' | 'orange' | 'amber' | 'green'
  | 'blue' | 'indigo' | 'violet' | 'cyan' | 'pink' | 'lime';

export interface EnumOption { value: string; label: string; color: ColorKey; }

export type MetaGroup =
  | 'roles' | 'publicRoles' | 'requestStatuses' | 'priorities' | 'emergencyTypes'
  | 'teamAvailability' | 'assignmentStatuses' | 'volunteerTaskStatuses' | 'volunteerTaskTypes'
  | 'shelterStatuses' | 'resourceRequestStatuses' | 'allocationStatuses'
  | 'notificationTypes' | 'disasterStatuses' | 'severities' | 'injurySeverities';

export interface AppMeta extends Record<string, EnumOption[] | string[]> {
  roles: EnumOption[]; publicRoles: EnumOption[];
  requestStatuses: EnumOption[]; priorities: EnumOption[]; emergencyTypes: EnumOption[];
  teamAvailability: EnumOption[]; assignmentStatuses: EnumOption[];
  volunteerTaskStatuses: EnumOption[]; volunteerTaskTypes: EnumOption[];
  shelterStatuses: EnumOption[]; resourceRequestStatuses: EnumOption[]; allocationStatuses: EnumOption[];
  notificationTypes: EnumOption[]; disasterStatuses: EnumOption[]; severities: EnumOption[]; injurySeverities: EnumOption[];
  requestLifecycle: string[]; assignmentLifecycle: string[];
}

export interface PageMeta { page: number; limit: number; total: number; totalPages: number; unread?: number; }

export interface User {
  id: string; name: string; email: string; role: Role; phone?: string | null;
  address?: string | null; skills?: string | null; availability?: string | null;
  serviceArea?: string | null; organizationName?: string | null; createdAt?: string;
}

export interface Disaster {
  id: string; name: string; type: string; affectedArea: string;
  severity: string; status: string; startDate: string; createdAt: string; updatedAt: string;
}

export interface Requester { id: string; name: string; email: string; phone?: string | null; }

export interface RescueTeamLite {
  id: string; name: string; teamType: string; memberCount: number; capability: string;
  currentLocation: string; latitude: number | null; longitude: number | null;
  availabilityStatus: string; userId?: string | null; user?: Requester | null;
  capabilityMatch?: boolean; distanceKm?: number | null;
  assignments?: Array<{ id: string; status: string }>;
}

export interface RescueReport { id: string; peopleRescued: number; injuredPeople: number; notes?: string | null; completedAt: string; }

export interface AssignmentLite { id: string; status: string; teamId: string; assignedAt: string; }

export interface RescueAssignment extends AssignmentLite {
  requestId: string; assignedById: string; completedAt?: string | null;
  createdAt: string; updatedAt: string;
  team: RescueTeamLite; request: EmergencyRequest; report?: RescueReport | null;
  assignedBy?: { id: string; name: string };
}

export interface EmergencyRequest {
  id: string; requesterId: string; disasterId?: string | null;
  emergencyType: string; description: string; location: string;
  latitude: number | null; longitude: number | null;
  peopleAffected: number; injuryPresent: boolean; injurySeverity?: string | null;
  priority: string; status: string; duplicateOfId?: string | null;
  missionStatus: string | null; displayStatus: string;
  createdAt: string; updatedAt: string;
  requester: Requester; disaster?: Disaster | null;
  assignments: Array<AssignmentLite & { team: RescueTeamLite; report?: RescueReport | null }>;
  _count?: { assignments: number };
}

export interface VolunteerTask {
  id: string; volunteerId: string; title: string; taskType: string;
  location: string; status: string; assignedAt: string; createdAt: string; updatedAt: string;
  volunteer?: User;
}

export interface SuggestedVolunteer extends User { score: number; scoreBreakdown: { skillMatch: number; areaOverlap: number; availabilityBonus: number }; }

export interface Shelter {
  id: string; managerId: string; name: string; location: string;
  latitude: number | null; longitude: number | null;
  totalCapacity: number; currentOccupancy: number; availableCapacity: number;
  facilities: string; operatingStatus: string; emergencyOverride: boolean;
  createdAt: string; updatedAt: string;
  manager?: { id: string; name: string; email: string };
  distanceKm?: number;
}

export interface ReliefItem { id: string; itemName: string; category: string; unit: string; }

export interface InventoryRecord {
  id: string; itemId: string; location: string; organization?: string | null;
  quantityAvailable: number; managedById?: string | null;
  createdAt: string; updatedAt: string; item: ReliefItem;
}

export interface ResourceRequest {
  id: string; requesterId: string; shelterId?: string | null; itemId: string;
  quantityRequired: number; quantityFulfilled: number; priority: string; status: string;
  requestedAt: string; createdAt: string; updatedAt: string;
  item: ReliefItem; shelter?: Shelter | null;
  allocations?: Allocation[];
}

export interface Allocation {
  id: string; resourceRequestId: string; inventoryId?: string | null; quantity: number;
  allocatedById: string; status: string; allocationDate: string; createdAt: string;
  resourceRequest?: ResourceRequest; inventory?: (InventoryRecord & { item: ReliefItem }) | null;
  allocatedBy?: { id: string; name: string };
}

export interface NotificationItem {
  id: string; recipientId: string; message: string; type: string; isRead: boolean; createdAt: string;
}

export interface AuditEntry {
  id: string; actorId?: string | null; action: string; target?: string | null;
  targetId?: string | null; metadata?: string | null; timestamp: string;
  actor?: { id: string; name: string; email: string; role: string } | null;
}

export interface DashboardSummary {
  requests: { total: number; active: number; pending: number; critical: number; resolved: number; byStatus: Record<string, number>; byPriority: Record<string, number>; byType: Record<string, number> };
  teams: { total: number; byAvailability: Record<string, number> };
  shelters: { total: number; totalCapacity: number; totalOccupancy: number; availableCapacity: number; occupancyRate: number; byStatus: Record<string, number> };
  inventory: { records: number; totalUnits: number; openResourceRequests: number };
  performance: { avgResponseHours: number | null; resolvedCount: number };
}

export interface TimeseriesPoint { date: string; total: number; resolved: number; }

export interface ShortageRow { itemId: string; itemName: string; unit: string; available: number; required: number; fulfilled: number; shortage: number; }
