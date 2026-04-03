import type { ActionEntry, ActionType } from "./types"

class ActionLog {
  private entries: ActionEntry[] = []

  append(
    entry: Omit<ActionEntry, "id" | "timestamp"> & { id?: string; timestamp?: string }
  ): ActionEntry {
    const full: ActionEntry = {
      id: entry.id ?? crypto.randomUUID(),
      timestamp: entry.timestamp ?? new Date().toISOString(),
      ...entry,
    }
    this.entries.push(full)
    return full
  }

  getAll(): ActionEntry[] {
    return [...this.entries]
  }

  getByType(type: ActionType): ActionEntry[] {
    return this.entries.filter((e) => e.type === type)
  }

  getByTool(tool: string): ActionEntry[] {
    return this.entries.filter((e) => e.tool === tool)
  }

  clear(): void {
    this.entries = []
  }
}

// Singleton — shared across all requests within the same server process.
// In production, swap for a database-backed implementation.
export const actionLog = new ActionLog()
