"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MapPin, Users, Clock, Car, Sparkles, Zap } from "lucide-react"
import type { RideOption } from "@/lib/types"
import type { RideAgentMessage } from "@/app/api/chat/route"
import { cn } from "@/lib/utils"

interface RideOptionsPanelProps {
  rideContext: {
    pickup: string
    destination: string
    rideOptions: RideOption[]
    fareExpiresAt?: number
  } | null
  onSelectRide: (rideId: string, rideName: string) => void
  messages: RideAgentMessage[]
}

export function RideOptionsPanel({
  rideContext,
  onSelectRide,
  messages,
}: RideOptionsPanelProps) {
  // Check if a booking was just made (show confirmation state)
  const hasRecentBooking = messages.some((m) =>
    m.parts.some(
      (p) =>
        p.type === "tool-bookRide" &&
        p.state === "output-available" &&
        (p.output as { state: string })?.state === "confirmed"
    )
  )

  if (!rideContext || hasRecentBooking) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <Empty>
          <EmptyHeader>
            <EmptyMedia><Sparkles className="h-10 w-10" /></EmptyMedia>
            <EmptyTitle>Start a conversation</EmptyTitle>
            <EmptyDescription>Tell the AI agent where you want to go, and it will find the best ride options for you.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const { pickup, destination, rideOptions } = rideContext

  return (
    <div className="flex h-full flex-col">
      {/* Route Info */}
      <div className="border-b border-border p-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-foreground">
                <div className="h-2 w-2 rounded-full bg-foreground" />
              </div>
              <div className="h-8 w-0.5 bg-border" />
              <MapPin className="h-6 w-6 text-foreground" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Pickup
                </p>
                <p className="font-medium">{pickup}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Destination
                </p>
                <p className="font-medium">{destination}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ride Options */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Available rides</h3>
            <Badge variant="secondary" className="text-xs">
              {rideOptions.length} options
            </Badge>
          </div>

          {rideOptions.some((r) => (r.surgeMultiplier ?? 1) > 1) && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span>Surge pricing is active. Fares are higher than usual.</span>
            </div>
          )}

          <div className="space-y-2">
            {rideOptions.map((ride) => (
              <Card
                key={ride.id}
                className={cn(
                  "p-4 transition-all",
                  ride.noCarsAvailable
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:border-foreground/50"
                )}
                onClick={() => !ride.noCarsAvailable && onSelectRide(ride.id, ride.name)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
                    <Car className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{ride.name}</h4>
                      {ride.noCarsAvailable ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Unavailable
                        </Badge>
                      ) : ride.type === "premium" ? (
                        <Badge className="bg-foreground text-background text-[10px]">
                          Premium
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {ride.description}
                    </p>
                    {!ride.noCarsAvailable && (
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {ride.eta} away
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {ride.capacity}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={cn("text-lg font-bold", ride.noCarsAvailable && "line-through text-muted-foreground")}>
                      ${ride.price.toFixed(2)}
                    </p>
                    {!ride.noCarsAvailable && ride.surgeMultiplier && ride.surgeMultiplier > 1 && (
                      <p className="flex items-center justify-end gap-0.5 text-[10px] font-medium text-amber-600">
                        <Zap className="h-3 w-3" />
                        {ride.surgeMultiplier}x
                      </p>
                    )}
                    {!ride.noCarsAvailable && (
                      <Button size="sm" className="mt-2">
                        Book
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </ScrollArea>

      {rideContext.fareExpiresAt ? (
        <FareCountdown expiresAt={rideContext.fareExpiresAt} />
      ) : (
        <div className="border-t border-border p-4">
          <p className="text-center text-xs text-muted-foreground">
            Click on a ride option or ask the AI to book one for you
          </p>
        </div>
      )}
    </div>
  )
}

function FareCountdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  )

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setRemaining(secs)
      if (secs <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  if (remaining <= 0) {
    return (
      <div className="border-t border-border bg-destructive/5 p-4 text-center">
        <p className="text-xs text-destructive">
          Prices expired. Ask for new estimates to get updated fares.
        </p>
      </div>
    )
  }

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const isUrgent = remaining <= 30

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 border-t border-border p-3 text-xs",
        isUrgent
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
          : "text-muted-foreground"
      )}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span>
        Prices valid for {mins}:{secs.toString().padStart(2, "0")}
      </span>
    </div>
  )
}
