"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { MapPin, Phone, MessageSquare, Star, Navigation, Clock, Share2 } from "lucide-react"
import type { Booking } from "@/lib/types"

interface ActiveRideTrackerProps {
  booking: Booking
  platform?: string
  onCancel: () => void
  onDismiss: () => void
}

const statusLabels: Record<string, string> = {
  processing: "Finding your driver...",
  accepted: "Driver assigned",
  arriving: "Driver is on the way",
  in_progress: "Trip in progress",
  completed: "Trip completed",
  rider_canceled: "Ride cancelled",
  driver_canceled: "Driver cancelled",
  no_drivers_available: "No drivers available",
}

const statusProgress: Record<string, number> = {
  processing: 10,
  accepted: 25,
  arriving: 50,
  in_progress: 75,
  completed: 100,
  rider_canceled: 0,
  driver_canceled: 0,
  no_drivers_available: 0,
}

const TERMINAL_STATUSES = ["completed", "rider_canceled", "driver_canceled"]
const CANCELLABLE_STATUSES = ["processing", "accepted", "arriving"]

export function ActiveRideTracker({
  booking,
  platform = "uber-mock",
  onCancel,
  onDismiss,
}: ActiveRideTrackerProps) {
  const [currentStatus, setCurrentStatus] = useState<string>(booking.status)
  const [eta, setEta] = useState(booking.eta)
  const [progress, setProgress] = useState(statusProgress[booking.status] ?? 25)

  const isTerminal = TERMINAL_STATUSES.includes(currentStatus)
  const canCancel = CANCELLABLE_STATUSES.includes(currentStatus)
  const isTerminalRef = useRef(isTerminal)

  useEffect(() => {
    isTerminalRef.current = isTerminal
  }, [isTerminal])

  const pollStatus = useCallback(async () => {
    if (isTerminalRef.current) return

    try {
      const res = await fetch(
        `/api/rides/track?tripId=${booking.id}&platform=${platform}`
      )
      if (!res.ok) return

      const data = await res.json()
      const status = data.status as string

      setCurrentStatus(status)
      setProgress(statusProgress[status] ?? 0)

      if (data.estimatedArrivalMinutes != null) {
        setEta(`${data.estimatedArrivalMinutes} min`)
      } else {
        setEta(statusLabels[status] ?? status)
      }
    } catch {
      // Silently retry on next interval
    }
  }, [booking.id, platform])

  useEffect(() => {
    pollStatus()

    const interval = setInterval(pollStatus, 3000)
    return () => clearInterval(interval)
  }, [pollStatus])

  return (
    <div className="flex h-full flex-col">
      {/* Map Placeholder */}
      <div className="relative h-48 bg-muted">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Navigation className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Live tracking</p>
          </div>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <Card className="px-3 py-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{eta}</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Status */}
      <div className="border-b border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <Badge
            variant={isTerminal ? "secondary" : "default"}
            className="text-xs"
          >
            {statusLabels[currentStatus] ?? currentStatus}
          </Badge>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <Share2 className="h-3.5 w-3.5" />
            Share trip
          </Button>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Driver Info */}
      <div className="flex-1 p-4 space-y-4">
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-border">
              <AvatarFallback className="text-lg">
                {booking.driver.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">{booking.driver.name}</h4>
                <div className="flex items-center gap-1 text-sm">
                  <Star className="h-3.5 w-3.5 fill-current text-foreground" />
                  <span>{booking.driver.rating}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {booking.driver.car} - {booking.driver.plate}
              </p>
              <Badge variant="outline" className="mt-1 text-xs">
                {booking.rideName}
              </Badge>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1 gap-2">
              <Phone className="h-4 w-4" />
              Call
            </Button>
            <Button variant="outline" className="flex-1 gap-2">
              <MessageSquare className="h-4 w-4" />
              Message
            </Button>
          </div>
        </Card>

        {/* Trip Details */}
        <Card className="p-4">
          <h4 className="mb-3 text-sm font-semibold">Trip details</h4>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-foreground">
                <div className="h-2 w-2 rounded-full bg-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="text-sm font-medium">{booking.pickup}</p>
              </div>
            </div>
            <div className="ml-3 h-6 border-l border-dashed border-border" />
            <div className="flex items-start gap-3">
              <MapPin className="h-6 w-6 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Destination</p>
                <p className="text-sm font-medium">{booking.destination}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Price */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Estimated fare</p>
              <p className="text-2xl font-bold">${booking.price.toFixed(2)}</p>
            </div>
            <Badge variant="secondary">Cash</Badge>
          </div>
        </Card>
      </div>

      {/* Footer actions based on trip state */}
      <div className="border-t border-border p-4">
        {isTerminal ? (
          <Button className="w-full" onClick={onDismiss}>
            Book Another Ride
          </Button>
        ) : canCancel ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full text-destructive hover:text-destructive">
                Cancel Ride
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this ride?</AlertDialogTitle>
                <AlertDialogDescription>
                  {currentStatus === "arriving"
                    ? "A cancellation fee of $2.50 may apply since the driver is on the way."
                    : "No cancellation fee will be charged."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep ride</AlertDialogCancel>
                <AlertDialogAction onClick={onCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Cancel ride
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </div>
  )
}
