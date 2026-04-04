import { tool } from "ai"
import * as z from "zod"
import type { PlatformAdapter, Location } from "@/lib/adapters/types"
import { geocodeAddress } from "@/lib/mock-servers/uber/server"
import {
  searchRidesSchema,
  bookRideSchema,
  cancelRideSchema,
  trackRideSchema,
} from "./schemas"

// Geocode an address string to a Location.
// Delegates to the mock Uber server's geocoding (Google Places + hardcoded fallback).
// Throws if the address cannot be resolved.
async function addressToLocation(address: string): Promise<Location> {
  const coords = await geocodeAddress(address)
  return { lat: coords.latitude, lng: coords.longitude, address }
}

export { addressToLocation }

interface RideToolsOptions {
  userLocation?: { address: string; lat: number; lng: number }
}

export function createRideTools(
  adapter: PlatformAdapter,
  options: RideToolsOptions = {}
) {
  const { userLocation } = options

  return {
    searchRides: tool({
      description:
        "Search for available ride options when the user wants to go somewhere. Use this when the user provides a pickup location and/or destination.",
      inputSchema: searchRidesSchema,
      async *execute({ pickup, destination }) {
        // Treat "current location" as equivalent to omitting pickup.
        // LLMs often fill optional fields with this phrase despite schema instructions.
        const isCurrentLocation = !pickup ||
          pickup.toLowerCase().replace(/[^a-z]/g, "").includes("currentlocation")

        let pickupLocation: Location
        let resolvedPickup: string

        if (isCurrentLocation && userLocation) {
          resolvedPickup = userLocation.address
          pickupLocation = {
            lat: userLocation.lat,
            lng: userLocation.lng,
            address: userLocation.address,
          }
        } else if (isCurrentLocation) {
          yield { state: "error" as const, message: "No pickup location specified and current location is unavailable." }
          return
        } else {
          resolvedPickup = pickup
          try {
            pickupLocation = await addressToLocation(pickup)
          } catch {
            yield { state: "error" as const, message: `Could not find pickup location: "${pickup}". Try a well-known landmark or specific address.` }
            return
          }
        }

        yield { state: "searching" as const, pickup: resolvedPickup, destination }

        let dropoffLocation: Location
        try {
          dropoffLocation = await addressToLocation(destination)
        } catch {
          yield { state: "error" as const, message: `Could not find destination: "${destination}". Try a well-known landmark or specific address.` }
          return
        }

        let result
        try {
          result = await adapter.getEstimates({
            pickup: pickupLocation,
            dropoff: dropoffLocation,
          })
        } catch (err) {
          yield { state: "error" as const, message: err instanceof Error ? err.message : "Failed to get ride estimates." }
          return
        }

        // All data comes from the adapter — no fabrication
        const rideOptions = result.products.map((p) => ({
          id: p.productId,
          name: p.name,
          description: p.description,
          price: p.fareValue,
          eta: p.noCarsAvailable ? null : `${p.etaMinutes} min`,
          duration: `${p.durationMinutes} min`,
          distance: `${p.distanceMiles} mi`,
          capacity: p.capacity,
          type: p.productGroup,
          surgeMultiplier: p.surgeMultiplier,
          fareId: p.fareId,
          fareDisplay: p.fareDisplay,
          noCarsAvailable: p.noCarsAvailable,
        }))

        // Use earliest fare expiry across all products (guard empty)
        const fareExpiresAt = result.products.length > 0
          ? Math.min(...result.products.map((p) => p.fareExpiresAt))
          : undefined

        yield {
          state: "ready" as const,
          pickup: resolvedPickup,
          destination,
          rideOptions,
          fareExpiresAt,
        }
      },
    }),

    bookRide: tool({
      description:
        "Book a specific ride option after the user has selected one. This requires user confirmation before proceeding.",
      inputSchema: bookRideSchema,
      outputSchema: z.object({
        state: z.string(),
        booking: z.any().optional(),
        message: z.string().optional(),
      }),
      // No execute — HITL: client confirms, then calls /api/rides/book
    }),

    cancelRide: tool({
      description:
        "Cancel the current active ride. This requires user confirmation before proceeding.",
      inputSchema: cancelRideSchema,
      outputSchema: z.object({
        state: z.string(),
        bookingId: z.string().optional(),
        message: z.string().optional(),
      }),
      // No execute — HITL: client confirms, then calls /api/rides/cancel
    }),

    trackRide: tool({
      description:
        "Get the current status and tracking information for an active ride.",
      inputSchema: trackRideSchema,
      async *execute({ bookingId }) {
        yield { state: "loading" as const }

        const status = await adapter.trackRide({ tripId: bookingId })

        yield {
          state: "ready" as const,
          bookingId,
          status: status.status,
          // ETA comes from adapter — decreases over time as driver approaches
          eta: status.estimatedArrivalMinutes != null
            ? `${status.estimatedArrivalMinutes} min`
            : STATUS_LABELS[status.status] ?? status.status,
          driver: status.driver
            ? {
                name: status.driver.name,
                rating: status.driver.rating,
                phone: status.driver.phoneNumber,
                car: status.vehicle
                  ? `${status.vehicle.color} ${status.vehicle.make} ${status.vehicle.model}`
                  : "Unknown",
                plate: status.vehicle?.licensePlate ?? "",
              }
            : undefined,
          location: status.location,
        }
      },
    }),
  } as const
}

// Human-readable status labels (used when ETA is not available)
const STATUS_LABELS: Record<string, string> = {
  processing: "Finding your driver...",
  accepted: "Driver assigned",
  arriving: "Driver arriving",
  in_progress: "En route to destination",
  completed: "Trip completed",
  no_drivers_available: "No drivers available",
  driver_canceled: "Driver cancelled",
  rider_canceled: "Ride cancelled",
}
