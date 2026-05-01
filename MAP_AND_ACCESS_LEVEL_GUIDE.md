# Map with Boundaries + Access Level — Integration Guide

> Hand this file (and the listed files) to the other dashboard's Claude. It contains the complete recipe to add zoom-aware boundary maps + 4-tier geographic access control (Province → Division → District → Tehsil).

---

## 1. Files to Copy from WeWatch

Copy these files **as-is** into the target project (preserve folder structure):

### 1.1 Geographic + Boundary Data
| File | Path | Purpose |
|------|------|---------|
| `index.js` | `src/constants/index.js` | Hierarchy + boundary coordinate arrays + boundary styles + helpers |
| `district_boundaries.json` | `src/constants/district_boundaries.json` | Raw district polygons (optional reference) |
| `all_tehsil_boundaries.json` | `src/constants/all_tehsil_boundaries.json` | Raw tehsil polygons (optional reference) |
| `vehari_tehsils.geojson` | `src/constants/vehari_tehsils.geojson` | GeoJSON source (optional reference) |
| `vehari_tehsils_all.json` | `src/constants/vehari_tehsils_all.json` | Reference data |

> The runtime ONLY needs `src/constants/index.js`. The raw JSON/GeoJSON files are kept as historical sources — copy them if you may need to regenerate boundaries.

### 1.2 Access Control + Filters
| File | Path | Purpose |
|------|------|---------|
| `AuthContext.js` | `src/context/AuthContext.js` | Admin state + `adminScope` memo |
| `FilterContext.js` | `src/context/FilterContext.js` | Scope-aware shared filters |
| `NotificationContext.js` | `src/context/NotificationContext.js` | Realtime notifications filtered by scope |
| `adminAccess.js` | `src/config/adminAccess.js` | Super-admin email whitelist |
| `firebase.js` | `src/config/firebase.js` | Firebase config (replace credentials) |
| `ProtectedRoute.js` | `src/components/ProtectedRoute.js` | Route guard for authenticated routes |
| `Login.js` | `src/components/Login.js` | Login page (verifies against `Admins` collection) |
| `AdminManagement.js` | `src/components/AdminManagement.js` | CRUD for admins with scope assignment |
| `Filters.js` | `src/components/Filters.js` | Reusable scope-aware filter UI |

### 1.3 Map
| File | Path | Purpose |
|------|------|---------|
| `LiveMap.js` | `src/components/LiveMap.js` | Reference implementation. Adapt the `ZoomAwareBoundaries` component + structure into the target's map page. |

### 1.4 Required NPM Packages
Add to `package.json`:
```json
{
  "leaflet": "^1.9.4",
  "leaflet.heat": "^0.2.0",
  "react-leaflet": "^4.2.1",
  "firebase": "^12.7.0",
  "lucide-react": "^0.562.0"
}
```

And in `public/index.html` `<head>`:
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

---

## 2. What's in `constants/index.js` (Read This First)

The file exports the full hierarchy and all boundary polygons:

```js
// Hierarchy
export const PROVINCES = [...];
export const PROVINCE_DIVISIONS = { Punjab: [...], Sindh: [...], ... };
export const DIVISION_DISTRICTS = { Multan: ['Vehari', 'Multan', 'Khanewal', 'Lodhran'], ... };
export const DISTRICT_TEHSILS  = { Vehari: ['Vehari', 'Mailsi', 'Burewala'], ... };

// Helpers
export const getDivisionsForProvince = (province) => PROVINCE_DIVISIONS[province] || [];
export const getDistrictsForDivision = (division) => DIVISION_DISTRICTS[division] || [];
export const getTehsilsForDistrict  = (district)  => DISTRICT_TEHSILS[district]  || [];

// Access levels
export const ACCESS_LEVELS = { PROVINCE: 'province', DIVISION: 'division', DISTRICT: 'district', TEHSIL: 'tehsil' };

// Map config
export const DISTRICT_MAP_CONFIG = { Vehari: { center: [30.04, 72.34], zoom: 9.3 }, ... };
export const DIVISION_MAP_CONFIG = { center: [30.0, 71.9], zoom: 8 };

// Boundary polygons (each is an array of [lat, lng] pairs)
export const VEHARI_DISTRICT_BOUNDARY = [[lat, lng], ...];
export const MULTAN_DISTRICT_BOUNDARY = [...];
// ... + KHANEWAL, LODHRAN

// District polygon registry
export const DISTRICT_BOUNDARIES = {
  Vehari:   VEHARI_DISTRICT_BOUNDARY,
  Multan:   MULTAN_DISTRICT_BOUNDARY,
  Khanewal: KHANEWAL_DISTRICT_BOUNDARY,
  Lodhran:  LODHRAN_DISTRICT_BOUNDARY,
};

// Pastel style per district (color, weight, fillColor, fillOpacity)
export const DISTRICT_BOUNDARY_STYLES = { Vehari: {...}, Multan: {...}, ... };

// Tehsil boundaries grouped by district
export const TEHSIL_BOUNDARIES_BY_DISTRICT = {
  Vehari: { Vehari: VEHARI_TEHSIL_BOUNDARY, Burewala: ..., Mailsi: ... },
  Multan: { 'Multan City': ..., 'Multan Saddar': ..., Shujabad: ..., 'Jalalpur Pirwala': ... },
  Khanewal: { ... },
  Lodhran: { ... },
};

// Flat lookup
export const TEHSIL_BOUNDARIES = Object.values(TEHSIL_BOUNDARIES_BY_DISTRICT)
  .reduce((acc, group) => ({ ...acc, ...group }), {});

// Per-tehsil styles
export const TEHSIL_BOUNDARY_STYLES = { Vehari: {...}, Burewala: {...}, ... };
```

