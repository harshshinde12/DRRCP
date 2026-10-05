import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { apiGet, apiGetOne, apiSend, apiSendOne, getPaged, type Paged } from './api-client.ts';
import type {
  Allocation, AuditEntry, DashboardSummary, Disaster, EmergencyRequest, InventoryRecord,
  NotificationItem, ReliefItem, RescueAssignment, RescueReport, RescueTeamLite, ResourceRequest,
  Shelter, ShortageRow, SuggestedVolunteer, TimeseriesPoint, User, VolunteerTask,
} from './types.ts';

export const POLL = 10_000;
/** Slow poll for slow-moving dashboard charts (F-08). */
// Conservative polling policy (F-08/U-04): only live-watched data polls —
// request status, missions, notifications, dashboard. Static boards/lists
// (teams, shelters, inventory, tasks, relief, users, disasters, audit)
// refresh via mutation invalidations, never on a timer.
export const SLOW_POLL = 30_000;

function pagedKey(base: string, params?: Record<string, unknown>) {
  return [base, ...(params ? [JSON.stringify(params)] : [])];
}

/* ---------- requests ---------- */
export function useRequests(params?: Record<string, unknown>, opts?: Partial<UseQueryOptions<Paged<EmergencyRequest>>>) {
  return useQuery({
    queryKey: pagedKey('requests', params),
    queryFn: () => getPaged<EmergencyRequest>('/requests', params),
    refetchInterval: POLL,
    ...opts,
  });
}
export function useRequest(id: string | undefined, refetch = true) {
  return useQuery({
    queryKey: ['request', id],
    // I-01: backend envelope is { request } — key is explicit.
    queryFn: () => apiGetOne<EmergencyRequest>(`/requests/${id}`, 'request'),
    enabled: !!id,
    refetchInterval: refetch ? POLL : false,
  });
}
export function useRequestHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['request-history', id],
    // Backend returns the history array directly in `data`.
    queryFn: () => apiGet<Array<{ id: string; action: string; timestamp: string; metadata?: string | null; actor?: { name: string } | null }>>(`/requests/${id}/history`),
    enabled: !!id,
    refetchInterval: POLL,
  });
}
export function useSubmitRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSendOne<EmergencyRequest>('post', '/requests', 'request', body),
    // F-08: a new request moves dashboard counts and the audit trail.
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['audit-logs'] }); },
  });
}
export function useRequestAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind, body }: { id: string; kind: 'cancel' | 'verify' | 'priority'; body?: unknown }) => {
      if (kind === 'cancel') return apiSendOne<EmergencyRequest>('post', `/requests/${id}/cancel`, 'request');
      if (kind === 'verify') return apiSendOne<EmergencyRequest>('post', `/requests/${id}/verify`, 'request', body);
      return apiSendOne<EmergencyRequest>('patch', `/requests/${id}/priority`, 'request', body);
    },
    // F-08: triage moves queue, detail, dashboard, audit — and the matching pool.
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['request'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['audit-logs'] }); qc.invalidateQueries({ queryKey: ['matching-teams'] }); },
  });
}

