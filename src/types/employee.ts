import type { Timestamp } from 'firebase/firestore';

export type Department =
  | 'water_supply'
  | 'sewerage'
  | 'maintenance'
  | 'billing'
  | 'administration';

export interface WasaEmployee {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  cnic: string;
  designation: string;
  department: Department;
  specialization: string[];
  province: string;
  division: string;
  district: string;
  tehsil: string;
  ucId: string | null;
  address: string;
  active: boolean;
  currentAssignments: number;
  totalResolved: number;
  lastLogin: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
