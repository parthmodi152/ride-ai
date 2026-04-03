export type ActionType =
  // Server-executed tools (from onToolCallStart/onToolCallFinish)
  | "tool.start"
  | "tool.finish"
  | "tool.error"
  // HITL tool calls — LLM's intent before user decides (from onStepFinish)
  | "tool.requested"
  // HITL outcomes (from /api/rides/* endpoints)
  | "ride.booked"
  | "ride.cancelled"
  | "ride.booking_declined"
  | "ride.cancel_declined"

export interface ActionEntry {
  id: string
  timestamp: string
  type: ActionType
  tool?: string
  input?: unknown
  output?: unknown
  error?: string
  durationMs?: number
  metadata?: Record<string, unknown>
}
