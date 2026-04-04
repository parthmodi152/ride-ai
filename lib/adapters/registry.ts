import type { PlatformAdapter } from "./types"
import { UberAdapter } from "./uber-adapter"

const adapters: Record<string, PlatformAdapter> = {
  "uber-mock": new UberAdapter(),
}

export function getAdapter(platform?: string): PlatformAdapter {
  const key = platform || "uber-mock"
  const adapter = adapters[key]
  if (!adapter) {
    throw new Error(
      `Unknown platform "${key}". Available: ${Object.keys(adapters).join(", ")}`
    )
  }
  return adapter
}
