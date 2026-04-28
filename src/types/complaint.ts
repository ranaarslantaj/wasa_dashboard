import type { Timestamp } from 'firebase/firestore';
import type { WasaCategoryValue } from '@/constants/wasaCategories';

export type ComplainTypeValue = 'dog' | 'manhole';
export type DepartmentType = 'wasa' | null;
export type RoutingStrategy = 'UC_MC_AUTO' | 'DEPT_DASHBOARD';
export type ComplaintStatus = 'action_required' | 'action_taken' | 'irrelevant';
export type UcMcType = 'UC' | 'MC' | '';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical'; // derived only

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ActionCoordinates {
  lat: number | null;
  lng: number | null;
}

export interface Complaint {
  // Identity
  id: string;                       // doc id
  complaintId: string;              // human-readable e.g. VHR-00001

  // Complainant
  complainantName: string;
  complainantPhone: string;
  complainantCnic: string;
  complainantAddress: string;
  createdBy: string;                // citizen Auth UID

  // What & where
  complainType: ComplainTypeValue;  // always 'manhole' for this dashboard
  dogType?: 'Stray' | 'Pet' | '';
  description: string;
  address: string;                  // issue address (free text)
  complainCoordinates: Coordinates;

  // Geographic hierarchy
  division: string;
  district: string;
  tahsil: string;                   // NB: schema spelling (not 'tehsil')

  // UC/MC assignment
  ucMcType: UcMcType;
  ucMcNumber: string;
  ucId: string;

  // Department routing
  departmentType: DepartmentType;
  routingStrategy: RoutingStrategy;
  wasaCategory: WasaCategoryValue | null;
  assignedTo: string | null;        // employee UID
  assignedAt: Timestamp | null;

  // Status & resolution
  complaintStatus: ComplaintStatus;
  complaintApproval: string | null; // reserved
  requestType: string | null;       // reserved
  reason: string | null;            // populated when 'irrelevant'
  actionTakenAt: Timestamp | null;
  actionImage: string | null;
  actionCoordinates: ActionCoordinates;

  // Media
  complaintImage: string;           // single download URL

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
}