/* ---------- rescue ---------- */
export function useTeams(params?: Record<string, unknown>) {
  // Static board — no polling (conservative: only live-watched data polls).
  return useQuery({ queryKey: pagedKey('teams', params), queryFn: () => getPaged<RescueTeamLite>('/teams', params) });
}
export function useTeam(id: string | undefined) {
  return useQuery({
    queryKey: ['team', id],
    queryFn: () => apiGetOne<RescueTeamLite>(`/teams/${id}`, 'team'),
    enabled: !!id,
  });
}
/** Admin-only audited action: return a team to AVAILABLE (409 while missions are active). */
export function useMarkTeamAvailable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSendOne<RescueTeamLite>('post', `/teams/${id}/availability`, 'team', { availabilityStatus: 'AVAILABLE' }),
    // F-08: availability moves the teams board, dashboard and audit.
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['audit-logs'] }); },
  });
}
export function useMatchingTeams(requestId: string | undefined) {
  return useQuery({
    queryKey: ['matching-teams', requestId],
    // Backend returns { request, teams } verbatim — multi-key shape, no collapse.
    queryFn: () => apiGet<{ request: { id: string; emergencyType: string; location: string }; teams: RescueTeamLite[] }>(`/requests/${requestId}/matching-teams`),
    enabled: !!requestId,
    // F-08: refresh ranks while the triage drawer is open (disabled when closed).
    refetchInterval: POLL,
  });
}
export function useAssignTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, teamId, override, overrideReason }: { requestId: string; teamId: string; override?: boolean; overrideReason?: string }) =>
      apiSendOne<RescueAssignment>('post', `/requests/${requestId}/assign`, 'assignment', { teamId, override, overrideReason }),
    // F-08: dispatch moves queue, detail, board, missions, dashboard, audit — and ranks.
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['request'] }); qc.invalidateQueries({ queryKey: ['teams'] }); qc.invalidateQueries({ queryKey: ['assignments'] }); qc.invalidateQueries({ queryKey: ['assignment'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['audit-logs'] }); qc.invalidateQueries({ queryKey: ['matching-teams'] }); },
  });
}
export function useAssignments(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('assignments', params), queryFn: () => getPaged<RescueAssignment>('/assignments', params), refetchInterval: POLL });
}
export function useAssignment(id: string | undefined) {
  return useQuery({ queryKey: ['assignment', id], queryFn: () => apiGetOne<RescueAssignment>(`/assignments/${id}`, 'assignment'), enabled: !!id, refetchInterval: POLL });
}
export interface SupportResult { assignmentId: string; status: string; supportRequested: boolean; }
export function useMissionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind, body }: { id: string; kind: 'acknowledge' | 'status' | 'support' | 'report' | 'cancel'; body?: unknown }): Promise<RescueAssignment | SupportResult | RescueReport> => {
      if (kind === 'support') return apiSend<SupportResult>('post', `/assignments/${id}/request-support`, body);
      if (kind === 'report') return apiSendOne<RescueReport>('post', `/assignments/${id}/report`, 'report', body);
      const paths = { acknowledge: 'post', status: 'patch', cancel: 'post' } as const;
      const suffix = { acknowledge: 'acknowledge', status: 'status', cancel: 'cancel' }[kind];
      return apiSendOne<RescueAssignment>(paths[kind] as 'post' | 'patch', `/assignments/${id}/${suffix}`, 'assignment', body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments'] }); qc.invalidateQueries({ queryKey: ['assignment'] }); qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['request'] }); qc.invalidateQueries({ queryKey: ['teams'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['audit-logs'] }); qc.invalidateQueries({ queryKey: ['matching-teams'] }); },
  });
}

/* ---------- volunteers ---------- */
export function useVolunteerTasks(params?: Record<string, unknown>) {
  // Static work list — no polling (conservative: only live-watched data polls).
  return useQuery({ queryKey: pagedKey('volunteer-tasks', params), queryFn: () => getPaged<VolunteerTask>('/volunteer-tasks', params) });
}
export function useVolunteerTask(id: string | undefined) {
  return useQuery({ queryKey: ['volunteer-task', id], queryFn: () => apiGetOne<VolunteerTask>(`/volunteer-tasks/${id}`, 'task'), enabled: !!id });
}
export function useTaskAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind, body }: { id: string; kind: 'accept' | 'decline' | 'status'; body?: unknown }) =>
      apiSendOne<VolunteerTask>(kind === 'status' ? 'patch' : 'post', `/volunteer-tasks/${id}/${kind}`, 'task', body),
    // F-08: task moves are audited — refresh the trail too.
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['volunteer-tasks'] }); qc.invalidateQueries({ queryKey: ['volunteer-task'] }); qc.invalidateQueries({ queryKey: ['audit-logs'] }); },
  });
}
export function useVolunteer(id: string | undefined) {
  return useQuery({ queryKey: ['volunteer', id], queryFn: () => apiGetOne<User>(`/volunteers/${id}`, 'volunteer'), enabled: !!id });
}
export function useSuggestVolunteers(taskType?: string, location?: string) {
  return useQuery({
    queryKey: ['suggest', taskType, location],
    // Backend returns { taskType, location, volunteers } verbatim.
    queryFn: () => apiGet<{ taskType: string; location: string; volunteers: SuggestedVolunteer[] }>('/volunteers/suggest', { params: { taskType, location } }),
    enabled: !!taskType && !!location,
  });
}

