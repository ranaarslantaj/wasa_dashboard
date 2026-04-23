# WASA Dashboard — Build Spec

> Hand this file to Claude in a fresh project folder. It contains everything needed to scaffold the WASA (Water & Sanitation Agency) dashboard modeled on the WeWatch dashboard architecture.

---

## 1. Project Overview

**WASA Dashboard** is a web-based admin panel for the Water & Sanitation Agency. It manages public water/sanitation complaints submitted via a Public Mobile Application, assigns them to government employees, and tracks resolution — all enforced by a 4-tier geographic access hierarchy (Province → Division → District → Tehsil).

**Tech stack (match WeWatch exactly):**
- React 18 (CRA + CRACO)
- Firebase v12 (Firestore + Auth + Storage)
- Tailwind CSS
- `react-router-dom` v7
- `leaflet` + `react-leaflet` + `leaflet.heat` (maps)
- `recharts` (charts)
- `jspdf` + `jspdf-autotable` (PDF export)
- `xlsx` (Excel export)
- `pptxgenjs` (PowerPoint export)
- `lucide-react` (icons)
- `date-fns` (dates)

**Design language (match WeWatch):**
- Dark mode + Light mode toggle (System / Light / Dark)
- Rounded 2xl cards, subtle borders, shadow-sm
- Color palette: Blue-600 primary, Green-600 success, Red-600 destructive, Amber warning
- Icon + text buttons (lucide icons, 16–18px)
- Modal dialogs with overlay + blur, rounded-2xl
- Toast notifications for all async actions
- Sidebar navigation with icon + label, active state highlighted
- Responsive: mobile sidebar collapses, grids reflow to 1-col on small screens

---

## 2. Core Entities (Firestore Collections)

| Collection | Purpose |
|------------|---------|
| `Admins` | Admin accounts with access level + geographic scope |
| `WasaEmployees` | Government employees (created by admins, log in via a separate app) |
| `Complaints` | Public complaints (created via Public App, assigned by admins) |
| `ComplaintTypes` | Configurable complaint type catalog (water leak, sewerage, etc.) |
| `Assignments` | History of complaint assignments + status transitions |
| `UnionCouncils` | UC/MC lookup (inherited from WeWatch pattern) |
| `Notifications` | In-app notification log |
| `Campaigns` | Announcements/alerts for public app (super-admin only) |
| `News` | News items for public app (super-admin only) |

### 2.1 Admins schema
```js
{
  id: string,
  name: string,
  email: string,
  phone: string,
  password: string, // hashed / used for auth
  accessLevel: 'province' | 'division' | 'district' | 'tehsil',
  province: 'Punjab',
  division: string | null,
  district: string | null,
  tehsil: string | null,
  status: 'active' | 'inactive',
  createdAt: Timestamp,
  lastLogin: Timestamp
}
```

