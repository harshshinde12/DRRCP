import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { apiGet, apiSend, getPaged, type Paged } from './api-client.ts';
import type {
  Allocation, AuditEntry, DashboardSummary, Disaster, EmergencyRequest, InventoryRecord,
  NotificationItem, ReliefItem, RescueAssignment, RescueTeamLite, ResourceRequest,
  Shelter, ShortageRow, SuggestedVolunteer, TimeseriesPoint, User, VolunteerTask,
} from './types.ts';

export const POLL = 10_000;

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
    queryFn: () => apiGet<EmergencyRequest>(`/requests/${id}`),
    enabled: !!id,
    refetchInterval: refetch ? POLL : false,
  });
}
export function useRequestHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['request-history', id],
    queryFn: () => apiGet<Array<{ id: string; action: string; timestamp: string; metadata?: string | null; actor?: { name: string } | null }>>(`/requests/${id}/history`),
    enabled: !!id,
    refetchInterval: POLL,
  });
}
export function useSubmitRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend<EmergencyRequest>('post', '/requests', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  });
}
export function useRequestAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind, body }: { id: string; kind: 'cancel' | 'verify' | 'priority'; body?: unknown }) => {
      if (kind === 'cancel') return apiSend<EmergencyRequest>('post', `/requests/${id}/cancel`);
      if (kind === 'verify') return apiSend<EmergencyRequest>('post', `/requests/${id}/verify`, body);
      return apiSend<EmergencyRequest>('patch', `/requests/${id}/priority`, body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['request'] }); },
  });
}

/* ---------- rescue ---------- */
export function useTeams(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('teams', params), queryFn: () => getPaged<RescueTeamLite>('/teams', params), refetchInterval: POLL });
}
export function useMatchingTeams(requestId: string | undefined) {
  return useQuery({
    queryKey: ['matching-teams', requestId],
    queryFn: () => apiGet<{ request: { id: string; emergencyType: string; location: string }; teams: RescueTeamLite[] }>(`/requests/${requestId}/matching-teams`),
    enabled: !!requestId,
  });
}
export function useAssignTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, teamId, override, overrideReason }: { requestId: string; teamId: string; override?: boolean; overrideReason?: string }) =>
      apiSend<RescueAssignment>('post', `/requests/${requestId}/assign`, { teamId, override, overrideReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['request'] }); qc.invalidateQueries({ queryKey: ['teams'] }); qc.invalidateQueries({ queryKey: ['assignments'] }); },
  });
}
export function useAssignments(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('assignments', params), queryFn: () => getPaged<RescueAssignment>('/assignments', params), refetchInterval: POLL });
}
export function useAssignment(id: string | undefined) {
  return useQuery({ queryKey: ['assignment', id], queryFn: () => apiGet<RescueAssignment>(`/assignments/${id}`), enabled: !!id, refetchInterval: POLL });
}
export function useMissionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind, body }: { id: string; kind: 'acknowledge' | 'status' | 'support' | 'report' | 'cancel'; body?: unknown }) => {
      const paths = { acknowledge: 'post', status: 'patch', support: 'post', report: 'post', cancel: 'post' } as const;
      const suffix = { acknowledge: 'acknowledge', status: 'status', support: 'request-support', report: 'report', cancel: 'cancel' }[kind];
      return apiSend<RescueAssignment | { supportRequested: boolean }>(paths[kind] as 'post' | 'patch', `/assignments/${id}/${suffix}`, body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments'] }); qc.invalidateQueries({ queryKey: ['assignment'] }); qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['request'] }); qc.invalidateQueries({ queryKey: ['teams'] }); },
  });
}

/* ---------- volunteers ---------- */
export function useVolunteerTasks(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('volunteer-tasks', params), queryFn: () => getPaged<VolunteerTask>('/volunteer-tasks', params), refetchInterval: POLL });
}
export function useVolunteerTask(id: string | undefined) {
  return useQuery({ queryKey: ['volunteer-task', id], queryFn: () => apiGet<VolunteerTask>(`/volunteer-tasks/${id}`), enabled: !!id });
}
export function useTaskAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind, body }: { id: string; kind: 'accept' | 'decline' | 'status'; body?: unknown }) =>
      apiSend<VolunteerTask>(kind === 'status' ? 'patch' : 'post', `/volunteer-tasks/${id}/${kind}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['volunteer-tasks'] }); qc.invalidateQueries({ queryKey: ['volunteer-task'] }); },
  });
}
export function useSuggestVolunteers(taskType?: string, location?: string) {
  return useQuery({
    queryKey: ['suggest', taskType, location],
    queryFn: () => apiGet<{ taskType: string; location: string; volunteers: SuggestedVolunteer[] }>('/volunteers/suggest', { params: { taskType, location } }),
    enabled: !!taskType && !!location,
  });
}

/* ---------- shelters ---------- */
export function useShelters(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('shelters', params), queryFn: () => getPaged<Shelter>('/shelters', params), refetchInterval: POLL });
}
export function useShelter(id: string | undefined) {
  return useQuery({ queryKey: ['shelter', id], queryFn: () => apiGet<Shelter>(`/shelters/${id}`), enabled: !!id });
}
export function useNearbyShelters(lat?: number | null, lng?: number | null) {
  return useQuery({
    queryKey: ['shelters-nearby', lat, lng],
    queryFn: () => apiGet<Shelter[]>('/shelters/nearby', { params: { lat, lng, radiusKm: 50 } }),
    enabled: lat != null && lng != null,
  });
}

/* ---------- relief ---------- */
export function useReliefItems(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('relief-items', params), queryFn: () => getPaged<ReliefItem>('/relief-items', params) });
}
export function useInventory(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('inventory', params), queryFn: () => getPaged<InventoryRecord>('/inventory', params), refetchInterval: POLL });
}
export function useShortages() {
  return useQuery({ queryKey: ['shortages'], queryFn: () => apiGet<ShortageRow[]>('/inventory/shortages'), refetchInterval: POLL });
}
export function useResourceRequests(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('resource-requests', params), queryFn: () => getPaged<ResourceRequest>('/resource-requests', params), refetchInterval: POLL });
}
export function useAllocations(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('allocations', params), queryFn: () => getPaged<Allocation>('/allocations', params), refetchInterval: POLL });
}

/* ---------- notifications / dashboard ---------- */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: ['unread-count'],
    // backend returns { unread } — apiGet unwraps single-key envelopes to the bare value
    queryFn: () => apiGet<number>('/notifications/unread-count'),
    enabled,
    refetchInterval: 10_000,
  });
}
export function useNotifications(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('notifications', params), queryFn: () => getPaged<NotificationItem>('/notifications', params), refetchInterval: POLL });
}
export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => apiGet<import('./types.ts').DashboardSummary>('/dashboard/summary'), refetchInterval: POLL });
}
export function useTimeseries(days = 14) {
  return useQuery({ queryKey: ['timeseries', days], queryFn: () => apiGet<TimeseriesPoint[]>('/dashboard/timeseries', { params: { days } }) });
}
export function useAuditLogs(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('audit-logs', params), queryFn: () => getPaged<AuditEntry>('/audit-logs', params) });
}
export function useDisasters(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('disasters', params), queryFn: () => getPaged<Disaster>('/disasters', params) });
}
export function useUsers(params?: Record<string, unknown>) {
  return useQuery({ queryKey: pagedKey('users', params), queryFn: () => getPaged<User>('/admin/users', params) });
}
