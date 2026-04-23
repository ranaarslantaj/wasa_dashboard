import type { Timestamp } from 'firebase/firestore';

export type ComplaintStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'reopened';

export type ComplaintApproval = 'pending' | 'approved' | 'rejected';

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';

export type ComplaintSource = 'public_app' | 'dashboard';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Complaint {
  id: string;
  complaintId: string;

  // Complainant (public user)
  complainantName: string;
  complainantPhone: string;
  complainantCNIC: string;
  complainantAddress: string;

  // Complaint details
  complaintType: string;
  description: string;
  priority: ComplaintPriority;
  images: string[];

  // Location
  province: string;
  division: string;
  district: string;
  tehsil: string;
  ucId: string;
  ucName: string;
  coordinates: Coordinates;
  locationAddress: string;

  // Workflow status
  status: ComplaintStatus;
  approval: ComplaintApproval | null;

  // Assignment
  assignedTo: string | null;
  assignedToName: string | null;
  assignedBy: string | null;
  assignedAt: Timestamp | null;
  assignmentNotes: string | null;

  // Resolution
  resolvedAt: Timestamp | null;
  resolutionNotes: string | null;
  resolutionImages: string[];
  rejectionReason: string | null;

  // Metadata
  source: ComplaintSource;
  submittedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