If your target dashboard covers **different districts/tehsils**, you must replace these polygon arrays with your own. See §7 for how to generate them.

---

## 3. AuthContext + adminScope (The Heart of Access Control)

`adminScope` is a memoized object derived from the logged-in admin doc. Every component reads it via `useAuth()` to enforce permissions.

```js
const adminScope = useMemo(() => {
  const isFullAccess = ADMIN_MANAGEMENT_EMAILS.some(
    e => e.toLowerCase() === admin?.email?.toLowerCase()
  );

  if (isFullAccess) {
    return { accessLevel: 'province', province: 'Punjab', division: null, district: null, tehsil: null };
  }
  return {
    accessLevel: admin?.accessLevel || 'division',
    province:    admin?.province || 'Punjab',
    division:    admin?.division || 'Multan',
    district:    admin?.district || null,
    tehsil:      admin?.tehsil   || null,
  };
}, [admin]);
```

**Admin Firestore doc shape:**
```js
{
  id, name, email, password, phone,
  accessLevel: 'province' | 'division' | 'district' | 'tehsil',
  province, division, district, tehsil,
  status: 'active' | 'inactive',
  createdAt, lastLogin
}
```

---

## 4. The 4-Tier Access Rule (Apply Everywhere)

| Access Level | Sees | Filter Locks |
|--------------|------|--------------|
| Province | Everything | None |
| Division | Only districts in `getDistrictsForDivision(adminScope.division)` | Division locked |
| District | Only their `adminScope.district` | District + Division locked |
| Tehsil   | Only their `adminScope.tehsil`   | Tehsil + District + Division locked |

### 4.1 The `scopeDistricts` Pattern (Copy Into Every Page)

```js
import { DISTRICTS, getDistrictsForDivision } from '../constants';
import { useAuth } from '../context/AuthContext';

const { adminScope } = useAuth();
const isDistrictLocked = adminScope?.accessLevel === 'district' || adminScope?.accessLevel === 'tehsil';
const isTehsilLocked   = adminScope?.accessLevel === 'tehsil';

const scopeDistricts = useMemo(() => {
  if (!adminScope) return DISTRICTS;
  if (adminScope.accessLevel === 'tehsil'   && adminScope.district) return [adminScope.district];
  if (adminScope.accessLevel === 'district' && adminScope.district) return [adminScope.district];
  if (adminScope.accessLevel === 'division' && adminScope.division) return getDistrictsForDivision(adminScope.division);
  return DISTRICTS; // province
}, [adminScope]);
```

### 4.2 Always Use `scopeDistricts` in Dropdowns
```jsx
// WRONG — lets a Lodhran admin see Vehari in the dropdown
{DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}

// CORRECT
{scopeDistricts.map(d => <option key={d} value={d}>{d}</option>)}
```

### 4.3 Stats Must Use Scope-Filtered Data
```js
// WRONG — stats show 18 users from all districts
const stats = { total: users.length, ... };

// CORRECT — stats reflect admin's scope
const scopedUsers = useMemo(
  () => scopeDistricts.length === DISTRICTS.length ? users : users.filter(u => scopeDistricts.includes(u.district)),
  [users, scopeDistricts]
);
const stats = { total: scopedUsers.length, ... };
```

