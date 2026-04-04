"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronUp,
  ChevronDown,
  Cpu,
  Zap,
  Clock,
  Hash,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { TelemetryEntry, TelemetryEventType } from "@/lib/telemetry/types"

const TYPE_LABELS: Record<TelemetryEventType, { label: string; color: string }> = {
  "llm.start": { label: "START", color: "text-blue-400" },
  "llm.step_start": { label: "STEP", color: "text-cyan-400" },
  "llm.step_finish": { label: "STEP_OK", color: "text-green-400" },
  "llm.finish": { label: "FINISH", color: "text-emerald-400" },
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  })
}

function EntryLine({ entry }: { entry: TelemetryEntry }) {
  const config = TYPE_LABELS[entry.type]

  return (
    <div className="flex items-start gap-3 px-4 py-1.5 font-mono text-xs hover:bg-muted/30">
      <span className="shrink-0 text-muted-foreground/60 tabular-nums">
        {formatTime(entry.timestamp)}
      </span>
      <span className={cn("shrink-0 w-16 font-semibold", config.color)}>
        {config.label}
      </span>
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        {entry.model && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Cpu className="h-3 w-3" />
            {entry.model}
          </span>
        )}
        {entry.stepNumber !== undefined && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Hash className="h-3 w-3" />
            step {entry.stepNumber}
          </span>
        )}
        {entry.finishReason && (
          <Badge variant="outline" className="h-4 border-zinc-600 px-1 text-[10px] font-mono text-zinc-300">
            {entry.finishReason}
          </Badge>
        )}
        {entry.usage && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Zap className="h-3 w-3" />
            {entry.usage.inputTokens ?? 0}↓ {entry.usage.outputTokens ?? 0}↑
          </span>
        )}
        {entry.totalUsage && (
          <span className="flex items-center gap-1 text-amber-400">
            <Zap className="h-3 w-3" />
            total: {entry.totalUsage.inputTokens ?? 0}↓ {entry.totalUsage.outputTokens ?? 0}↑
          </span>
        )}
        {entry.durationMs !== undefined && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {Math.round(entry.durationMs)}ms
          </span>
        )}
        {entry.totalSteps !== undefined && (
          <span className="text-muted-foreground">
            {entry.totalSteps} steps
          </span>
        )}
        {entry.toolCalls && entry.toolCalls.length > 0 && (
          <span className="text-purple-400">
            → {entry.toolCalls.map((t) => t.toolName).join(", ")}
          </span>
        )}
        {entry.config?.temperature !== undefined && (
          <span className="text-muted-foreground/50">
            temp={entry.config.temperature}
          </span>
        )}
      </div>
    </div>
  )
}

import { downloadJson } from "@/lib/download"

export function TelemetryConsole() {
  const [entries, setEntries] = useState<TelemetryEntry[]>([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch("/api/telemetry")
        const data = await res.json()
        setEntries(data)
      } catch {
        // Retry on next interval
      }
    }

    fetchTelemetry()
    const interval = setInterval(fetchTelemetry, 2000)
    return () => clearInterval(interval)
  }, [])

  const tokenCount = entries.reduce((acc, e) => {
    if (e.totalUsage) {
      return acc + (e.totalUsage.inputTokens ?? 0) + (e.totalUsage.outputTokens ?? 0)
    }
    return acc
  }, 0)

  return (
    <div className="shrink-0 border-t border-border bg-zinc-950 text-zinc-300">
      {/* Header bar — always visible */}
      <div className="flex w-full items-center gap-3 px-4 py-2 text-xs">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsOpen(!isOpen) }}
          className="flex flex-1 cursor-pointer items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Cpu className="h-3.5 w-3.5 text-green-400" />
          <span className="font-medium">LLM Console</span>
          <Badge variant="outline" className="h-4 border-zinc-700 px-1.5 text-[10px] text-zinc-400">
            {entries.length} events
          </Badge>
          {tokenCount > 0 && (
            <Badge variant="outline" className="h-4 border-zinc-700 px-1.5 text-[10px] text-amber-400">
              {tokenCount.toLocaleString()} tokens
            </Badge>
          )}
          <div className="flex-1" />
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
          )}
        </div>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            onClick={() => downloadJson(entries, `telemetry-${Date.now()}.json`)}
          >
            <Download />
            <span className="sr-only">Export telemetry</span>
          </Button>
        )}
      </div>

      {/* Expandable console */}
      {isOpen && (
        <ScrollArea className="h-48 border-t border-zinc-800">
          {entries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-zinc-600">
              Waiting for LLM activity...
            </div>
          ) : (
            <div className="py-1">
              {entries.map((entry) => (
                <EntryLine key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  )
}
