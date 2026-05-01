# WeWatch Reference Files

These are **reference implementations** copied from the WeWatch dashboard (CRA + JavaScript).
This WASA project is **Next.js + TypeScript**, so do NOT import these files directly.

Use them as a reference to port logic into the existing TypeScript files in `src/context/`, `src/constants/`, etc.

## What's here

```
_wewatch_reference/
├── constants/
│   ├── index.js                       → port to src/constants/geography.ts (boundaries + helpers)
│   ├── district_boundaries.json
│   ├── all_tehsil_boundaries.json
│   ├── vehari_tehsils.geojson
│   └── vehari_tehsils_all.json
├── context/
│   ├── AuthContext.js                 → reference for src/context/AuthContext.tsx
│   ├── FilterContext.js               → reference for src/context/FilterContext.tsx
│   └── NotificationContext.js         → reference for src/context/NotificationContext.tsx
├── config/
│   ├── adminAccess.js                 → port to src/lib/adminAccess.ts
│   └── firebase.js                    → port to src/lib/firebase.ts (replace credentials)
└── components/
    ├── ProtectedRoute.js              → adapt for Next.js middleware or a wrapper
    ├── Login.js                       → reference for src/app/login/page.tsx
    ├── Filters.js                     → reference for src/components/filters/
    ├── AdminManagement.js             → reference for admin management page
    └── LiveMap.js                     → reference for src/components/map/ (the ZoomAwareBoundaries part is the key)
```

## How to use

1. Read `MAP_AND_ACCESS_LEVEL_GUIDE.md` at project root.
2. Open the relevant reference file alongside your TypeScript file.
3. Port the logic — convert syntax to TypeScript, adapt imports for Next.js.
4. Once a feature is fully ported, you can delete the corresponding reference file (or keep the whole folder for documentation).

## Key things to port

- **`adminScope` memo** in `AuthContext.js` → drives all access control
- **`scopeDistricts` pattern** appears in every WeWatch component that displays data
- **`availableDistricts` / `availableTahsils`** in `FilterContext.js` → respect division-level scope
- **`ZoomAwareBoundaries` component** inside `LiveMap.js` → renders polygons filtered by scope + zoom
- **Notification scope filter** in `NotificationContext.js` → blocks out-of-scope notifications

## DO NOT

- Import from `_wewatch_reference/` in your app code
- Keep the `.js` files once their logic is ported (delete to avoid confusion)
- Assume the boundary polygons here are right for WASA — they cover Vehari/Multan/Khanewal/Lodhran. Replace with your geography.