### 4.4 Data-Filter useMemo Must Enforce Scope BEFORE User Filters
```js
const filteredItems = useMemo(() => {
  return items.filter(item => {
    // 1. Scope enforcement first
    const matchesScope = scopeDistricts.length === DISTRICTS.length || scopeDistricts.includes(item.district);
    if (!matchesScope) return false;

    // 2. Then user-applied filters
    return matchesUserFilters(item);
  });
}, [items, scopeDistricts, ...]);
```

---

## 5. FilterContext (Shared Scope-Aware Filters)

The shared filter context exposes scope-aware values. Critical sections:

```js
// Available districts respect scope
const availableDistricts = useMemo(() => {
  if (!adminScope) return DISTRICTS;
  if (adminScope.accessLevel === 'division' && adminScope.division) return getDistrictsForDivision(adminScope.division);
  if (adminScope.accessLevel === 'district' && adminScope.district) return [adminScope.district];
  if (adminScope.accessLevel === 'tehsil'   && adminScope.district) return [adminScope.district];
  return DISTRICTS;
}, [adminScope]);

// Available tehsils respect scope + selected district
const availableTahsils = useMemo(() => {
  if (!adminScope) return [];
  if (adminScope.accessLevel === 'tehsil' && adminScope.tehsil) return [adminScope.tehsil];
  if (adminScope.accessLevel === 'district' && adminScope.district) return getTehsilsForDistrict(adminScope.district);
  if (selectedDistrict) return getTehsilsForDistrict(selectedDistrict);
  if (adminScope.accessLevel === 'division' && adminScope.division) {
    return getDistrictsForDivision(adminScope.division).flatMap(d => getTehsilsForDistrict(d));
  }
  return Object.values(DISTRICT_TEHSILS).flat();
}, [adminScope, selectedDistrict]);

// Lock flags
const isDistrictLocked = adminScope?.accessLevel === 'district' || adminScope?.accessLevel === 'tehsil';
const isTehsilLocked   = adminScope?.accessLevel === 'tehsil';

// Auto-set locked filter values on login
useEffect(() => {
  if (!adminScope) return;
  if (adminScope.accessLevel === 'district' && adminScope.district) setSelectedDistrict(adminScope.district);
  if (adminScope.accessLevel === 'tehsil') {
    setSelectedDistrict(adminScope.district);
    setSelectedTahsil(adminScope.tehsil);
  }
}, [adminScope]);
```

---

## 6. Map with Zoom-Aware Boundaries

### 6.1 The `ZoomAwareBoundaries` Component
This is the single component that draws district + tehsil polygons, filtered by `adminScope` and zoom level:

