export interface AppNotification {
  id: string;
  complaintId: string;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  data?: Record<string, unknown>;
}
