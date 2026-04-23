import type { ComplaintType } from '@/types/complaintType';

export const SEED_COMPLAINT_TYPES: Omit<ComplaintType, 'id'>[] = [
  {
    key: 'water_leak',
    label: 'Water Leakage',
    icon: 'Droplets',
    color: '#3B82F6',
    defaultPriority: 'high',
    defaultDepartment: 'water_supply',
    active: true,
    sortOrder: 1,
  },
  {
    key: 'pipe_burst',
    label: 'Pipe Burst',
    icon: 'AlertTriangle',
    color: '#EF4444',
    defaultPriority: 'critical',
    defaultDepartment: 'water_supply',
    active: true,
    sortOrder: 2,
  },
  {
    key: 'sewerage_overflow',
    label: 'Sewerage Overflow',
    icon: 'Waves',
    color: '#A16207',
    defaultPriority: 'high',
    defaultDepartment: 'sewerage',
    active: true,
    sortOrder: 3,
  },
  {
    key: 'low_water_pressure',
    label: 'Low Water Pressure',
    icon: 'Gauge',
    color: '#F59E0B',
    defaultPriority: 'medium',
    defaultDepartment: 'water_supply',
    active: true,
    sortOrder: 4,
  },
  {
    key: 'contaminated_water',
    label: 'Contaminated Water',
    icon: 'FlaskConical',
    color: '#DC2626',
    defaultPriority: 'critical',
    defaultDepartment: 'water_supply',
    active: true,
    sortOrder: 5,
  },
  {
    key: 'billing_issue',
    label: 'Billing / Meter Issue',
    icon: 'Receipt',
    color: '#6B7280',
    defaultPriority: 'low',
    defaultDepartment: 'billing',
    active: true,
    sortOrder: 6,
  },
];

export const COMPLAINT_TYPE_FALLBACK: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  water_leak: { label: 'Water Leakage', color: '#3B82F6', icon: 'Droplets' },
  pipe_burst: { label: 'Pipe Burst', color: '#EF4444', icon: 'AlertTriangle' },
  sewerage_overflow: { label: 'Sewerage Overflow', color: '#A16207', icon: 'Waves' },
  low_water_pressure: { label: 'Low Water Pressure', color: '#F59E0B', icon: 'Gauge' },
  contaminated_water: { label: 'Contaminated Water', color: '#DC2626', icon: 'FlaskConical' },
  billing_issue: { label: 'Billing / Meter Issue', color: '#6B7280', icon: 'Receipt' },
};
