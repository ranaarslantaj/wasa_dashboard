# WASA Employee App — Firestore Handoff

This document describes everything an employee mobile/web app needs to: (1) log a WASA field employee in, (2) fetch the complaints assigned to them, (3) update their status to **`action_taken`** when they finish a job, with proof photo + GPS. Built to be a self-contained brief for whoever implements the employee app.

The dashboard ("WASA Admin Panel") and the employee app share **one Firestore project**. The dashboard is the only writer for assignment / unassign / reassign. The employee app is the only writer for resolution proof (`actionImage`, `actionCoordinates`, `actionTakenAt`).

---

## 1. Firebase Project

| Setting | Value |
|---|---|
| Project ID | `civic-care-19c89` |
| Auth Domain | `civic-care-19c89.firebaseapp.com` |
| Storage Bucket | `civic-care-19c89.firebasestorage.app` |
| Sender ID | `37661608601` |
| App ID | `1:37661608601:web:0b7b72e0f44755c051c608` |

Use **Firebase Auth (Email + Password)** for sign-in. Use **Cloud Firestore** for reads/writes. Use **Cloud Storage** to upload the resolution proof photo.

---

## 2. Collections involved

| Collection | Read by employee app? | Written by employee app? |
|---|---|---|
| `WasaEmployees/{docId}` | Yes — to look up own profile by email | No |
| `Complaints/{autoId}` | Yes — only docs where `assignedTo == auth.uid` | Yes — but only the resolution-proof fields, on their own assignments |
| `UnionCouncils/*` | Optional (display UC/MC names) | No |
| `AddressHierarchy/Punjab` | Optional (display geography) | No |

**Do not** create or write to any other collection. Specifically: do not write to `Assignments`, `Counters`, `Public`, `Departments`, `News`, `Campaigns`, `Admins`.

---

## 3. `WasaEmployees` schema

Each employee is a document under `WasaEmployees/`. Documents are created by the admin dashboard, not by the employee app.

```ts
WasaEmployees/{docId}
{
  id: string,                  // mirror of doc id (sometimes empty)
  uid: string,                 // Firebase Auth UID — set by admin OR by the employee app on first login (see §4)
  name: string,
  email: string,               // used for login lookup, lower-cased
  phone: string,
  password: string,            // SHA-256 placeholder (NOT a real password — see §4)
  cnic: string,                // format: XXXXX-XXXXXXX-X
  designation: string,         // free text e.g. "Field Officer"
  department: 'water_supply' | 'sewerage' | 'maintenance' | 'billing' | 'administration',
  specialization: string[],    // e.g. ['no_water', 'sewerage_blockage'] — matches wasaCategory values, see §6
  province: string,            // 'Punjab'
  division: string,
  district: string,
  tehsil: string,              // employee uses 'tehsil' spelling
  ucId: string | null,
  address: string,
  active: boolean,
  currentAssignments: number,  // denormalised; not maintained yet — recompute client-side if needed
  totalResolved: number,       // denormalised; not maintained yet
  lastLogin: Timestamp | null,
  createdAt: Timestamp,
  updatedAt: Timestamp | null,
}
```

### Important caveats

- `uid` **is always populated**. When the admin creates an employee, the dashboard provisions a Firebase Auth user via a secondary Firebase app (so the admin session is not disturbed) and stores the resulting Auth UID directly on the `WasaEmployees` document. The employee app can rely on `WasaEmployees.uid === auth.currentUser.uid` after sign-in.
- `currentAssignments` and `totalResolved` are denormalised counts. Right now no one maintains them. The employee app SHOULD NOT modify them. If you want a real count, derive it client-side from `Complaints` queries.
- `password` on the doc is a SHA-256 hash placeholder kept by the dashboard and is **not** a real authentication credential. Treat it as opaque. Real authentication goes through Firebase Auth (Email/Password).

---

## 4. Authentication Flow

### Sign-in

Use **Firebase Auth Email/Password** with the same email that's stored on `WasaEmployees.email`.

```ts
const cred = await signInWithEmailAndPassword(auth, email, password);
const employeeUid = cred.user.uid;
```

Then look up the employee profile by email:

```ts
const q = query(
  collection(db, 'WasaEmployees'),
  where('email', '==', email.toLowerCase().trim()),
  limit(1),
);
const snap = await getDocs(q);
if (snap.empty) throw new Error('Employee record not found.');
const empDoc = snap.docs[0];
const emp = { id: empDoc.id, ...empDoc.data() };
if (emp.active === false) throw new Error('Your account is inactive.');
```

### Login is straightforward

The dashboard pre-provisions a Firebase Auth user when it creates the employee, so `uid` is never empty by the time an employee tries to sign in. The employee app should:

