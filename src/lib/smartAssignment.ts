import type { WasaEmployee } from '@/types';

export interface ComplaintForRanking {
  wasaCategory: string | null;
  division: string;
  district: string;
  tahsil: string;
}

export interface RankedEmployee extends WasaEmployee {
  score: number;
  reason: string[];
}

export const rankEmployees = (employees: WasaEmployee[], complaint: ComplaintForRanking): RankedEmployee[] =>
  employees
    .filter((e) => e.active)
    .map((e) => {
      let score = 0;
      const reason: string[] = [];
      if (complaint.wasaCategory && e.specialization?.includes(complaint.wasaCategory)) { score += 100; reason.push('specialization match'); }
      if (e.tehsil && e.tehsil === complaint.tahsil) { score += 50; reason.push('same tehsil'); }
      else if (e.district && e.district === complaint.district) { score += 30; reason.push('same district'); }
      else if (e.division && e.division === complaint.division) { score += 10; reason.push('same division'); }
      const workload = e.currentAssignments ?? 0;
      score -= workload * 2;
      if (workload < 5) reason.push('low workload');
      else if (workload >= 10) reason.push('overloaded');
      return { ...e, score, reason };
    })
    .sort((a, b) => b.score - a.score || (a.currentAssignments ?? 0) - (b.currentAssignments ?? 0));

export const workloadBadgeClass = (n: number): string => {
  if (n < 5) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (n < 10) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
};
