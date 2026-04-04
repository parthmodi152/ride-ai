import { Redis } from "@upstash/redis"

// Singleton Redis client — shared across all stores.
// Creates one instance per process lifetime (serverless-compatible).
// Returns null when Redis env vars are not configured (local dev fallback).

let _redis: Redis | null | undefined = undefined

export function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis
  if (
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  ) {
    _redis = new Redis({
      url: (process.env.UPSTASH_REDIS_REST_URL ||
        process.env.KV_REST_API_URL)!,
      token: (process.env.UPSTASH_REDIS_REST_TOKEN ||
        process.env.KV_REST_API_TOKEN)!,
    })
  } else {
    _redis = null
  }
  return _redis
}