```ts
const cred = await signInWithEmailAndPassword(auth, email, password);
// cred.user.uid === emp.uid (assert this and bail if mismatched).
await updateDoc(doc(db, 'WasaEmployees', emp.id), {
  lastLogin: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
```

If `emp.uid` ever happens to be missing or different from `auth.currentUser.uid` (legacy data), the safest recovery is to log a warning and refuse to proceed — don't try to repair it from the client.

### Realtime "you've been deactivated" listener (recommended)

Mirror the admin dashboard's pattern: subscribe to your own employee doc and sign out if `active === false`:

```ts
onSnapshot(doc(db, 'WasaEmployees', emp.id), (snap) => {
  if (!snap.exists() || snap.data()?.active === false) {
    signOut(auth);
  }
});
```

---

## 5. `Complaints` schema (employee-relevant subset)

The dashboard's complete schema is in [`COMPLAINTS_SCHEMA.md`](./COMPLAINTS_SCHEMA.md). The employee app only ever touches **manhole / WASA** complaints assigned to the logged-in employee.

```ts
Complaints/{autoId}
{
  // Identity
  id: string,
  complaintId: string,                  // human-readable e.g. "VHR-00001"

  // Complainant
  complainantName: string,
  complainantPhone: string,
  complainantCnic: string,
  complainantAddress: string,
  createdBy: string,                    // citizen Auth UID

  // What & where
  complainType: 'manhole',              // employee app filters on this
  description: string,
  address: string,                      // free-text address of the issue
  complainCoordinates: { lat: number, lng: number },
  division: string,
  district: string,
  tahsil: string,                       // schema spelling — note the difference vs employee.tehsil
  ucMcType: 'UC' | 'MC' | '',
  ucMcNumber: string,
  ucId: string,

  // Routing & sub-category
  departmentType: 'wasa',
  routingStrategy: 'UC_MC_AUTO' | 'DEPT_DASHBOARD',  // immutable
  wasaCategory: 'no_water' | 'sewerage_blockage' | 'manhole_cover' |
                'damaged_pipes' | 'rainwater_blockage' | 'low_pressure' | 'others' | null,

  // Assignment (set by the dashboard)
  assignedTo: string | null,            // Auth UID of the assigned employee
  assignedToName: string | null,        // denormalised
  assignedBy: string | null,            // admin who did the assignment
  assignedByName: string | null,
  assignedAt: Timestamp | null,

  // Status (the only field the employee app changes — see §7)
  complaintStatus: 'action_required' | 'action_taken' | 'irrelevant',
  complaintApproval: string | null,     // reserved — leave alone
  requestType: string | null,           // reserved — leave alone
  reason: string | null,                // populated only when status === 'irrelevant'

  // Resolution proof (the employee writes these — see §7)
  actionTakenAt: Timestamp | null,
  actionImage: string | null,           // Cloud Storage download URL
  actionCoordinates: { lat: number | null, lng: number | null },

  // Media
  complaintImage: string,               // citizen-supplied photo URL

  // Audit
  createdAt: Timestamp,
  updatedAt: Timestamp | null,
}
```

---

## 6. WASA sub-categories (`wasaCategory`)

Stored values → user-facing labels:

| Stored | Label |
|---|---|
| `no_water` | No water / shortage of water |
| `sewerage_blockage` | Sewerage line blockage / overflow |
| `manhole_cover` | Broken / missing manhole covers |
| `damaged_pipes` | Damaged sewage pipes |
| `rainwater_blockage` | Rainwater drainage blockage |
| `low_pressure` | Low pressure |
| `others` | Others |

Use the same string keys when you need a "specialization match" check against `WasaEmployees.specialization`.

---

## 7. Workflow — what the employee app must do

### 7.1 Fetch this employee's pending assignments

```ts
const q = query(
  collection(db, 'Complaints'),
  where('complainType', '==', 'manhole'),
  where('departmentType', '==', 'wasa'),
  where('assignedTo', '==', auth.currentUser.uid),
  where('complaintStatus', '==', 'action_required'),
  orderBy('assignedAt', 'desc'),
  limit(200),
);
const snap = await getDocs(q);
```

> Firestore will require a composite index. The first time you run this query, the console error will print a "create index" link — click it.

### 7.2 Display details

Render the citizen-supplied data. Useful UI fields (read-only):

- `complaintId` — show as the title.
- `wasaCategory` → label via the table in §6.
- `complainantName`, `complainantPhone` (tel: link), `complainantAddress`, `complainantCnic`.
- `address` (issue address), `description`, `complaintImage`.
- `complainCoordinates` → "Open in Maps" link: `https://www.google.com/maps?q=${lat},${lng}`.
- `district`, `tahsil`, `ucMcType`-`ucMcNumber` (when `ucId` is non-empty).
- `assignedAt` — when the admin assigned this to you.

