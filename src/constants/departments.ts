export const DEPARTMENTS = [
  { value: 'water_supply', label: 'Water Supply' },
  { value: 'sewerage', label: 'Sewerage' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'billing', label: 'Billing' },
  { value: 'administration', label: 'Administration' },
] as const;

export type DepartmentValue = (typeof DEPARTMENTS)[number]['value'];
