"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MapPin, Users, Clock, Car, Sparkles } from "lucide-react"
import type { RideOption } from "@/lib/types"
import type { RideAgentMessage } from "@/app/api/chat/route"
import { cn } from "@/lib/utils"

interface RideOptionsPanelProps {
  rideContext: {
    pickup: string
    destination: string
    rideOptions: RideOption[]
  } | null
  onSelectRide: (rideId: string) => void
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

          <div className="space-y-2">
            {rideOptions.map((ride) => (
              <Card
                key={ride.id}
                className={cn(
                  "cursor-pointer p-4 transition-all hover:border-foreground/50"
                )}
                onClick={() => onSelectRide(ride.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
                    <Car className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{ride.name}</h4>
                      {ride.type === "premium" && (
                        <Badge className="bg-foreground text-background text-[10px]">
                          Premium
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {ride.description}
                    </p>
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
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">${ride.price.toFixed(2)}</p>
                    <Button size="sm" className="mt-2">
                      Book
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <p className="text-center text-xs text-muted-foreground">
          Click on a ride option or ask the AI to book one for you
        </p>
      </div>
    </div>
  )
}
