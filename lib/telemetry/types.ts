export type TelemetryEventType =
  | "llm.start"
  | "llm.step_start"
  | "llm.step_finish"
  | "llm.finish"

export interface TelemetryEntry {
  id: string
  timestamp: string
  type: TelemetryEventType

  // Model info
  model?: string
  provider?: string

  // Step context
  stepNumber?: number
  finishReason?: string

  // Token usage
  usage?: {
    inputTokens?: number
    outputTokens?: number
    cacheReadTokens?: number
    cacheWriteTokens?: number
  }

  // Aggregated usage (onFinish only)
  totalUsage?: {
    inputTokens?: number
    outputTokens?: number
  }

  // Generated content
  text?: string
  toolCalls?: Array<{ toolName: string; input: unknown }>

  // Timing
  durationMs?: number

  // Config (onStart only)
  config?: {
    temperature?: number
    topP?: number
    topK?: number
    maxOutputTokens?: number
    stopSequences?: string[]
  }

  // Step count (onFinish only)
  totalSteps?: number

  // Telemetry metadata
  functionId?: string
  metadata?: Record<string, unknown>
}
