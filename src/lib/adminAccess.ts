export const ADMIN_MANAGEMENT_EMAILS: string[] = [
  'dev@team.com',
];

export const hasAdminManagementAccess = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return ADMIN_MANAGEMENT_EMAILS.some((e) => e.toLowerCase().trim() === normalized);
};
