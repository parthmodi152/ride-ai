import type { PlatformAdapter } from "./types"
import { MockUberAdapter } from "./uber-mock"

const adapters: Record<string, PlatformAdapter> = {
  "uber-mock": new MockUberAdapter(),
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
