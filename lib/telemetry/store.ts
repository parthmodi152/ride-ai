import type { TelemetryEntry, TelemetryEventType } from "./types"

class TelemetryStore {
  private entries: TelemetryEntry[] = []

  append(
    entry: Omit<TelemetryEntry, "id" | "timestamp"> & {
      id?: string
      timestamp?: string
    }
  ): TelemetryEntry {
    const full: TelemetryEntry = {
      id: entry.id ?? crypto.randomUUID(),
      timestamp: entry.timestamp ?? new Date().toISOString(),
      ...entry,
    }
    this.entries.push(full)
    return full
  }

  getAll(): TelemetryEntry[] {
    return [...this.entries]
  }

  getByType(type: TelemetryEventType): TelemetryEntry[] {
    return this.entries.filter((e) => e.type === type)
  }

  clear(): void {
    this.entries = []
  }
}

export const telemetryStore = new TelemetryStore()
