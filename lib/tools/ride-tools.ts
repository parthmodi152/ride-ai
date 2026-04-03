import { tool } from "ai"
import * as z from "zod"
import type { PlatformAdapter, Location } from "@/lib/adapters/types"
import {
  searchRidesSchema,
  bookRideSchema,
  cancelRideSchema,
  trackRideSchema,
} from "./schemas"

// Simple geocoder: maps common landmarks to coordinates.
// In production, this would call Google Places or a similar API.
const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  "times square": { lat: 40.758, lng: -73.9855 },
  "jfk airport": { lat: 40.6413, lng: -73.7781 },
  jfk: { lat: 40.6413, lng: -73.7781 },
  laguardia: { lat: 40.7772, lng: -73.8726 },
  lga: { lat: 40.7772, lng: -73.8726 },
  "central park": { lat: 40.7829, lng: -73.9654 },
  "brooklyn bridge": { lat: 40.7061, lng: -73.9969 },
  "empire state building": { lat: 40.7484, lng: -73.9857 },
  "grand central": { lat: 40.7527, lng: -73.9772 },
  "penn station": { lat: 40.7506, lng: -73.9935 },
  "wall street": { lat: 40.7074, lng: -74.0113 },
  "union square": { lat: 40.7359, lng: -73.9911 },
  sfo: { lat: 37.6213, lng: -122.379 },
  lax: { lat: 33.9425, lng: -118.408 },
  "golden gate bridge": { lat: 37.8199, lng: -122.4783 },
  hollywood: { lat: 34.0928, lng: -118.3287 },
  "current location": { lat: 40.7484, lng: -73.9857 },
}

function addressToLocation(address: string): Location {
  const key = address.toLowerCase().trim()
  const match =
    KNOWN_LOCATIONS[key] ??
    Object.entries(KNOWN_LOCATIONS).find(
      ([k]) => key.includes(k) || k.includes(key)
    )?.[1]

  if (match) {
    return { ...match, address }
  }

  // Fallback: deterministic coordinates from address hash
  let hash = 0
  for (const char of address) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return {
    lat: 40.7 + (hash % 100) / 1000,
    lng: -74.0 + ((hash >> 8) % 100) / 1000,
    address,
  }
}

export { addressToLocation }

export function createRideTools(adapter: PlatformAdapter) {
  return {
    searchRides: tool({
      description:
        "Search for available ride options when the user wants to go somewhere. Use this when the user provides a pickup location and/or destination.",
      inputSchema: searchRidesSchema,
      async *execute({ pickup, destination }) {
        yield { state: "searching" as const, pickup, destination }

        const result = await adapter.getEstimates({
          pickup: addressToLocation(pickup),
          dropoff: addressToLocation(destination),
        })

        const rideOptions = result.products.map((p) => ({
          id: p.productId,
          name: p.name,
          description: descriptionFor(p.name),
          price: parseFloat(p.estimate.replace("$", "")),
          eta: `${p.etaMinutes} min`,
          duration: `${10 + Math.floor(Math.random() * 10)} min`,
          capacity: p.name === "UberXL" ? 6 : 4,
          type: typeFor(p.name),
          surgeMultiplier: p.surgeMultiplier,
          fareId: p.fareId,
        }))

        yield {
          state: "ready" as const,
          pickup,
          destination,
          rideOptions,
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
          status: status.status.toLowerCase(),
          eta: status.estimatedArrivalMinutes
            ? `${status.estimatedArrivalMinutes} min`
            : statusEta(status.status),
          driver: status.driver
            ? {
                name: status.driver.name,
                rating: status.driver.rating,
                car: status.vehicle
                  ? `${status.vehicle.make} ${status.vehicle.model}`
                  : "Unknown",
                plate: status.vehicle?.licensePlate ?? "",
              }
            : undefined,
        }
      },
    }),
  } as const
}

function descriptionFor(name: string): string {
  const descriptions: Record<string, string> = {
    UberX: "Affordable rides, all to yourself",
    Comfort: "Newer cars with extra legroom",
    UberXL: "Affordable rides for groups up to 6",
    "Uber Black": "Premium rides in luxury cars",
  }
  return descriptions[name] ?? "Standard ride"
}

function typeFor(name: string): "economy" | "comfort" | "premium" {
  if (name === "Uber Black") return "premium"
  if (name === "Comfort") return "comfort"
  return "economy"
}

function statusEta(status: string): string {
  const etas: Record<string, string> = {
    ARRIVING: "2 min away",
    ARRIVED: "Driver has arrived",
    IN_PROGRESS: "10 min to destination",
    PROCESSING: "Finding your driver...",
    ACCEPTED: "Driver assigned",
  }
  return etas[status] ?? ""
}
