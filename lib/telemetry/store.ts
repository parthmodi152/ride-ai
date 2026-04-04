import { getRedis } from "@/lib/redis"
import type { TelemetryEntry, TelemetryEventType } from "./types"

const REDIS_KEY = "ride-ai:telemetry"
const TELEMETRY_TTL_SEC = 3600 // 1 hour

const memoryEntries: TelemetryEntry[] = []

function buildEntry(
  entry: Omit<TelemetryEntry, "id" | "timestamp"> & {
    id?: string
    timestamp?: string
  }
): TelemetryEntry {
  return {
    id: entry.id ?? crypto.randomUUID(),
    timestamp: entry.timestamp ?? new Date().toISOString(),
    ...entry,
  }
}

export const telemetryStore = {
  async append(
    entry: Omit<TelemetryEntry, "id" | "timestamp"> & {
      id?: string
      timestamp?: string
    }
  ): Promise<TelemetryEntry> {
    const full = buildEntry(entry)
    const redis = getRedis()
    if (redis) {
      await redis.rpush(REDIS_KEY, JSON.stringify(full))
      await redis.expire(REDIS_KEY, TELEMETRY_TTL_SEC)
    } else {
      memoryEntries.push(full)
    }
    return full
  },

  async getAll(): Promise<TelemetryEntry[]> {
    const redis = getRedis()
    if (redis) {
      const raw = await redis.lrange<string>(REDIS_KEY, 0, -1)
      return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r))
    }
    return [...memoryEntries]
  },

  async getByType(type: TelemetryEventType): Promise<TelemetryEntry[]> {
    const all = await this.getAll()
    return all.filter((e) => e.type === type)
  },

  async clear(): Promise<void> {
    const redis = getRedis()
    if (redis) {
      await redis.del(REDIS_KEY)
    } else {
      memoryEntries.length = 0
    }
  },
}
