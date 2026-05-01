// Admin Management Access Configuration
// Add email addresses that should have access to the Admin Management page
// Emails are case-insensitive

export const ADMIN_MANAGEMENT_EMAILS = [
  'dev@team.com',
  // Add more authorized emails below:
  // 'admin@example.com',
  // 'superadmin@wewatch.com',
];

// Helper function to check if an email has admin management access
export const hasAdminManagementAccess = (email) => {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();
  return ADMIN_MANAGEMENT_EMAILS.some(
    (authorizedEmail) => authorizedEmail.toLowerCase().trim() === normalizedEmail
  );
};