### 7.3 Mark a complaint as `action_taken` (THE PRIMARY EMPLOYEE FLOW)

1. Capture / pick a proof image.
2. Capture the current GPS location.
3. Upload the image to Cloud Storage:
   ```ts
   const path = `complaints/${complaintId}/action/${Date.now()}_${file.name}`;
   const ref = storageRef(storage, path);
   await uploadBytes(ref, file);
   const actionImageUrl = await getDownloadURL(ref);
   ```
4. Update **only** the resolution fields on the Complaint document:
   ```ts
   await updateDoc(doc(db, 'Complaints', complaintId), {
     complaintStatus: 'action_taken',
     actionTakenAt: serverTimestamp(),
     actionImage: actionImageUrl,
     actionCoordinates: { lat: gpsLat, lng: gpsLng },
     updatedAt: serverTimestamp(),
   });
   ```

That's the entire write surface of the employee app. The dashboard re-reads the doc and shows the proof photo + GPS in its read-only resolution panel.

### 7.4 What if the employee can't complete the job?

The employee app should NOT mark a complaint `irrelevant` — that's an admin action. If a complaint can't be done (wrong location, vandalism, can't access), the employee should:

- Add a free-text note via a comment field (out-of-scope for the current schema; you can store a temporary `employeeNote: string` field on the Complaint doc — the dashboard will render it if present, but it won't break if absent).
- Contact the admin via phone — the admin then assigns to someone else (Reassign), unassigns, or marks `irrelevant` with a reason from the dashboard.

---

## 8. Things the employee app MUST NOT do

These mirror the admin dashboard's restrictions (per `COMPLAINTS_SCHEMA.md` §9). Violations will create data drift between the dashboard, the citizen app, and the employee app.

| Action | Why blocked |
|---|---|
| Modify `routingStrategy`, `departmentType`, `complainType`, `wasaCategory`, `complaintId` | Immutable post-submit. |
| Modify `complainant*`, `createdBy` | Belongs to the citizen who filed it. |
| Modify `assignedTo`, `assignedAt`, `assignedBy*`, `assignedToName` | Only admin assigns. If an employee wants out of an assignment they call the admin. |
| Modify `reason` or set `complaintStatus = 'irrelevant'` | "Irrelevant" is an admin-only verdict. |
| Delete a Complaint doc | Use status transitions, never deletion. |
| Write to `Counters/*` | Citizen app's submit flow only. |
| Create an `Assignments` collection | The dashboard does not use one and you shouldn't either. All state lives on the Complaint doc. |
| Write back `currentAssignments` / `totalResolved` on `WasaEmployees` | These are admin-side counters; leave them alone. |

---

## 9. Suggested Firestore Security Rules (snippet)

The admin dashboard does not yet ship rules. When you add them, this is roughly the right shape for the employee app's permissions on `Complaints`:

```js
match /Complaints/{id} {
  allow read: if isCitizenAuthor() || isAssignedEmployee() || isAdmin();
  allow update: if (
    // Admin: full control (handled elsewhere)
    isAdmin()
  ) || (
    // Employee: ONLY when this is *their* assignment AND they only touched proof fields
    isAssignedEmployee()
    && request.auth.uid == resource.data.assignedTo
    && onlyChangedFields(['complaintStatus', 'actionTakenAt', 'actionImage', 'actionCoordinates', 'updatedAt'])
    && request.resource.data.complaintStatus == 'action_taken'
  );
  allow delete: if false;
}
```

`isAssignedEmployee()` should check that a `WasaEmployees` doc with `uid == request.auth.uid && active == true` exists.

---

## 10. End-to-end checklist

- [ ] Sign in via Firebase Auth Email/Password.
- [ ] Look up `WasaEmployees` doc by lowercased email; refuse if `active === false`.
- [ ] On first login, set `uid` on the doc; create the Auth user if it didn't exist.
- [ ] Patch `lastLogin: serverTimestamp()` on every login.
- [ ] Subscribe to own `WasaEmployees/{id}` doc and sign out on `active === false`.
- [ ] List complaints with `assignedTo == uid && complainType == 'manhole' && departmentType == 'wasa' && complaintStatus == 'action_required'` ordered by `assignedAt desc`.
- [ ] Detail screen shows complainant, location, citizen photo, "Open in Maps".
- [ ] "Mark as Done" flow: capture photo → upload to `complaints/{complaintId}/action/...` → capture GPS → `updateDoc` with the 5 resolution fields above.
- [ ] Don't write any other fields. Don't create any other collection.