/* ---------- shelters ---------- */
export function useShelters(params?: Record<string, unknown>) {
  // Static list — no polling (conservative: only live-watched data polls).
  return useQuery({ queryKey: pagedKey('shelters', params), queryFn: () => getPaged<Shelter>('/shelters', params) });
}
export function useShelter(id: string | undefined) {
  return useQuery({ queryKey: ['shelter', id], queryFn: () => apiGetOne<Shelter>(`/shelters/${id}`, 'shelter'), enabled: !!id });
}
export function useNearbyShelters(lat?: number | null, lng?: number | null) {
  return useQuery({
    queryKey: ['shelters-nearby', lat, lng],
    // Backend returns the sorted array directly in `data`.
    queryFn: () => apiGet<Shelter[]>('/shelters/nearby', { params: { lat, lng, radiusKm: 50 } }),
    enabled: lat != null && lng != null,
  });
}

/* ---------- relief ---------- */
export function useReliefItems(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('relief-items', params), queryFn: () => getPaged<ReliefItem>('/relief-items', params) });
}
export function useReliefItem(id: string | undefined) {
  return useQuery({ queryKey: ['relief-item', id], queryFn: () => apiGetOne<ReliefItem>(`/relief-items/${id}`, 'item'), enabled: !!id });
}
export function useInventory(params?: Record<string, unknown>) {
  // Static stock list — no polling (conservative: only live-watched data polls).
  return useQuery({ queryKey: pagedKey('inventory', params), queryFn: () => getPaged<InventoryRecord>('/inventory', params) });
}
export function useInventoryRecord(id: string | undefined) {
  return useQuery({ queryKey: ['inventory-record', id], queryFn: () => apiGetOne<InventoryRecord>(`/inventory/${id}`, 'inventory'), enabled: !!id });
}
export function useShortages() {
  // Backend returns the shortage rows array directly in `data`.
  // No polling — refreshed by mutation invalidations (conservative polling).
  return useQuery({ queryKey: ['shortages'], queryFn: () => apiGet<ShortageRow[]>('/inventory/shortages') });
}
export function useResourceRequests(params?: Record<string, unknown>) {
  // Static list — no polling (conservative: only live-watched data polls).
  return useQuery({ queryKey: pagedKey('resource-requests', params), queryFn: () => getPaged<ResourceRequest>('/resource-requests', params) });
}
export function useResourceRequest(id: string | undefined) {
  return useQuery({ queryKey: ['resource-request', id], queryFn: () => apiGetOne<ResourceRequest>(`/resource-requests/${id}`, 'resourceRequest'), enabled: !!id });
}
export function useAllocations(params?: Record<string, unknown>) {
  // Static history — no polling (conservative: only live-watched data polls).
  return useQuery({ queryKey: pagedKey('allocations', params), queryFn: () => getPaged<Allocation>('/allocations', params) });
}
export function useAllocation(id: string | undefined) {
  return useQuery({ queryKey: ['allocation', id], queryFn: () => apiGetOne<Allocation>(`/allocations/${id}`, 'allocation'), enabled: !!id });
}

/* ---------- notifications / dashboard ---------- */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: ['unread-count'],
    // I-01: backend envelope is { unread } — key is explicit.
    queryFn: () => apiGetOne<number>('/notifications/unread-count', 'unread'),
    enabled,
    refetchInterval: 10_000,
  });
}
export function useNotifications(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('notifications', params), queryFn: () => getPaged<NotificationItem>('/notifications', params), refetchInterval: POLL });
}
export function useDashboard() {
  // Backend returns the summary object directly in `data`.
  return useQuery({ queryKey: ['dashboard'], queryFn: () => apiGet<DashboardSummary>('/dashboard/summary'), refetchInterval: POLL });
}
export function useTimeseries(days = 14) {
  // Backend returns the points array directly in `data`.
  // Slow-moving chart — slow poll keeps the dashboard ● LIVE honest.
  return useQuery({ queryKey: ['timeseries', days], queryFn: () => apiGet<TimeseriesPoint[]>('/dashboard/timeseries', { params: { days } }), refetchInterval: SLOW_POLL });
}
export function useAuditLogs(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('audit-logs', params), queryFn: () => getPaged<AuditEntry>('/audit-logs', params) });
}
export function useDisasters(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('disasters', params), queryFn: () => getPaged<Disaster>('/disasters', params) });
}
export function useDisaster(id: string | undefined) {
  return useQuery({ queryKey: ['disaster', id], queryFn: () => apiGetOne<Disaster>(`/disasters/${id}`, 'disaster'), enabled: !!id });
}
export function useUsers(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('users', params), queryFn: () => getPaged<User>('/admin/users', params) });
}
