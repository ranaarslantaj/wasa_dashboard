import {
  differenceInHours,
  differenceInMinutes,
  format,
  formatDistanceToNow,
  parseISO,
} from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import { tsToDate } from './firebase';

type DateInput = Timestamp | Date | string | null | undefined;

const toDate = (d: DateInput): Date | null => {
  if (d === null || d === undefined) return null;
  if (typeof d === 'string') {
    try {
      const parsed = parseISO(d);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }
  return tsToDate(d as Timestamp | Date);
};

export const formatDate = (d: DateInput, pattern = 'PP'): string => {
  const date = toDate(d);
  if (!date) return '-';
  try {
    return format(date, pattern);
  } catch {
    return '-';
  }
};

export const formatDateTime = (d: DateInput): string => formatDate(d, 'PPpp');

export const formatTimeAgo = (d: DateInput): string => {
  const date = toDate(d);
  if (!date) return '-';
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '-';
  }
};

export const formatResolutionTime = (createdAt: DateInput, resolvedAt: DateInput): string => {
  const c = toDate(createdAt);
  const r = toDate(resolvedAt);
  if (!c || !r) return '-';
  const mins = differenceInMinutes(r, c);
  if (mins < 60) return `${mins}m`;
  const hrs = differenceInHours(r, c);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
};