```jsx
import { MapContainer, TileLayer, Polygon, useMap, useMapEvents } from 'react-leaflet';
import {
  DISTRICT_BOUNDARIES, DISTRICT_BOUNDARY_STYLES,
  TEHSIL_BOUNDARIES, TEHSIL_BOUNDARIES_BY_DISTRICT, TEHSIL_BOUNDARY_STYLES,
  DIVISION_DISTRICTS,
} from '../constants';

const ZOOM_THRESHOLDS = { TEHSIL_SWITCH: 9 };

const ZoomAwareBoundaries = ({ showBoundary, adminScope }) => {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setCurrentZoom(map.getZoom()) });

  if (!showBoundary || !adminScope) return null;
  const { accessLevel, division, district, tehsil: lockedTehsil } = adminScope;

  // Decide layer visibility per access level + zoom
  const showDistricts = accessLevel === 'province'
    ? currentZoom < ZOOM_THRESHOLDS.TEHSIL_SWITCH
    : true; // local admins always see their domain

  const showTehsils = accessLevel === 'province'
    ? currentZoom >= ZOOM_THRESHOLDS.TEHSIL_SWITCH
    : currentZoom >= 8;

  // Filter districts by scope
  const filteredDistricts = Object.entries(DISTRICT_BOUNDARIES).filter(([name]) => {
    if (accessLevel === 'province') return true;
    if (accessLevel === 'division') return (DIVISION_DISTRICTS[division] || []).includes(name);
    if (accessLevel === 'district' || accessLevel === 'tehsil') return name === district;
    return false;
  });

  // Filter tehsil groups by scope
  const filteredTehsilGroups = Object.entries(TEHSIL_BOUNDARIES_BY_DISTRICT).filter(([distName]) => {
    if (accessLevel === 'province') return true;
    if (accessLevel === 'division') return (DIVISION_DISTRICTS[division] || []).includes(distName);
    if (accessLevel === 'district') return distName === district;
    if (accessLevel === 'tehsil')   return true; // filtered per-tehsil below
    return false;
  });

  return (
    <>
      {showDistricts && filteredDistricts.map(([name, boundary]) => (
        <Polygon key={`district-${name}`} positions={boundary}
          pathOptions={{ ...DISTRICT_BOUNDARY_STYLES[name], fillOpacity: showTehsils ? 0.05 : 0.12 }} />
      ))}

      {showTehsils && filteredTehsilGroups.map(([distName, tehsils]) =>
        Object.entries(tehsils).map(([tehName, boundary]) => {
          if (accessLevel === 'tehsil' && tehName !== lockedTehsil) return null;
          return <Polygon key={`tehsil-${tehName}`} positions={boundary} pathOptions={TEHSIL_BOUNDARY_STYLES[tehName]} />;
        })
      )}

      {/* Dashed district outline at deep zoom keeps geographic context */}
      {currentZoom >= 12 && filteredDistricts.map(([name, boundary]) => (
        <Polygon key={`district-outline-${name}`} positions={boundary}
          pathOptions={{
            color: DISTRICT_BOUNDARY_STYLES[name]?.color || '#64748b',
            weight: 1.5, opacity: 0.3, fillColor: 'transparent', fillOpacity: 0, dashArray: '8, 6',
          }} />
      ))}

      {/* Tehsil admin zoomed way out — still see their tehsil */}
      {currentZoom < 8 && accessLevel === 'tehsil' && lockedTehsil && TEHSIL_BOUNDARIES[lockedTehsil] && (
        <Polygon positions={TEHSIL_BOUNDARIES[lockedTehsil]} pathOptions={TEHSIL_BOUNDARY_STYLES[lockedTehsil]} />
      )}
    </>
  );
};
```

### 6.2 Map Initial Center + Zoom Logic
Pick the map's initial center based on the admin's scope:

```js
const initialMapView = useMemo(() => {
  if (adminScope?.accessLevel === 'tehsil' || adminScope?.accessLevel === 'district') {
    return DISTRICT_MAP_CONFIG[adminScope.district] || DIVISION_MAP_CONFIG;
  }
  if (adminScope?.accessLevel === 'division') return DIVISION_MAP_CONFIG;
  return { center: [30.0, 71.9], zoom: 7 }; // province
}, [adminScope]);
```

### 6.3 Wire Into MapContainer
```jsx
<MapContainer center={initialMapView.center} zoom={initialMapView.zoom} style={{ height: '100%', width: '100%' }}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
  <ZoomAwareBoundaries showBoundary={showBoundary} adminScope={adminScope} />
  {/* your markers / heatmaps go here */}
</MapContainer>
```

---

## 7. Adding YOUR OWN Boundary Data

If your dashboard covers different geography, replace the polygon arrays in `constants/index.js`. Two options:

### Option A — From a GeoJSON file
1. Get your boundary GeoJSON (e.g. from OpenStreetMap, Natural Earth, government GIS portal).
2. For each feature, extract the polygon coordinates and **swap** lng/lat to lat/lng (Leaflet wants `[lat, lng]`):
   ```js
   const positions = feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
   ```
3. Export as a named array.

### Option B — From a JSON config like the one in this repo
The shape of `district_boundaries.json` and `all_tehsil_boundaries.json` is:
```json
{ "Vehari": [[30.04, 72.34], [30.05, 72.40], ...], ... }
```
You can either import this JSON directly:
```js
import districtBoundaries from './district_boundaries.json';
export const DISTRICT_BOUNDARIES = districtBoundaries;
```
or hand-code the polygons inside `index.js` like the WeWatch reference.

### Style Object Shape
```js
{ color: '#3B82F6', weight: 2, fillColor: '#3B82F6', fillOpacity: 0.12, dashArray: '' }
```

---

## 8. Integration Checklist

Hand this checklist to the target dashboard's Claude:

