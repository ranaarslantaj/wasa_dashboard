export const WASA_CATEGORIES = [
  { value: 'no_water',           label: 'No water / shortage of water',     color: '#3B82F6', icon: 'Droplets' },
  { value: 'sewerage_blockage',  label: 'Sewerage line blockage / overflow', color: '#A16207', icon: 'Waves' },
  { value: 'manhole_cover',      label: 'Broken / missing manhole covers',   color: '#EF4444', icon: 'AlertTriangle' },
  { value: 'damaged_pipes',      label: 'Damaged sewage pipes',              color: '#DC2626', icon: 'Wrench' },
  { value: 'rainwater_blockage', label: 'Rainwater drainage blockage',       color: '#F59E0B', icon: 'CloudRain' },
  { value: 'low_pressure',       label: 'Low pressure',                      color: '#6B7280', icon: 'Gauge' },
  { value: 'others',             label: 'Others',                            color: '#475569', icon: 'CircleHelp' },
] as const;

export type WasaCategoryValue = typeof WASA_CATEGORIES[number]['value'];

export const WASA_CATEGORY_BY_VALUE: Record<WasaCategoryValue, typeof WASA_CATEGORIES[number]> = WASA_CATEGORIES.reduce(
  (acc, cat) => { (acc as any)[cat.value] = cat; return acc; },
  {} as Record<WasaCategoryValue, typeof WASA_CATEGORIES[number]>,
);

export const wasaCategoryLabel = (v: string | null | undefined): string => {
  if (!v) return 'Unknown';
  return WASA_CATEGORY_BY_VALUE[v as WasaCategoryValue]?.label ?? v;
};

export const wasaCategoryColor = (v: string | null | undefined): string => {
  if (!v) return '#94A3B8';
  return WASA_CATEGORY_BY_VALUE[v as WasaCategoryValue]?.color ?? '#94A3B8';
};
