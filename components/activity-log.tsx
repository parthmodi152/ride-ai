"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  CheckCircle2,
  XCircle,
  Car,
  Navigation,
  AlertTriangle,
  Loader2,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActionEntry, ActionType } from "@/lib/action-log/types"

const TYPE_CONFIG: Record<
  ActionType,
  { label: string; icon: typeof Search; color: string; badgeVariant: "default" | "secondary" | "destructive" | "outline" }
> = {
  "tool.start": {
    label: "Executed",
    icon: Search,
    color: "text-blue-500",
    badgeVariant: "secondary",
  },
  "tool.finish": {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-green-500",
    badgeVariant: "secondary",
  },
  "tool.error": {
    label: "Failed",
    icon: AlertTriangle,
    color: "text-destructive",
    badgeVariant: "destructive",
  },
  "tool.requested": {
    label: "Awaiting Approval",
    icon: Car,
    color: "text-amber-500",
    badgeVariant: "outline",
  },
  "ride.booked": {
    label: "Approved",
    icon: Car,
    color: "text-primary",
    badgeVariant: "default",
  },
  "ride.cancelled": {
    label: "Approved",
    icon: XCircle,
    color: "text-destructive",
    badgeVariant: "destructive",
  },
  "ride.booking_declined": {
    label: "Declined",
    icon: XCircle,
    color: "text-muted-foreground",
    badgeVariant: "outline",
  },
  "ride.cancel_declined": {
    label: "Declined",
    icon: Navigation,
    color: "text-muted-foreground",
    badgeVariant: "outline",
  },
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function summarize(entry: ActionEntry): string {
  const input = entry.input as Record<string, unknown> | undefined
  const output = entry.output as Record<string, unknown> | undefined

  switch (entry.type) {
    case "tool.start":
      if (entry.tool === "searchRides" && input) {
        return `${input.pickup} → ${input.destination}`
      }
      if (entry.tool === "trackRide" && input) {
        return `Tracking ${input.bookingId}`
      }
      return entry.tool ?? ""

    case "tool.finish":
      if (entry.tool === "searchRides" && output) {
        const options = output.rideOptions as unknown[]
        return `${options?.length ?? 0} options found · ${entry.durationMs}ms`
      }
      if (entry.tool === "trackRide" && output) {
        return `${output.status} · ${output.eta}`
      }
      return entry.durationMs ? `${entry.durationMs}ms` : ""

    case "tool.error":
      return entry.error ?? "Unknown error"

    case "tool.requested":
      if (entry.tool === "bookRide" && input) {
        return `${input.rideName} · $${input.price} · ${input.pickup} → ${input.destination}`
      }
      if (entry.tool === "cancelRide" && input) {
        return `Cancel ${input.bookingId}`
      }
      return entry.tool ?? ""

    case "ride.booked":
      if (output) {
        return `Confirmed · ${output.tripId} · ETA ${output.estimatedPickupMinutes} min`
      }
      return "Booking confirmed"

    case "ride.cancelled":
      if (output && typeof output.cancellationFee === "number") {
        return `Ride cancelled · Fee: $${output.cancellationFee.toFixed(2)}`
      }
      return "Ride cancelled · No fee"

    case "ride.booking_declined":
      if (input) return `User declined · ${input.productId} · ${input.pickup} → ${input.destination}`
      return "User declined booking"

    case "ride.cancel_declined":
      if (input) return `User kept ride · ${input.tripId}`
      return "User kept ride"

    default:
      return ""
  }
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ActivityLog() {
  const [entries, setEntries] = useState<ActionEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLog = async () => {
      try {
        const res = await fetch("/api/rides/log")
        const data = await res.json()
        setEntries(data)
      } catch {
        // Silently retry on next interval
      } finally {
        setLoading(false)
      }
    }

    fetchLog()
    const interval = setInterval(fetchLog, 2000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <Search className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">
          No activity yet
        </p>
        <p className="text-xs text-muted-foreground/70">
          Actions will appear here as you interact with the agent.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Activity Log</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {entries.length} events
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => downloadJson(entries, `action-log-${Date.now()}.json`)}
            >
              <Download />
              <span className="sr-only">Export action log</span>
            </Button>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {[...entries].reverse().map((entry) => {
            const config = TYPE_CONFIG[entry.type]
            const Icon = config.icon
            const summary = summarize(entry)

            return (
              <div key={entry.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted",
                      config.color
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={config.badgeVariant} className="text-[10px]">
                        {config.label}
                      </Badge>
                      {entry.tool && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {entry.tool}
                        </span>
                      )}
                    </div>
                    {summary && (
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {summary}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                      {formatTime(entry.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
