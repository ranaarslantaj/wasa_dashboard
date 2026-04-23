import type { ComplaintPriority } from './complaint';
import type { Department } from './employee';

export interface ComplaintType {
  id: string;
  key: string;
  label: string;
  icon: string;
  color: string;
  defaultPriority: ComplaintPriority;
  defaultDepartment: Department;
  active: boolean;
  sortOrder: number;
}
