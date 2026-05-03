import {
  LayoutDashboard,
  MapPin,
  MessageSquareWarning,
  ClipboardList,
  UserCog,
  FileText,
  Tag,
  Shield,
} from 'lucide-react';

export interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  superAdminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: MapPin, label: 'Live Map', path: '/live-map' },
  { icon: MessageSquareWarning, label: 'Complaints', path: '/complaints' },
  { icon: ClipboardList, label: 'Assignments', path: '/assignments' },
  { icon: UserCog, label: 'Employees', path: '/employees' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: Tag, label: 'Complaint Types', path: '/complaint-types', superAdminOnly: true },
  { icon: Shield, label: 'Admin Management', path: '/admin-management', superAdminOnly: true },
];
