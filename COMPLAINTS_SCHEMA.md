# Complaints Schema & District-Based Access Routing

This document describes the Firestore schema for the citizen-facing complaint system in the **We_Care** Flutter app, and the access-level routing model that decides whether a complaint is auto-assigned to a UC/MC or surfaced on a department dashboard for manual assignment.

It is intended as a handoff to whoever builds the **WASA admin dashboard** (a separate app/system that reads/writes the same Firestore project).

---

## 1. Project & Collection Overview

- Firebase project ID: `civic-care-19c89`
- Citizen app package: `com.wecare.app`
- Citizens log in via Firebase Auth and file complaints. There is **only one role in this Flutter app: citizen**. Admin and employee roles for WASA live outside this app — likely in your dashboard.

### Relevant Firestore collections

| Collection | Purpose |
|---|---|
| `Complaints` | All complaints (dog + WASA) live here. One document per complaint. |
| `AddressHierarchy/Punjab` | Cascading dropdown source (Division → District → Tehsil) **and** the `districtRouting` config that drives access levels. |
| `UnionCouncils` | UC/MC entities. `id` is the doc ID; the citizen app filters by `tahsil`. |
| `ComplaintCounter/{cityAbbr}` | Per-city monotonic counters used to generate human-readable IDs like `VHR-00001`. |
| `Public/{uid}` | Citizen profile docs. |
| `Departments/{deptId}` | **Not yet seeded.** Reserved for department admin/employee config (see §6). |

---

## 2. `Complaints` Document Schema

One unified collection holds every complaint type. The `complainType` field discriminates.

```ts
Complaints/{autoId}
{
  // -------- Identity --------
  id: string | null,                    // mirror of doc id, optional/legacy
  complaintId: string,                  // human readable e.g. "VHR-00001"

  // -------- Complainant (citizen who filed it) --------
  complainantName: string,
  complainantPhone: string,
  complainantCnic: string,
  complainantAddress: string,           // citizen's home address (from profile)
  createdBy: string,                    // citizen's Firebase Auth UID

  // -------- What & where --------
  complainType: "dog" | "manhole",      // "manhole" is shown to users as "WASA"
  dogType: "Stray" | "Pet" | "",        // dog complaints only
  description: string,
  address: string,                      // free-text address of the issue
  complainCoordinates: {                // GPS where complaint was filed
    lat: number,
    lng: number,
  },

  // -------- Geographic hierarchy (denormalized) --------
  division: string,
  district: string,
  tahsil: string,

  // -------- UC/MC assignment --------
  ucMcType: "UC" | "MC" | "",           // empty when DEPT_DASHBOARD routing
  ucMcNumber: string,                   // e.g. "UC-103" or "MC-Burewala"
  ucId: string,                         // UnionCouncils doc id; empty when DEPT_DASHBOARD

  // -------- Department routing (NEW) --------
  departmentType: "wasa" | null,        // null for dog; "wasa" for manhole/WASA
  routingStrategy: "UC_MC_AUTO" | "DEPT_DASHBOARD",
                                        // snapshot at submission time — does NOT change
                                        // even if district config changes later
  wasaCategory: WasaCategoryValue | null, // see §4 — WASA sub-type
  assignedTo: string | null,            // department employee UID, set by admin
                                        // when DEPT_DASHBOARD complaint is delegated
  assignedAt: Timestamp | null,         // when admin assigned to employee

  // -------- Status & resolution --------
  complaintStatus: "action_required" | "action_taken" | "irrelevant",
                                        // initial state is "action_required"
  complaintApproval: string | null,     // reserved for approval workflow
  requestType: string | null,           // reserved
  reason: string | null,                // reserved (e.g. "irrelevant" reason)
  actionTakenAt: Timestamp | null,
  actionImage: string | null,           // photo proof when resolved
  actionCoordinates: {                  // GPS where action was taken
    lat: number | null,
    lng: number | null,
  },

  // -------- Media --------
  complaintImage: string,               // Firebase Storage download URL

  // -------- Audit --------
  createdAt: Timestamp,
  updatedAt: Timestamp | null,
}
```

### Field-by-field write/read responsibilities

| Field | Set by citizen app at submit? | Set by WASA dashboard? |
|---|---|---|
| `complaintId` | Yes — generated via `ComplaintCounter` transaction | No |
| `complainantName/Phone/Cnic/Address/createdBy` | Yes (from auth + profile) | No |
| `complainType` | Yes (`dog` or `manhole`) | No |
| `dogType` | Yes (dog only) | No |
| `description`, `address`, `complainCoordinates` | Yes | No |
| `division`, `district`, `tahsil` | Yes | No |
| `ucMcType`, `ucMcNumber`, `ucId` | Yes when `UC_MC_AUTO`; empty strings when `DEPT_DASHBOARD` | Optional — admin may set these later if delegating to a UC/MC instead of an employee |
| `departmentType` | Yes (`"wasa"` for WASA complaints) | No |
| `routingStrategy` | Yes — snapshot of `AddressHierarchy.districtRouting[district][type]` at submit time | **Do not modify** — this is immutable once set |
| `wasaCategory` | Yes (one of 7 values, see §4) | No |
| `assignedTo`, `assignedAt` | No | **Yes** — when admin assigns to a WASA employee |
| `complaintStatus` | Initial `"action_required"` | **Yes** — admin/employee transitions to `action_taken` / `irrelevant` |
| `actionTakenAt`, `actionImage`, `actionCoordinates`, `reason` | No | **Yes** — populated when employee resolves/closes |
| `createdAt` | Yes | No |
| `updatedAt` | No | **Yes** on any change |

