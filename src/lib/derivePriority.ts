import type { WasaCategoryValue } from '@/constants/wasaCategories';
import type { ComplaintPriority } from '@/types/complaint';

export function derivePriority(wasaCategory: WasaCategoryValue | string | null | undefined): ComplaintPriority {
  switch (wasaCategory) {
    case 'sewerage_blockage':
    case 'manhole_cover':
      return 'critical';
    case 'damaged_pipes':
    case 'no_water':
      return 'high';
    case 'low_pressure':
    case 'rainwater_blockage':
      return 'medium';
    case 'others':
    default:
      return 'low';
  }
}

export const isOverdue = (createdAt: Date | null | undefined, complaintStatus: string | null | undefined, hours = 72): boolean => {
  if (!createdAt) return false;
  if (complaintStatus !== 'action_required') return false;
  const ms = Date.now() - createdAt.getTime();
  return ms > hours * 60 * 60 * 1000;
};
