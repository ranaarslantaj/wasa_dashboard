import type { ComplaintStatus, ComplaintPriority } from '@/types/complaint';

export const COMPLAINT_STATUSES: { value: ComplaintStatus; label: string }[] = [
  { value: 'action_required', label: 'Action Required' },
  { value: 'action_taken',    label: 'Resolved' },
  { value: 'irrelevant',      label: 'Rejected' },
];

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  action_required: 'Action Required',
  action_taken:    'Resolved',
  irrelevant:      'Rejected',
};

export const STATUS_BADGE: Record<ComplaintStatus, string> = {
  action_required: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  action_taken:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  irrelevant:      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

// --- Derived priority (UI only — not stored) ---
export const COMPLAINT_PRIORITIES: { value: ComplaintPriority; label: string }[] = [
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const PRIORITY_LABELS: Record<ComplaintPriority, string> = {
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
};

export const PRIORITY_BADGE: Record<ComplaintPriority, string> = {
  low:      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

// --- Approval kept as no-op stubs to satisfy any lingering imports during migration. Remove later. ---
export const COMPLAINT_APPROVALS: { value: string; label: string }[] = [];
export const APPROVAL_LABELS: Record<string, string> = {};
export const APPROVAL_BADGE: Record<string, string> = {};
