// Backward-compat shim. Real source: '@/constants/wasaCategories'.
// All call sites should migrate; this file will be removed.
export { WASA_CATEGORIES as SEED_COMPLAINT_TYPES } from './wasaCategories';
export { WASA_CATEGORY_BY_VALUE as COMPLAINT_TYPE_FALLBACK } from './wasaCategories';
