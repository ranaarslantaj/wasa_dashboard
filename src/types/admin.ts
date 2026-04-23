import type { Timestamp } from 'firebase/firestore';

export type AccessLevel = 'province' | 'division' | 'district' | 'tehsil';

export type AdminStatus = 'active' | 'inactive';

export interface Admin {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  accessLevel: AccessLevel;
  province: string;
  division: string | null;
  district: string | null;
  tehsil: string | null;
  status: AdminStatus;
  createdAt: Timestamp;
  lastLogin: Timestamp;
}

export interface AdminScope {
  accessLevel: AccessLevel;
  province: string;
  division: string | null;
  district: string | null;
  tehsil: string | null;
  fullAccess: boolean;
}
