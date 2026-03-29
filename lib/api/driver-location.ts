import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiFetch } from '@/lib/api/client';
import { DRIVER_LOCATION_QUEUE_KEY } from '@/lib/tracking/storage-keys';

const MAX_QUEUE = 50;

export type DriverLocationPayload = {
  tripId: string | number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  recordedAt: string;
};

type QueuedPayload = DriverLocationPayload;

async function readQueue(): Promise<QueuedPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(DRIVER_LOCATION_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueuedPayload[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedPayload[]): Promise<void> {
  const trimmed = items.slice(-MAX_QUEUE);
  await AsyncStorage.setItem(DRIVER_LOCATION_QUEUE_KEY, JSON.stringify(trimmed));
}

async function enqueue(payload: QueuedPayload): Promise<void> {
  const q = await readQueue();
  q.push(payload);
  await writeQueue(q);
}

function bodyFromPayload(p: DriverLocationPayload): Record<string, unknown> {
  return {
    latitude: p.latitude,
    longitude: p.longitude,
    accuracy: p.accuracy,
    altitude: p.altitude,
    heading: p.heading,
    speed: p.speed,
    recordedAt: p.recordedAt,
  };
}

/**
 * POST placeholder until BE defines contract. 404/501 treated as no-op (no queue).
 * Network / 5xx → enqueue for later flush.
 */
export async function postDriverLocationSample(payload: DriverLocationPayload): Promise<void> {
  const path = `/trips/${encodeURIComponent(String(payload.tripId))}/locations`;

  try {
    const res = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyFromPayload(payload)),
    });

    if (res.ok) {
      return;
    }

    if (res.status === 404 || res.status === 501) {
      if (__DEV__) {
        console.warn('[driver-location] endpoint not available', res.status, path);
      }
      return;
    }

    await enqueue(payload);
  } catch {
    await enqueue(payload);
  }
}

export async function flushLocationQueue(): Promise<void> {
  let q = await readQueue();
  if (q.length === 0) return;

  const remaining: QueuedPayload[] = [];

  for (const item of q) {
    const path = `/trips/${encodeURIComponent(String(item.tripId))}/locations`;
    try {
      const res = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyFromPayload(item)),
      });
      if (!res.ok && res.status !== 404 && res.status !== 501) {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  await writeQueue(remaining);
}
