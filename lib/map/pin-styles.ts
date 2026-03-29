import { Brand } from '@/constants/brand';

const S = Brand.stitch;

/** Align with harvest-areas list normalization */
export function normalizeHarvestStatus(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).toLowerCase().trim();
  }
  return String(raw).toLowerCase().trim();
}

/** Align with weighing-stations list */
export function normalizeStationStatus(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).toLowerCase().trim();
  }
  return String(raw).toLowerCase().trim();
}

/** Pin ring / icon color by harvest area status — mirrors cardUiForStatus accents */
export function harvestAreaPinColor(status: string): string {
  switch (status) {
    case 'active':
      return '#006d42';
    case 'preparing':
      return `${S.outlineVariant}`;
    case 'paused':
    case 'awaiting_renewal':
      return S.tertiary;
    case 'completed':
      return S.outlineVariant;
    case 'inactive':
      return S.surfaceDim;
    default:
      return S.surfaceDim;
  }
}

/** Pin color by weighing station status — mirrors stationAccent */
export function weighingStationPinColor(status: string): string {
  if (status.includes('active') || status === '1') return S.primary;
  if (status.includes('inactive') || status.includes('disabled')) return S.outlineVariant;
  if (status) return S.primaryContainer;
  return S.primary;
}
