import { getRedis } from "@/lib/redis"
import type { ActionEntry, ActionType } from "./types"

const REDIS_KEY = "ride-ai:action-log"
const LOG_TTL_SEC = 3600 // 1 hour

// In-memory fallback for local dev without Redis
const memoryEntries: ActionEntry[] = []

function buildEntry(
  entry: Omit<ActionEntry, "id" | "timestamp"> & {
    id?: string
    timestamp?: string
  }
): ActionEntry {
  return {
    id: entry.id ?? crypto.randomUUID(),
    timestamp: entry.timestamp ?? new Date().toISOString(),
    ...entry,
  }
}

export const actionLog = {
  async append(
    entry: Omit<ActionEntry, "id" | "timestamp"> & {
      id?: string
      timestamp?: string
    }
  ): Promise<ActionEntry> {
    const full = buildEntry(entry)
    const redis = getRedis()
    if (redis) {
      await redis.rpush(REDIS_KEY, JSON.stringify(full))
      await redis.expire(REDIS_KEY, LOG_TTL_SEC)
    } else {
      memoryEntries.push(full)
    }
    return full
  },

  async getAll(): Promise<ActionEntry[]> {
    const redis = getRedis()
    if (redis) {
      const raw = await redis.lrange<string>(REDIS_KEY, 0, -1)
      return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r))
    }
    return [...memoryEntries]
  },

  async getByType(type: ActionType): Promise<ActionEntry[]> {
    const all = await this.getAll()
    return all.filter((e) => e.type === type)
  },

  async getByTool(tool: string): Promise<ActionEntry[]> {
    const all = await this.getAll()
    return all.filter((e) => e.tool === tool)
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
