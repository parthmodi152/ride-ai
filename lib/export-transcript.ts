import type { UIMessage } from "ai"
import { downloadFile } from "./download"

// Serialize AI SDK UIMessage parts into readable markdown
function serializeMessages(messages: UIMessage[]): string {
  const lines: string[] = []

  for (const message of messages) {
    const role = message.role === "user" ? "**User**" : "**Agent**"

    for (const part of message.parts) {
      switch (part.type) {
        case "text":
          if ("text" in part && part.text) {
            lines.push(`${role}:`, part.text, "")
          }
          break

        case "step-start":
          // Skip — internal boundary marker
          break

        default:
          // Tool parts: tool-searchRides, tool-bookRide, etc.
          if (part.type.startsWith("tool-")) {
            const toolName = part.type.replace("tool-", "")
            if ("state" in part) {
              if (
                part.state === "output-available" &&
                "output" in part &&
                part.output
              ) {
                lines.push(
                  `> **Tool:** \`${toolName}\` — completed`,
                  "> ```json",
                  ...JSON.stringify(part.output, null, 2)
                    .split("\n")
                    .map((l) => `> ${l}`),
                  "> ```",
                  ""
                )
              } else if (part.state === "input-available" && "input" in part) {
                lines.push(
                  `> **Tool:** \`${toolName}\` — called`,
                  "> ```json",
                  ...JSON.stringify(part.input, null, 2)
                    .split("\n")
                    .map((l) => `> ${l}`),
                  "> ```",
                  ""
                )
              }
            }
          }
          break
      }
    }
  }

  return lines.join("\n")
}

export async function exportTranscript(messages: UIMessage[]) {
  // Fetch action log and telemetry in parallel
  const [actionLogRes, telemetryRes] = await Promise.all([
    fetch("/api/rides/log").catch(() => null),
    fetch("/api/telemetry").catch(() => null),
  ])

  const actionLog = actionLogRes?.ok
    ? await actionLogRes.json()
    : []
  const telemetry = telemetryRes?.ok
    ? await telemetryRes.json()
    : []

  const sections: string[] = [
    "# RideAI Transcript",
    "",
    `**Date:** ${new Date().toLocaleString()}`,
    `**Messages:** ${messages.length}`,
    `**Action Log Entries:** ${actionLog.length}`,
    `**Telemetry Events:** ${telemetry.length}`,
    "",
    "---",
    "",
    "## Conversation",
    "",
    serializeMessages(messages),
    "---",
    "",
    "## Action Log",
    "",
    "| Time | Type | Tool | Details |",
    "|------|------|------|---------|",
    ...actionLog.map(
      (e: { timestamp: string; type: string; tool?: string; input?: unknown; output?: unknown; error?: string }) =>
        `| ${new Date(e.timestamp).toLocaleTimeString()} | ${e.type} | ${e.tool ?? "—"} | ${e.error ?? (e.output ? JSON.stringify(e.output).slice(0, 80) : JSON.stringify(e.input ?? {}).slice(0, 80))} |`
    ),
    "",
    "---",
    "",
    "## LLM Telemetry",
    "",
    "| Time | Event | Model | Tokens | Duration |",
    "|------|-------|-------|--------|----------|",
    ...telemetry.map(
      (e: { timestamp: string; type: string; model?: string; usage?: { inputTokens?: number; outputTokens?: number }; totalUsage?: { inputTokens?: number; outputTokens?: number }; durationMs?: number }) => {
        const tokens = e.totalUsage
          ? `${e.totalUsage.inputTokens ?? 0}↓ ${e.totalUsage.outputTokens ?? 0}↑`
          : e.usage
            ? `${e.usage.inputTokens ?? 0}↓ ${e.usage.outputTokens ?? 0}↑`
            : "—"
        const duration = e.durationMs != null ? `${Math.round(e.durationMs)}ms` : "—"
        return `| ${new Date(e.timestamp).toLocaleTimeString()} | ${e.type} | ${e.model ?? "—"} | ${tokens} | ${duration} |`
      }
    ),
    "",
  ]

  downloadFile(sections.join("\n"), `transcript-${Date.now()}.md`)
}
