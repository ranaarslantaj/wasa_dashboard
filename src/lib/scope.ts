import type { AdminScope } from '@/types';
import {
  getDivisionsForProvince,
  getDistrictsForDivision,
  getTehsilsForDistrict,
  getAllDistrictsForProvince,
} from '@/constants/geography';

/** Returns the full set of districts this admin is allowed to see. Empty = unrestricted (province level). */
export const getScopeDistricts = (scope: AdminScope | null): string[] => {
  if (!scope) return [];
  if (scope.fullAccess) return []; // unrestricted
  switch (scope.accessLevel) {
    case 'province':
      return getAllDistrictsForProvince(scope.province);
    case 'division':
      return scope.division ? getDistrictsForDivision(scope.division) : [];
    case 'district':
      return scope.district ? [scope.district] : [];
    case 'tehsil':
      return scope.district ? [scope.district] : [];
    default:
      return [];
  }
};

/**
 * Returns the set of tehsils the admin can see.
 * - tehsil-level: only their tehsil
 * - district-level: all tehsils in their district
 * - division-level: all tehsils across their division's districts
 * - province-level: [] (unrestricted within province)
 */
export const getScopeTehsils = (scope: AdminScope | null): string[] => {
  if (!scope || scope.fullAccess) return [];
  if (scope.accessLevel === 'tehsil' && scope.tehsil) return [scope.tehsil];
  if (scope.accessLevel === 'district' && scope.district) return getTehsilsForDistrict(scope.district);
  if (scope.accessLevel === 'division' && scope.division) {
    return getDistrictsForDivision(scope.division).flatMap((d) => getTehsilsForDistrict(d));
  }
  return [];
};

/** Division dropdowns: province-level admin gets all divisions for their province; everyone else gets [their division] locked. */
export const getScopeDivisions = (scope: AdminScope | null): string[] => {
  if (!scope || scope.fullAccess) return [];
  if (scope.accessLevel === 'province') return getDivisionsForProvince(scope.province);
  return scope.division ? [scope.division] : [];
};

/** True if the admin should see the doc (defense in depth after server-side where()). */
export const isInScope = (
  scope: AdminScope | null,
  doc: { district?: string | null; tehsil?: string | null; division?: string | null },
): boolean => {
  if (!scope || scope.fullAccess || scope.accessLevel === 'province') return true;
  const docDistrict = doc.district ?? '';
  const docTehsil = doc.tehsil ?? '';
  if (scope.accessLevel === 'division') {
    return getDistrictsForDivision(scope.division ?? '').includes(docDistrict);
  }
  if (scope.accessLevel === 'district') return docDistrict === scope.district;
  if (scope.accessLevel === 'tehsil') return docDistrict === scope.district && docTehsil === scope.tehsil;
  return false;
};

/** Filter an array of docs by the admin's scope (defense in depth). */
export const filterByScope = <T extends { district?: string | null; tehsil?: string | null }>(
  docs: T[],
  scope: AdminScope | null,
): T[] => docs.filter((d) => isInScope(scope, d));

/** Whether the district dropdown should be locked (non-province admins). */
export const isDistrictLocked = (scope: AdminScope | null): boolean =>
  !!scope && !scope.fullAccess && (scope.accessLevel === 'district' || scope.accessLevel === 'tehsil');

/** Whether the tehsil dropdown should be locked. */
export const isTehsilLocked = (scope: AdminScope | null): boolean =>
  !!scope && !scope.fullAccess && scope.accessLevel === 'tehsil';

/** Whether the division dropdown should be locked. */
export const isDivisionLocked = (scope: AdminScope | null): boolean =>
  !!scope && !scope.fullAccess && scope.accessLevel !== 'province';