---

## 3. The Access Level Mechanism (`districtRouting`)

This is the core of the feature. Each district decides — per complaint type — whether a citizen-filed complaint is **auto-assigned to a UC/MC** or **lands on the WASA dashboard for admin assignment**.

### Where the config lives

`AddressHierarchy/Punjab` is a single document. We added one field, `districtRouting`:

```ts
AddressHierarchy/Punjab
{
  hierarchy: { /* Division → District → [Tehsil] for cascading dropdowns */ },

  districtRouting: {
    "Vehari":   { "manhole": "UC_MC_AUTO" },
    "Multan":   { "manhole": "UC_MC_AUTO" },
    "Khanewal": { "manhole": "UC_MC_AUTO" },
    "Lodhran":  { "manhole": "DEPT_DASHBOARD" }
    // Add more districts and complaintTypes here as needed.
    // Missing entries default to "UC_MC_AUTO" — backwards compatible.
  },

  updatedAt: Timestamp,
}
```

- Inner key (`"manhole"`) **matches the internal `complainType` value**, NOT the user-facing label "WASA".
- The two strategies are constants in code: `UC_MC_AUTO` and `DEPT_DASHBOARD`.
- The config can be edited live from the Firebase console; the app re-reads it once per session (cached in memory).

### Strategy semantics

#### `UC_MC_AUTO`

- Citizen MUST select UC/MC type and a specific UC/MC during the form.
- On submit:
  - `ucId`, `ucMcType`, `ucMcNumber` are populated.
  - Push notification fires to that UC/MC's `fcmToken` (read from `UnionCouncils/{ucId}.fcmToken`).
- The complaint is "owned" by that UC/MC immediately.

#### `DEPT_DASHBOARD`

- Citizen does **NOT** select UC/MC. The form hides those fields and shows an info banner explaining that the WASA admin will assign the complaint.
- On submit:
  - `ucId = ""`, `ucMcType = ""`, `ucMcNumber = ""`.
  - `routingStrategy = "DEPT_DASHBOARD"`.
  - `departmentType = "wasa"`.
  - The citizen app attempts to push a notification to the district's WASA admin via `Departments/{deptId}.adminsByDistrict[district]` → admin UID → fcmToken. **This collection isn't seeded yet** — see §6 for the expected shape.
- The complaint sits in Firestore with `complaintStatus = "action_required"`, no `assignedTo`. **It's the WASA dashboard's job to surface it and assign it to an employee.**

### Why the strategy is snapshotted on the document

`routingStrategy` is captured **at submit time** and stored on the complaint. If you change `districtRouting` later (say, switch Lodhran from `DEPT_DASHBOARD` to `UC_MC_AUTO`), in-flight complaints already filed under Lodhran retain their original behavior. Only **new** complaints pick up the new strategy.

This means: **Treat `routingStrategy` on a complaint as immutable — never overwrite it from the dashboard.**

---

## 4. WASA Sub-Categories (`wasaCategory`)

Every WASA complaint (`complainType == "manhole"`) carries a sub-type the citizen picked from a dropdown. The 7 allowed values:

| Stored value | User-facing label |
|---|---|
| `no_water` | No water / shortage of water |
| `sewerage_blockage` | Sewerage line blockage / overflow |
| `manhole_cover` | Broken / missing manhole covers |
| `damaged_pipes` | Damaged sewage pipes |
| `rainwater_blockage` | Rainwater drainage blockage |
| `low_pressure` | Low pressure |
| `others` | Others |

Stored as a string on the complaint document; the dashboard should map it to a label when displaying. Required when `complainType == "manhole"`; null otherwise.

---

## 5. Status Lifecycle

```
                                  ┌─── action_taken    (resolved by employee/UC-MC)
                                  │
   action_required (on submit) ───┤
                                  │
                                  └─── irrelevant      (rejected by admin/UC-MC)
```

The citizen app **only writes** `complaintStatus = "action_required"` at submission. Status transitions are the dashboard's responsibility. When transitioning to `action_taken`, the dashboard should also set:

- `actionTakenAt: serverTimestamp()`
- `actionImage: <storage url>` (proof photo)
- `actionCoordinates: { lat, lng }` (where the action was taken)
- `updatedAt: serverTimestamp()`

When transitioning to `irrelevant`, populate `reason` with a short string explaining why.

---

