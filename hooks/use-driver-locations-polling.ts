import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

import {
  fetchOwnerDriversLocationsLatest,
  type OwnerDriverLatestLocation,
} from '@/lib/api/owner-driver-locations';

export type DriverLocationEntry = OwnerDriverLatestLocation & {
  latitude: number;
  longitude: number;
};

function hasValidCoords(loc: OwnerDriverLatestLocation): loc is DriverLocationEntry {
  return (
    loc.latitude != null &&
    loc.longitude != null &&
    Number.isFinite(loc.latitude) &&
    Number.isFinite(loc.longitude)
  );
}

/**
 * Polls GET /owner/drivers/locations/latest while the screen is focused.
 * Pauses automatically on blur, resumes on re-focus.
 */
export function useDriverLocationsPolling(intervalMs = 5_000) {
  const [locations, setLocations] = useState<DriverLocationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetchOwnerDriversLocationsLatest({ page: 1, limit: 200 });
      if (!mountedRef.current) return;
      setLocations(res.data.filter(hasValidCoords));
      setError(null);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      const msg =
        e instanceof Error ? e.message : typeof e === 'string' ? e : 'Lỗi tải vị trí tài xế';
      setError(msg);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current != null) return;
    void fetchOnce();
    intervalRef.current = setInterval(() => void fetchOnce(), intervalMs);
  }, [fetchOnce, intervalMs]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      setLoading(true);
      startPolling();
      return () => {
        mountedRef.current = false;
        stopPolling();
      };
    }, [startPolling, stopPolling]),
  );

  const refresh = useCallback(() => {
    setLoading(true);
    void fetchOnce();
  }, [fetchOnce]);

  return { locations, loading, error, refresh } as const;
}