- [ ] Add npm packages: `leaflet`, `leaflet.heat`, `react-leaflet`, `firebase`, `lucide-react`
- [ ] Add Leaflet CSS to `public/index.html`
- [ ] Copy `src/constants/index.js` (replace polygons with your geography if different)
- [ ] Copy `src/config/firebase.js` (update credentials) and `src/config/adminAccess.js`
- [ ] Copy `src/context/AuthContext.js`, `FilterContext.js`, `NotificationContext.js`
- [ ] Copy `src/components/ProtectedRoute.js`, `Login.js`, `Filters.js`, `AdminManagement.js`
- [ ] Wrap app: `<AuthProvider><FilterProvider><NotificationProvider>...`
- [ ] Create `Admins` Firestore collection with at least one super-admin doc
- [ ] Add the super-admin email to `ADMIN_MANAGEMENT_EMAILS` in `adminAccess.js`
- [ ] On every page that displays/filters data, apply the §4.1 `scopeDistricts` pattern
- [ ] On every dropdown rendering districts, replace `DISTRICTS.map` with `scopeDistricts.map`
- [ ] On every stats card, compute from scope-filtered data, not raw data
- [ ] On every data hook, enforce server-side district `where()` clauses where possible
- [ ] Add the `ZoomAwareBoundaries` component into your map page
- [ ] Pick map initial center + zoom from `adminScope` per §6.2
- [ ] In `NotificationContext`, filter notifications by `adminScope` (see WeWatch's NotificationContext for the exact filter block)
- [ ] Test all 4 access levels with separate admin accounts:
  - Province admin → sees all 4 districts
  - Division admin → sees only their division's districts (e.g. Multan division → 4 districts)
  - District admin → sees only their district, district dropdown locked
  - Tehsil admin → sees only their tehsil, both dropdowns locked

---

## 9. Common Pitfalls (Things to Watch For)

1. **Using `DISTRICTS.map` instead of `scopeDistricts.map`** in dropdowns — leaks other districts into the UI.
2. **Computing stats from raw `users.length`** instead of scope-filtered list — stats show wrong totals.
3. **`filterDistrict` declared without a setter** (`const [filterDistrict] = useState(...)`) — division admins can't change district because there's no setter, and the default is `null`, so no filter applied → they see ALL data.
4. **Notification filter passing through when `data.district` is missing** — use strict equality (`reportDistrict !== scope.district`) instead of `data.district && data.district !== scope.district`.
5. **`onSnapshot` listeners that never close** — only the notification center should use realtime. Everything else uses `getDocs`.
6. **Map default center hardcoded to one district** — center based on `adminScope` so each admin lands on their own region.
7. **Boundary polygons in `[lng, lat]` order** — Leaflet wants `[lat, lng]`. If polygons render in the wrong place, swap the order.
8. **Forgetting to lock tehsil dropdown** for tehsil admins. Both `disabled={isTehsilLocked}` AND the change handler should early-return.
9. **`super_admin` accessLevel string** doesn't exist — only the four levels: province / division / district / tehsil. Super-admin power comes from the email whitelist in `adminAccess.js`, which short-circuits to `accessLevel: 'province'`.
10. **`adminScope.district` is `null` for division-level admins** — never assume `district` is truthy; always check `accessLevel` first.

---

## 10. Quick Test Script

Create test admins in your `Admins` collection to verify each level:

```js
// 1. Province (super-admin)
{ email: 'super@example.com', accessLevel: 'province', province: 'Punjab', division: null, district: null, tehsil: null, status: 'active' }

// 2. Division (e.g. Multan division)
{ email: 'multan_division@example.com', accessLevel: 'division', province: 'Punjab', division: 'Multan', district: null, tehsil: null, status: 'active' }

// 3. District (e.g. Lodhran)
{ email: 'lodhran@example.com', accessLevel: 'district', province: 'Punjab', division: 'Multan', district: 'Lodhran', tehsil: null, status: 'active' }

// 4. Tehsil (e.g. Dunyapur in Lodhran)
{ email: 'dunyapur@example.com', accessLevel: 'tehsil', province: 'Punjab', division: 'Multan', district: 'Lodhran', tehsil: 'Dunyapur', status: 'active' }
```

Log in as each one and confirm:
- Sidebar shows correct sections
- District dropdown shows correct options (or is locked)
- Map zooms/pans to correct region by default
- Map boundaries highlight only the admin's domain
- Stats reflect only the admin's data
- Notifications only fire for events in the admin's domain