## 6. `Departments/{deptId}` — Expected Shape (NOT YET SEEDED)

The citizen app references `Departments/wasa` to find the district admin's FCM token, but the doc doesn't exist yet. When you build the dashboard, the suggested shape:

```ts
Departments/wasa
{
  name: "WASA",
  adminsByDistrict: {
    "Lodhran": "<admin user uid>",      // one admin per DEPT_DASHBOARD district
    // …
  },
  // employees subcollection or array — your choice
}

Departments/wasa/employees/{uid}
{
  name: string,
  district: string,
  phone: string,
  fcmToken: string,
  active: boolean,
}
```

The push from the citizen app currently looks up `Public/{adminUid}.fcmToken`. If your admins don't live in `Public/`, just ignore the push — the dashboard can listen on `Complaints` directly via a Firestore stream and show new entries in real time without relying on FCM.

---

## 7. Suggested Dashboard Queries

### All WASA complaints awaiting admin action (DEPT_DASHBOARD pending queue)
```js
db.collection("Complaints")
  .where("departmentType", "==", "wasa")
  .where("routingStrategy", "==", "DEPT_DASHBOARD")
  .where("complaintStatus", "==", "action_required")
  .where("assignedTo", "==", null)        // not yet assigned to an employee
  .orderBy("createdAt", "desc")
```

### WASA complaints already assigned to an employee
```js
db.collection("Complaints")
  .where("departmentType", "==", "wasa")
  .where("assignedTo", "!=", null)
  .orderBy("assignedTo")
  .orderBy("createdAt", "desc")
```

### Complaints assigned to a specific WASA employee (their personal queue)
```js
db.collection("Complaints")
  .where("departmentType", "==", "wasa")
  .where("assignedTo", "==", employeeUid)
  .where("complaintStatus", "==", "action_required")
  .orderBy("createdAt", "desc")
```

### Filter by district (admin scoped to one district)
Add `.where("district", "==", "Lodhran")` to any of the above.

### Filter by sub-category
Add `.where("wasaCategory", "==", "no_water")`.

> ⚠️ Most of these queries require composite indexes. Firestore will surface a console link the first time you run them.

---

## 8. Assignment Action (Dashboard → Employee)

When the WASA admin assigns a `DEPT_DASHBOARD` complaint to an employee:

```js
db.collection("Complaints").doc(complaintId).update({
  assignedTo: employeeUid,
  assignedAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
  // do NOT change: routingStrategy, departmentType, complainType, ucId, ucMcType, ucMcNumber
});
```

`complaintStatus` stays `action_required` until the employee actually resolves it.

---

## 9. Things the Dashboard Must NOT Do

- **Do not modify** `routingStrategy`, `departmentType`, `wasaCategory`, `complainType`, or any `complainant*` / `createdBy` fields. These are immutable post-submit.
- **Do not delete complaints**. Use status transitions (`irrelevant` with a `reason`) for rejections.
- **Do not write to `ComplaintCounter/*`**. Counters belong to the citizen app's submit flow.

---

## 10. Quick Diagram of the Submit Flow

```
Citizen taps "WASA Complaint" tile
        │
        ▼
Form: image, location, wasaCategory, address, division→district→tehsil
        │
        ▼
On district selection → app reads AddressHierarchy.districtRouting[district]["manhole"]
        │
        ▼
   ┌────┴─────────────────────────┐
   │                              │
   UC_MC_AUTO                  DEPT_DASHBOARD
   show UC/MC fields           hide UC/MC, show info banner
   require selection           skip selection
   │                              │
   ▼                              ▼
Submit:                       Submit:
  ucId = selected uc            ucId = ""
  routingStrategy = "UC_MC_AUTO"  routingStrategy = "DEPT_DASHBOARD"
  push FCM → UC/MC                push FCM → district admin (if seeded)
        │                              │
        └──────────┬───────────────────┘
                   ▼
        Complaints/{autoId} written
        complaintStatus = "action_required"
```

---

## 11. Useful Constants (mirrored in code)

In the Flutter app, these live in `lib/core/services/address_hierarchy_service.dart` and `lib/features/complaint/viewmodels/complaint_viewmodel.dart`:

```dart
class RoutingStrategy {
  static const ucMcAuto      = 'UC_MC_AUTO';
  static const deptDashboard = 'DEPT_DASHBOARD';
}

class ComplaintType {
  static const dog     = 'dog';
  static const manhole = 'manhole'; // user-facing: "WASA"
}

class ComplaintDepartment {
  static const wasa = 'wasa';
}

// 7 WASA sub-types: stored value → label
const wasaCategories = {
  'no_water':           'No water / shortage of water',
  'sewerage_blockage':  'Sewerage line blockage / overflow',
  'manhole_cover':      'Broken / missing manhole covers',
  'damaged_pipes':      'Damaged sewage pipes',
  'rainwater_blockage': 'Rainwater drainage blockage',
  'low_pressure':       'Low pressure',
  'others':             'Others',
};
```

Use the same string values in the dashboard for consistency.
