import type { Timestamp } from 'firebase/firestore';

export type AssignmentStatus =
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'reassigned'
  | 'unassigned'
  | 'rejected';

export interface Assignment {
  id: string;
  complaintId: string;
  employeeId: string;
  employeeName: string;
  assignedBy: string;
  assignedByName: string;
  status: AssignmentStatus;
  notes: string;
  timestamp: Timestamp;
}
