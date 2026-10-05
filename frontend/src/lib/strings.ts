/**
 * F-11: single home for helpline numbers and repeated UI copy.
 * Every page renders from here — no more per-file subsets or rewrites.
 */

export const HELPLINES = [
  { n: '112', d: 'National emergency' },
  { n: '1078', d: 'Disaster helpline' },
  { n: '102', d: 'Medical / ambulance' },
  { n: '101', d: 'Fire' },
] as const;

export const STR = {
  markAllRead: 'Mark all read',
  markRead: 'Mark read',
  cancelRequest: 'Cancel request',
  cancelConfirm: 'Cancel this request? This cannot be undone.',
  requestCancelled: 'Request cancelled.',
  emptyInboxTitle: "You're all caught up",
  emptyInboxHint: 'Request updates, assignments and public alerts will appear here.',
  queueClear: 'Queue is clear 🎉',
  queueClearHint: 'Nothing awaiting verification.',
  supportAdditional: 'Additional support',
} as const;
