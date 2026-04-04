"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Car, MapPin, Clock, Loader2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface TripRecord {
  tripId: string
  status: string
  eta: number | null
  driver?: { name: string; rating: number }
  vehicle?: { make: string; model: string; color: string }
  pickup: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  surgeMultiplier: number
}

const statusLabels: Record<string, string> = {
  processing: "Finding driver",
  accepted: "Driver assigned",
  arriving: "Driver en route",
  in_progress: "In progress",
  completed: "Completed",
  rider_canceled: "Cancelled",
  driver_canceled: "Driver cancelled",
  no_drivers_available: "No drivers",
}

const statusColors: Record<string, string> = {
  processing: "bg-muted text-muted-foreground",
  accepted: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  arriving: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  rider_canceled: "bg-destructive/10 text-destructive",
  driver_canceled: "bg-destructive/10 text-destructive",
  no_drivers_available: "bg-muted text-muted-foreground",
}

export function TripHistory() {
  const [trips, setTrips] = useState<TripRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const res = await fetch("/api/rides/history")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setTrips(data)
        setError(null)
      } catch {
        setError("Failed to load trip history. Retrying...")
      } finally {
        setLoading(false)
      }
    }

    fetchTrips()
    const interval = setInterval(fetchTrips, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && trips.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive/50" />
        <p className="text-sm font-medium text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground/70">Will retry automatically.</p>
      </div>
    )
  }

  if (trips.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <Car className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">
          No trips yet
        </p>
        <p className="text-xs text-muted-foreground/70">
          Your ride history will appear here after your first trip.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Trip History</h3>
          <Badge variant="secondary" className="text-xs">
            {trips.length} trips
          </Badge>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {[...trips].reverse().map((trip) => (
            <div key={trip.tripId} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Car className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", statusColors[trip.status])}
                    >
                      {statusLabels[trip.status] ?? trip.status}
                    </Badge>
                    {trip.driver && (
                      <span className="text-xs text-muted-foreground">
                        {trip.driver.name}
                      </span>
                    )}
                  </div>
                  {trip.vehicle && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {trip.vehicle.color} {trip.vehicle.make}{" "}
                      {trip.vehicle.model}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/60">
                    <MapPin className="h-2.5 w-2.5" />
                    <span>
                      {trip.tripId.slice(0, 8)}...
                    </span>
                    {trip.eta != null && (
                      <>
                        <Clock className="ml-1 h-2.5 w-2.5" />
                        <span>{trip.eta} min</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
