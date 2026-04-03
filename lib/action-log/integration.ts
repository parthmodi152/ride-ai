import type { TelemetryIntegration, ToolSet } from "ai"
import { bindTelemetryIntegration } from "ai"
import { actionLog } from "./log"

interface ActionLogIntegrationOptions {
  tools: ToolSet
}

class ActionLogIntegration implements TelemetryIntegration {
  private tools: ToolSet

  constructor({ tools }: ActionLogIntegrationOptions) {
    this.tools = tools
  }

  async onToolCallStart(event: {
    toolCall: { toolName: string; input: unknown }
  }) {
    await actionLog.append({
      type: "tool.start",
      tool: event.toolCall.toolName,
      input: event.toolCall.input,
    })
  }

  async onToolCallFinish(
    event:
      | {
          success: true
          toolCall: { toolName: string; input: unknown }
          output: unknown
          durationMs: number
        }
      | {
          success: false
          toolCall: { toolName: string; input: unknown }
          error: unknown
          durationMs: number
        }
  ) {
    if (event.success) {
      await actionLog.append({
        type: "tool.finish",
        tool: event.toolCall.toolName,
        input: event.toolCall.input,
        output: event.output,
        durationMs: event.durationMs,
      })
    } else {
      await actionLog.append({
        type: "tool.error",
        tool: event.toolCall.toolName,
        input: event.toolCall.input,
        error:
          event.error instanceof Error
            ? event.error.message
            : String(event.error),
        durationMs: event.durationMs,
      })
    }
  }

  async onStepFinish(event: {
    toolCalls: Array<{ toolName: string; input: unknown }>
  }) {
    for (const toolCall of event.toolCalls) {
      const tool = this.tools[toolCall.toolName]
      // Tools without execute are HITL — the LLM called them but
      // execution depends on user confirmation via the client.
      // onToolCallStart/Finish never fire for these, so we log here.
      if (tool && !tool.execute) {
        await actionLog.append({
          type: "tool.requested",
          tool: toolCall.toolName,
          input: toolCall.input,
        })
      }
    }
  }
}

export function actionLogIntegration(
  options: ActionLogIntegrationOptions
): TelemetryIntegration {
  return bindTelemetryIntegration(new ActionLogIntegration(options))
}
