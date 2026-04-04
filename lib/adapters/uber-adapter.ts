// Uber Adapter — pure translation layer between our PlatformAdapter contract
// and the Uber Guest Rides API (currently backed by mock server).
// Zero business logic. Zero state. Only type mapping.

import type {
  PlatformAdapter,
  EstimateResult,
  BookingResult,
  TripStatus,
  TripStatusCode,
  CancelResult,
  Location,
} from "./types"
import {
  createEstimate,
  createTrip,
  getTripStatus,
  cancelTrip,
} from "@/lib/mock-servers/uber/server"

// Map Uber's product_group → our platform-agnostic category
function mapProductGroup(
  uberGroup: string
): "economy" | "comfort" | "premium" {
  switch (uberGroup) {
    case "black":
      return "premium"
    case "comfort":
      return "comfort"
    default:
      return "economy"
  }
}

// Validate status from external source (Redis, API) against known values
const VALID_STATUSES: Set<string> = new Set([
  "processing", "no_drivers_available", "accepted", "arriving",
  "in_progress", "driver_canceled", "rider_canceled", "completed",
])

function validateStatus(status: string): TripStatusCode {
  return VALID_STATUSES.has(status) ? (status as TripStatusCode) : "processing"
}

// Map our Location → Uber's coordinate format
function toUberCoords(loc: Location) {
  return { latitude: loc.lat, longitude: loc.lng }
}

export class UberAdapter implements PlatformAdapter {
  name = "Uber"

  async getEstimates(params: {
    pickup: Location
    dropoff: Location
  }): Promise<EstimateResult> {
    const uberEstimates = await createEstimate(
      toUberCoords(params.pickup),
      toUberCoords(params.dropoff)
    )

    // TRANSLATE: UberEstimate[] → our ProductEstimate[]
    return {
      products: uberEstimates.map((e) => ({
        productId: e.product.product_id,
        name: e.product.display_name,
        description: e.product.description,
        shortDescription: e.product.short_description,
        capacity: e.product.capacity,
        productGroup: mapProductGroup(e.product.product_group),
        shared: e.product.shared,

        fareId: e.estimate_info.fare.fare_id,
        fareValue: e.estimate_info.fare.value,
        fareDisplay: e.estimate_info.fare.display,
        currencyCode: e.estimate_info.fare.currency_code,
        fareExpiresAt: e.estimate_info.fare.expires_at,

        surgeMultiplier: e.estimate?.surge_multiplier ?? 1,

        etaMinutes: e.estimate_info.pickup_estimate ?? 0,
        durationMinutes: Math.round(
          e.estimate_info.trip.duration_estimate / 60
        ),
        distanceMiles: e.estimate_info.trip.distance_estimate,

        noCarsAvailable: e.estimate_info.no_cars_available,
      })),
    }
  }

  async bookRide(params: {
    productId: string
    pickup: Location
    dropoff: Location
    fareId?: string
  }): Promise<BookingResult> {
    const uber = await createTrip(
      params.productId,
      toUberCoords(params.pickup),
      toUberCoords(params.dropoff),
      params.fareId
    )

    // We need the trip details for driver/vehicle — fetch immediately
    const trip = await getTripStatus(uber.request_id)

    // TRANSLATE: UberCreateTripResponse + UberTripResponse → our BookingResult
    return {
      tripId: uber.request_id,
      status: uber.status,
      estimatedPickupMinutes: uber.eta ?? 0,
      surgeMultiplier: uber.surge_multiplier,
      driver: {
        name: trip.driver?.name ?? "Finding driver...",
        rating: trip.driver?.rating ?? 0,
        phoneNumber: trip.driver?.phone_number ?? "",
      },
      vehicle: {
        make: trip.vehicle?.make ?? "",
        model: trip.vehicle?.model ?? "",
        color: trip.vehicle?.vehicle_color_name ?? "",
        licensePlate: trip.vehicle?.license_plate ?? "",
      },
    }
  }

  async trackRide(params: { tripId: string }): Promise<TripStatus> {
    const uber = await getTripStatus(params.tripId)

    // TRANSLATE: UberTripResponse → our TripStatus
    return {
      tripId: uber.request_id,
      status: validateStatus(uber.status),
      driver: uber.driver
        ? {
            name: uber.driver.name,
            rating: uber.driver.rating,
            phoneNumber: uber.driver.phone_number,
          }
        : undefined,
      vehicle: uber.vehicle
        ? {
            make: uber.vehicle.make,
            model: uber.vehicle.model,
            color: uber.vehicle.vehicle_color_name,
            licensePlate: uber.vehicle.license_plate,
          }
        : undefined,
      location: uber.location
        ? {
            lat: uber.location.latitude,
            lng: uber.location.longitude,
            bearing: uber.location.bearing,
          }
        : undefined,
      estimatedArrivalMinutes: uber.eta ?? undefined,
      surgeMultiplier: uber.surge_multiplier,
    }
  }

  async cancelRide(params: { tripId: string }): Promise<CancelResult> {
    const uber = await cancelTrip(params.tripId)

    // TRANSLATE: Uber cancel response → our CancelResult
    return {
      tripId: params.tripId,
      status: uber.status,
      cancellationFee: uber.cancellation_fee,
    }
  }
}
