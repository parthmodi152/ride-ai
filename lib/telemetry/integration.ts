import type { TelemetryIntegration } from "ai"
import { bindTelemetryIntegration } from "ai"
import { telemetryStore } from "./store"

class LLMTelemetryIntegration implements TelemetryIntegration {
  private startTime = 0

  async onStart(event: {
    model: { provider: string; modelId: string }
    temperature?: number
    topP?: number
    topK?: number
    maxOutputTokens?: number
    stopSequences?: string[]
    functionId?: string
    metadata?: Record<string, unknown>
  }) {
    this.startTime = Date.now()
    await telemetryStore.append({
      type: "llm.start",
      model: event.model.modelId,
      provider: event.model.provider,
      functionId: event.functionId,
      metadata: event.metadata,
      config: {
        temperature: event.temperature,
        topP: event.topP,
        topK: event.topK,
        maxOutputTokens: event.maxOutputTokens,
        stopSequences: event.stopSequences,
      },
    })
  }

  async onStepStart(event: {
    stepNumber: number
    model: { provider: string; modelId: string }
  }) {
    await telemetryStore.append({
      type: "llm.step_start",
      stepNumber: event.stepNumber,
      model: event.model.modelId,
      provider: event.model.provider,
    })
  }

  async onStepFinish(event: {
    stepNumber: number
    model: { provider: string; modelId: string }
    text: string
    toolCalls: Array<{ toolName: string; input: unknown }>
    finishReason: string
    usage: {
      inputTokens?: number
      outputTokens?: number
      inputTokenDetails: {
        cacheReadTokens?: number
        cacheWriteTokens?: number
      }
    }
  }) {
    await telemetryStore.append({
      type: "llm.step_finish",
      stepNumber: event.stepNumber,
      model: event.model.modelId,
      provider: event.model.provider,
      finishReason: event.finishReason,
      text: event.text || undefined,
      toolCalls: event.toolCalls.length > 0 ? event.toolCalls : undefined,
      usage: {
        inputTokens: event.usage.inputTokens,
        outputTokens: event.usage.outputTokens,
        cacheReadTokens: event.usage.inputTokenDetails?.cacheReadTokens,
        cacheWriteTokens: event.usage.inputTokenDetails?.cacheWriteTokens,
      },
    })
  }

  async onFinish(event: {
    stepNumber: number
    model: { provider: string; modelId: string }
    text: string
    finishReason: string
    steps: Array<unknown>
    totalUsage: { inputTokens?: number; outputTokens?: number }
    functionId?: string
    metadata?: Record<string, unknown>
  }) {
    await telemetryStore.append({
      type: "llm.finish",
      model: event.model.modelId,
      provider: event.model.provider,
      finishReason: event.finishReason,
      totalUsage: {
        inputTokens: event.totalUsage.inputTokens,
        outputTokens: event.totalUsage.outputTokens,
      },
      totalSteps: event.steps.length,
      durationMs: Date.now() - this.startTime,
      functionId: event.functionId,
      metadata: event.metadata,
    })
  }
}

export function llmTelemetryIntegration(): TelemetryIntegration {
  return bindTelemetryIntegration(new LLMTelemetryIntegration())
}