### 2.2 WasaEmployees schema
```js
{
  id: string,
  uid: string, // Firebase Auth UID
  name: string,
  email: string,
  phone: string,
  password: string,
  cnic: string,
  designation: string, // e.g. "Field Officer", "Plumber", "Supervisor"
  department: 'water_supply' | 'sewerage' | 'maintenance' | 'billing' | 'administration',
  specialization: string[], // e.g. ['water_leak', 'pipe_burst']
  province: string,
  division: string,
  district: string,
  tehsil: string,
  ucId: string | null,
  address: string,
  active: boolean,
  currentAssignments: number, // denormalized count of active complaints
  totalResolved: number,      // denormalized count
  lastLogin: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 2.3 Complaints schema
```js
{
  id: string,
  complaintId: string, // human-readable e.g. WASA-2026-00042

  // Complainant (public user)
  complainantName: string,
  complainantPhone: string,
  complainantCNIC: string,
  complainantAddress: string,

  // Complaint details
  complaintType: string,        // e.g. 'water_leak' — references ComplaintTypes
  description: string,
  priority: 'low' | 'medium' | 'high' | 'critical',
  images: string[],             // URLs in Firebase Storage

  // Location
  province: string,
  division: string,
  district: string,
  tehsil: string,
  ucId: string,
  ucName: string,
  coordinates: { lat: number, lng: number },
  locationAddress: string,

  // Workflow status
  status: 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'rejected' | 'reopened',
  approval: 'pending' | 'approved' | 'rejected' | null,

  // Assignment
  assignedTo: string | null,       // WasaEmployee.uid
  assignedToName: string | null,   // denormalized
  assignedBy: string | null,       // Admin.id
  assignedAt: Timestamp | null,
  assignmentNotes: string | null,

  // Resolution
  resolvedAt: Timestamp | null,
  resolutionNotes: string | null,
  resolutionImages: string[],
  rejectionReason: string | null,

  // Metadata
  source: 'public_app' | 'dashboard',
  submittedBy: string, // Public user ID
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 2.4 ComplaintTypes schema (configurable)
```js
{
  id: string,
  key: string,        // 'water_leak'
  label: string,      // 'Water Leakage'
  icon: string,       // lucide icon name
  color: string,      // hex
  defaultPriority: 'low' | 'medium' | 'high' | 'critical',
  defaultDepartment: string,
  active: boolean,
  sortOrder: number
}
```

**Seed these 6 starter types:**
1. `water_leak` — Water Leakage (Droplets, #3B82F6, high)
2. `pipe_burst` — Pipe Burst (AlertTriangle, #EF4444, critical)
3. `sewerage_overflow` — Sewerage Overflow (Waves, #A16207, high)
4. `low_water_pressure` — Low Water Pressure (Gauge, #F59E0B, medium)
5. `contaminated_water` — Contaminated Water (FlaskConical, #DC2626, critical)
6. `billing_issue` — Billing / Meter Issue (Receipt, #6B7280, low)

### 2.5 Assignments schema (audit trail)
```js
{
  id: string,
  complaintId: string,
  employeeId: string,
  employeeName: string,
  assignedBy: string,
  assignedByName: string,
  status: 'assigned' | 'in_progress' | 'resolved' | 'reassigned' | 'rejected',
  notes: string,
  timestamp: Timestamp
}
```

---

## 3. Geographic Hierarchy

Copy the constants file from WeWatch as-is:

```js
// src/constants/index.js
export const PROVINCES = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'Gilgit-Baltistan', 'Azad Kashmir', 'ICT'];

export const PROVINCE_DIVISIONS = { /* same as WeWatch */ };
export const DIVISION_DISTRICTS = { /* same as WeWatch */ };
export const DISTRICT_TEHSILS  = { /* same as WeWatch */ };

export const getDivisionsForProvince = (province) => PROVINCE_DIVISIONS[province] || [];
export const getDistrictsForDivision = (division) => DIVISION_DISTRICTS[division] || [];
export const getTehsilsForDistrict = (district) => DISTRICT_TEHSILS[district] || [];

export const ACCESS_LEVELS = {
  PROVINCE: 'province',
  DIVISION: 'division',
  DISTRICT: 'district',
  TEHSIL: 'tehsil',
};
```

---

## 4. Access Level Rules (STRICT — Copy from WeWatch)

The dashboard MUST enforce these rules everywhere data is displayed, filtered, or aggregated:

| Access Level | Can See | Filter Locks |
|--------------|---------|--------------|
| **Province** | All data in province | None |
| **Division** | Only districts in `adminScope.division` | Division locked |
| **District** | Only their district | District + Division locked |
| **Tehsil** | Only their tehsil | Tehsil + District + Division locked |

**Every component with data display or filters MUST:**
1. Compute `scopeDistricts` via useMemo (using `getDistrictsForDivision`)
2. Lock district/tehsil dropdowns based on accessLevel
3. Filter fetched data by scope BEFORE user filters
4. Use `scopeDistricts` (not raw `DISTRICTS`) in dropdowns
5. Stats cards must reflect scope-filtered data, not raw data

---

## 5. Project Structure

```
src/
├── App.js
├── index.js
├── config/
│   ├── firebase.js
│   └── adminAccess.js          // super-admin email whitelist
├── constants/
│   └── index.js                 // geographic + complaint type constants
├── context/
│   ├── AuthContext.js           // admin state + adminScope
│   ├── FilterContext.js         // shared scope-aware filters
│   └── NotificationContext.js   // realtime complaint notifications
├── hooks/
│   ├── useComplaints.js         // primary data hook
│   ├── useWasaEmployees.js
│   ├── useComplaintTypes.js
│   ├── useUnionCouncils.js
│   ├── useAssignments.js
│   └── useCampaigns.js
├── components/
│   ├── Layout.js                // sidebar + header + theme toggle
│   ├── Dashboard.js             // KPIs + charts + recent activity
│   ├── LiveMap.js               // complaint markers + heatmap
│   ├── Complaints.js            // PRIMARY complaint management
│   ├── ComplaintDetail.js       // view/assign/resolve modal
│   ├── Employees.js             // WASA employee management
│   ├── Assignments.js           // assignment history + workload
│   ├── ReportTable.js           // aggregated reports
│   ├── ComplaintTypes.js        // configure complaint types (super-admin)
│   ├── AdminManagement.js       // super-admin only
│   ├── Campaigns.js             // super-admin only
│   ├── News.js                  // super-admin only
│   ├── Filters.js               // shared filter UI (scope-aware)
│   ├── Login.js
│   ├── ProtectedRoute.js
│   ├── NotificationDropdown.js
│   ├── Toast.js
│   ├── PageLoader.js
│   └── ErrorBoundary.js
```

---

## 6. Page-by-Page Feature Spec

### 6.1 Dashboard (home page)
KPI cards:
- Total Complaints (scope-filtered)
- Pending Assignment
- In Progress
- Resolved Today / This Week / This Month
- Average Resolution Time
- Active Employees

Charts:
- Area chart: Complaints over time (7d/30d/90d/custom)
- Bar chart: Complaints by type
- Bar chart: Complaints by tehsil/UC
- Pie chart: Status distribution
- Bar chart: Top 5 employees by resolved count

Recent activity lists:
- Latest complaints (5)
- Recently assigned (5)
- Recently resolved (5)

Uses `FilterContext` for shared filters.

### 6.2 Live Map
- Leaflet map with boundary polygons (district/tehsil/UC)
- Multiple layers: All complaints / Pending / Assigned / In Progress / Resolved
- Heatmap of complaint density
- Color-coded markers by complaint type
- Filter by: date range, district, tehsil, UC, complaint type, status, priority, assignee
- Cluster markers at low zoom
- Click marker → compact popup → "View Details" opens full modal
- **Performance rule:** Only fetch data for the active layer. Skip fetches when layer is off.
- Default to last 7 days on mount to keep initial load light.

### 6.3 Complaints (primary page)
Table view with:
- Columns: Complaint ID, Type (badge with icon/color), Complainant, Location, Priority, Status, Assignee, Created, Actions
- Filters: District, Tehsil, UC, Complaint Type, Status, Priority, Assignee, Date Range, Search (name/phone/ID/description)
- Sort by: Date, Priority, Status
- Pagination: 10/25/50/100 per page
- Bulk actions: Bulk assign, bulk status change
- Export: PDF + Excel (with confirmation modal before download)

Row actions:
- View Details → opens modal (ComplaintDetail)
- Quick Assign → employee picker
- Change Status
- Delete (with confirmation)

### 6.4 Complaint Detail (modal)
Left pane: images gallery (lazy loaded)
Right pane:
- Type badge, priority badge, status badge, approval badge
- Complainant section: name, phone, CNIC, address
- Location section: district/tehsil/UC + coordinates + "Open in Google Maps" link
- Description + timestamps
- Assignment section:
  - If unassigned: searchable employee dropdown (filter by specialization + geographic scope + workload) + "Assign" button
  - If assigned: employee card with contact info + "Reassign" button + "Mark Resolved" + "Reject"
- Assignment history timeline (from `Assignments` collection)
- Resolution section: notes + after-photos upload + resolve button
- Action buttons row: Approve · Reject · Reassign · Mark Resolved · **Delete** · Close
  - Delete must show inline confirmation: "Are you sure? This will permanently delete this record."

### 6.5 Employees (WASA Employee Management)
Same pattern as WeWatch Users.js, but fields adapted:
- Table with: Name, Designation, Department, Email, Phone, District/Tehsil, Active Assignments, Total Resolved, Status, Last Login
- Add/Edit modal:
  - Name, Email, Password, Phone, CNIC
  - Designation (free text)
  - Department (dropdown)
  - Specializations (multi-select from ComplaintTypes)
  - Geographic assignment (Province → Division → District → Tehsil → UC cascading, scope-locked)
  - Active toggle
- Delete with password confirmation (mirrors WeWatch pattern)
- Filter by: Department, Specialization, District, Tehsil, Status, Activity
- Export: PDF + Excel (with confirmation)

### 6.6 Assignments
View all assignments grouped by:
- Employee (workload view)
- Date (timeline view)
- Status

Show workload chart: complaints per employee. Highlight overloaded employees (>10 active).

### 6.7 Report Table
Aggregated stats grouped by:
- Tehsil (default)
- UC
- Complaint Type
- Employee

Columns: Total, Pending, Assigned, In Progress, Resolved, Rejected, Avg Resolution Time

Export: PDF with progress tracking (copy WeWatch pattern from ReportTable.js).

### 6.8 Complaint Types (super-admin only)
CRUD for `ComplaintTypes` collection. Reorder, activate/deactivate, icon picker, color picker.

### 6.9 Admin Management, Campaigns, News
Super-admin only (gated via `config/adminAccess.js`). Same as WeWatch.

---

## 7. Authentication + Authorization

### 7.1 AuthContext.js (copy from WeWatch, unchanged)
Handles:
- Login/logout
- `adminScope` memo (accessLevel + geographic fields)
- Full-access override for emails in `ADMIN_MANAGEMENT_EMAILS`
- Realtime listener on `Admins/{id}` — logs out if status becomes `inactive` or doc is deleted
- Persists admin to localStorage

### 7.2 adminAccess.js
```js
export const ADMIN_MANAGEMENT_EMAILS = [
  'dev@wasa.com',
  // Add super-admin emails here
];

export const hasAdminManagementAccess = (email) => {
  if (!email) return false;
  return ADMIN_MANAGEMENT_EMAILS.some(
    e => e.toLowerCase().trim() === email.toLowerCase().trim()
  );
};
```

### 7.3 ProtectedRoute.js
Wraps authenticated routes. Redirects to `/login` if `!isAuthenticated`.

### 7.4 AdminManagementRoute (in App.js)
Wraps super-admin routes. Redirects to `/` if `!hasAdminManagementAccess`.

---

## 8. FilterContext.js (Shared Filters)

Copy WeWatch's FilterContext.js with these changes:
- Replace `selectedDogType` with `selectedComplaintType`
- `availableDistricts` MUST respect division level: `getDistrictsForDivision(adminScope.division)`
- `availableTahsils` MUST filter tehsils within scope districts for division admins
- UC lookup filtered by `availableDistricts`

**Critical:** Do NOT regress the division-level fix — province users get all districts, division users only get their division's districts.

---

## 9. NotificationContext.js

Realtime listener on `Complaints` collection (last 2 hours). Filter notifications by admin scope:

```js
if (scope && scope.accessLevel !== 'province') {
  const reportDistrict = data.district || '';
  const reportTahsil = data.tahsil || '';

  if (scope.accessLevel === 'division' && scope.division) {
    const divisionDistricts = getDistrictsForDivision(scope.division);
    if (!reportDistrict || !divisionDistricts.includes(reportDistrict)) return;
  }
  if (scope.accessLevel === 'district') {
    if (!scope.district || reportDistrict !== scope.district) return;
  }
  if (scope.accessLevel === 'tehsil') {
    if (!scope.district || reportDistrict !== scope.district) return;
    if (!scope.tehsil || reportTahsil !== scope.tehsil) return;
  }
}
```

Features:
- Debounced batch toast (500ms)
- Sound via Web Audio API (two-tone)
- Keeps last 50 notifications in state
- Mark-as-read, mark-all-as-read, clear-all

---

## 10. Hook Patterns (Performance Critical)

Every Firestore hook MUST:
1. Accept `filters` arg (pass `null` to disable the hook)
2. Return `{ data, loading, error, refetch }`
3. Use `limit()` — never fetch unbounded
4. Use Firestore `where()` for server-side scope filtering where possible
5. Cache in a ref (`prevFiltersRef`) to skip duplicate fetches
6. Use `getDocs` (one-time) by default — reserve `onSnapshot` for notification center only
7. Set `loading: false` and `data: []` immediately when `filters === null`

### Example: useComplaints
```js
const useComplaints = (filters) => {
  const enabled = filters !== null;
  // ...
  useEffect(() => {
    if (!enabled) { setData([]); setLoading(false); return; }
    // server-side where() for district, status, complaintType
    // limit(1000) hard cap
    // client-side filter: date range, search, priority
  }, [/* deps */, enabled]);
};
```

---

## 11. Export Patterns

**PDF export** (use `jspdf` + `jspdf-autotable`):
- Always show confirmation modal before download: "Download PDF report with X records?"
- Include header: title, generated timestamp, summary stats
- Use striped theme, Blue-600 header
- Footer: page number

**Excel export** (use `xlsx`):
- Separate button next to PDF
- Column widths tuned per field
- Filename: `WASA_<Type>_Report_YYYY-MM-DD.xlsx`

**PowerPoint** (only for Complaints page): use `pptxgenjs` for image-heavy reports.

---

## 12. UI Patterns to Copy from WeWatch

- **Modal overlay:** `fixed inset-0 z-50 flex items-center justify-center p-4` + `absolute inset-0 bg-black/50`
- **Card:** `rounded-xl shadow-sm border p-4 bg-white dark:bg-gray-800`
- **Primary button:** `px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium`
- **Destructive button:** `bg-red-600 hover:bg-red-700`
- **Icon button:** `p-2.5 rounded-lg bg-gray-100 hover:bg-gray-200`
- **Disabled state:** `opacity-50 cursor-not-allowed`
- **Badge:** `px-2 py-0.5 rounded text-xs font-medium bg-{color}-100 text-{color}-700`
- **Table:** `min-w-full divide-y divide-gray-200 dark:divide-gray-700`
- **Filter chip:** `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium`
- **Empty state:** centered icon + heading + subtitle + optional CTA

---

## 13. Sidebar Navigation Order

```js
const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: MapPin, label: 'Live Map', path: '/live-map' },
  { icon: MessageSquareWarning, label: 'Complaints', path: '/complaints' },
  { icon: ClipboardList, label: 'Assignments', path: '/assignments' },
  { icon: UserCog, label: 'Employees', path: '/employees' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  // Super-admin only:
  ...(canAccessAdminManagement ? [
    { icon: Tag, label: 'Complaint Types', path: '/complaint-types' },
    { icon: Megaphone, label: 'Campaigns', path: '/campaigns' },
    { icon: Newspaper, label: 'News', path: '/news' },
    { icon: Shield, label: 'Admin Management', path: '/admin-management' },
  ] : []),
];
```

Header shows: Admin name + access level + district/tehsil (e.g. "DC Lodhran — District Admin").

---

## 14. Complaint Workflow (State Machine)

```
pending → (admin assigns) → assigned
assigned → (employee accepts) → in_progress
in_progress → (employee submits resolution) → resolved (requires admin approval)
resolved → (admin approves) → approved (final)
resolved → (admin rejects resolution) → reopened → in_progress
any state → (admin rejects) → rejected (with reason)
```

Only admins can:
- Assign / reassign
- Approve / reject resolutions
- Delete complaints
- Change priority

Employees (via separate app) can:
- Accept assignment → move to `in_progress`
- Submit resolution with photos/notes → move to `resolved`

---

## 15. Assignment Logic (Smart Assignment)

When admin opens the "Assign" picker, rank employees by:
1. Specialization matches complaint type (highest priority)
2. Geographic scope overlap (same tehsil > same district > same division)
3. Lowest current workload (`currentAssignments`)
4. Active status
5. Last login recency (prefer recently active)

Show workload badge next to each employee: `(3 active)` + color (green <5, amber 5–9, red 10+).

---

## 16. Complaint ID Generation

Format: `WASA-YYYY-NNNNN` (zero-padded 5-digit sequence per year).
Use a Firestore counter doc `Counters/complaints/{YYYY}` with a transaction.

---

## 17. Package.json Dependencies

```json
{
  "dependencies": {
    "@craco/craco": "^5.9.0",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.1",
    "@testing-library/user-event": "^13.5.0",
    "date-fns": "^4.1.0",
    "firebase": "^12.7.0",
    "jspdf": "^4.0.0",
    "jspdf-autotable": "^5.0.7",
    "leaflet": "^1.9.4",
    "leaflet.heat": "^0.2.0",
    "lucide-react": "^0.562.0",
    "pptxgenjs": "^3.12.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-leaflet": "^4.2.1",
    "react-router-dom": "^7.12.0",
    "react-scripts": "^5.0.1",
    "recharts": "^3.6.0",
    "web-vitals": "^2.1.4",
    "xlsx": "^0.18.5"
  },
  "scripts": {
    "start": "craco start",
    "build": "craco build",
    "test": "craco test"
  }
}
```

---

## 18. Build Order (Claude should follow this)

1. **Scaffold CRA + CRACO + Tailwind** using the package.json above
2. **Configure Firebase** (`config/firebase.js`) — ask user for config values, or use placeholders with clear TODO markers
3. **Constants** — geographic hierarchy, access levels, complaint type seeds
4. **AuthContext + Login + ProtectedRoute** — verify login works against `Admins` collection
5. **Layout + sidebar + theme toggle** — visual shell
6. **FilterContext** — scope-aware, with division-level fix
7. **useComplaints hook** — server-side district filter, limit(1000), null-disables
8. **Complaints page** — table + filters + detail modal + assign/resolve flow
9. **Employees page** — CRUD with scope-aware locking
10. **Dashboard** — KPIs + charts wired to shared filters
11. **LiveMap** — leaflet + boundary polygons + marker clustering + layered fetching
12. **Assignments page**
13. **Reports page**
14. **NotificationContext + bell** — realtime complaint listener with scope filter
15. **Super-admin pages:** Admin Management, Complaint Types, Campaigns, News
16. **Export buttons** (PDF + Excel) with confirmation modals
17. **Notification filtering** — verify division/district/tehsil filter rules
18. **Responsive pass** — mobile sidebar, grid collapses

---

## 19. Non-Negotiable Rules

1. **Scope enforcement is mandatory** on every dropdown, stats card, and data fetch.
2. **Never use raw `DISTRICTS.map()`** in dropdowns — always `scopeDistricts.map()`.
3. **Every delete action** requires a confirmation step (inline or modal).
4. **Every PDF/Excel export** requires a confirmation modal before download.
5. **Never fetch unbounded** — always `limit()`.
6. **Never use `onSnapshot`** except the notification center.
7. **Lazy-load LiveMap layers** — only fetch the active layer's data.
8. **Never mention emojis in the UI** unless specifically requested.
9. **All timestamps in UI** use `date-fns` format.
10. **All toasts via `useToast()`** — never browser `alert()`.

---

## 20. Initial Prompt for Claude

> Use this file as the complete spec. Scaffold a React + Firebase WASA dashboard matching the architecture described above. Start with package.json + Tailwind + folder structure + constants + AuthContext + Login page. Then pause and confirm the shell renders before moving on. Follow the build order in §18 strictly. Before wiring any data source, implement the scope-aware filter pattern in §4 and §8 — every subsequent feature depends on it.
