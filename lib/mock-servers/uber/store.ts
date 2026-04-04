import { getRedis } from "@/lib/redis"
import type { StoredTrip } from "./types"

// ---------------------------------------------------------------------------
// Redis / in-memory key-value store for mock Uber server state
// ---------------------------------------------------------------------------

// In-memory fallback for local dev without Redis
const memory = new Map<string, { value: string; expiresAt?: number }>()
const memoryTripHistory: string[] = []

function isExpired(entry: { expiresAt?: number }): boolean {
  return entry.expiresAt != null && Date.now() > entry.expiresAt
}

// ---------------------------------------------------------------------------
// Fare storage (2-minute TTL like real Uber)
// ---------------------------------------------------------------------------

const FARE_TTL_SEC = 120

export async function storeFare(fareId: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.set(`uber:fare:${fareId}`, "1", { ex: FARE_TTL_SEC })
  } else {
    memory.set(`fare:${fareId}`, {
      value: "1",
      expiresAt: Date.now() + FARE_TTL_SEC * 1000,
    })
  }
}

export async function checkFare(fareId: string): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    const exists = await redis.exists(`uber:fare:${fareId}`)
    return exists === 1
  }
  const entry = memory.get(`fare:${fareId}`)
  if (!entry || isExpired(entry)) {
    memory.delete(`fare:${fareId}`)
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Trip storage (1-hour TTL)
// ---------------------------------------------------------------------------

const TRIP_TTL_SEC = 3600
const HISTORY_KEY = "uber:trip-history"

export async function storeTrip(trip: StoredTrip): Promise<void> {
  const redis = getRedis()
  const json = JSON.stringify(trip)
  if (redis) {
    await redis.set(`uber:trip:${trip.request_id}`, json, {
      ex: TRIP_TTL_SEC,
    })
    await redis.rpush(HISTORY_KEY, trip.request_id)
    // Set TTL on history list if it's new
    await redis.expire(HISTORY_KEY, TRIP_TTL_SEC)
  } else {
    memory.set(`trip:${trip.request_id}`, {
      value: json,
      expiresAt: Date.now() + TRIP_TTL_SEC * 1000,
    })
    memoryTripHistory.push(trip.request_id)
  }
}

export async function getTrip(
  requestId: string
): Promise<StoredTrip | null> {
  const redis = getRedis()
  if (redis) {
    const raw = await redis.get<string>(`uber:trip:${requestId}`)
    return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null
  }
  const entry = memory.get(`trip:${requestId}`)
  if (!entry || isExpired(entry)) {
    memory.delete(`trip:${requestId}`)
    return null
  }
  return JSON.parse(entry.value)
}

export async function updateTrip(trip: StoredTrip): Promise<void> {
  const redis = getRedis()
  const json = JSON.stringify(trip)
  if (redis) {
    await redis.set(`uber:trip:${trip.request_id}`, json, {
      ex: TRIP_TTL_SEC,
    })
  } else {
    memory.set(`trip:${trip.request_id}`, {
      value: json,
      expiresAt: Date.now() + TRIP_TTL_SEC * 1000,
    })
  }
}

export async function listTripIds(): Promise<string[]> {
  const redis = getRedis()
  if (redis) {
    return (await redis.lrange<string>(HISTORY_KEY, 0, -1)) ?? []
  }
  return [...memoryTripHistory]
}
