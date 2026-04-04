// Mock Uber Server — simulates Uber's Guest Rides API backend.
// Returns Uber-shaped responses (UberEstimate, UberTripResponse, etc.)
// All state is stored in Redis (or in-memory fallback).
// Status is computed from timestamps, not timers (serverless-compatible).

import type {
  UberCoordinates,
  UberEstimate,
  UberCreateTripResponse,
  UberTripResponse,
  UberTripStatus,
  UberDriver,
  UberVehicle,
  StoredTrip,
} from "./types"
import {
  storeFare,
  checkFare,
  storeTrip,
  getTrip,
  updateTrip,
  listTripIds,
} from "./store"

// ---------------------------------------------------------------------------
// Product catalog
// ---------------------------------------------------------------------------

const PRODUCTS = [
  {
    product_id: "a1111c8c-c720-46c3-8534-2fcdd730040d",
    display_name: "UberX",
    description: "Affordable rides, all to yourself",
    short_description: "Affordable",
    product_group: "uberx",
    capacity: 4,
    shared: false,
    fare_multiplier: 1.0,
    cancellation: {
      min_cancellation_fee: 5.0,
      cancellation_grace_period_threshold_sec: 120,
    },
  },
  {
    product_id: "b2222d9d-d831-57d4-9645-3gdee841151e",
    display_name: "Comfort",
    description: "Newer cars with extra legroom",
    short_description: "Extra legroom",
    product_group: "comfort",
    capacity: 4,
    shared: false,
    fare_multiplier: 1.3,
    cancellation: {
      min_cancellation_fee: 5.0,
      cancellation_grace_period_threshold_sec: 120,
    },
  },
  {
    product_id: "c3333e0e-e942-68e5-a756-4heff952262f",
    display_name: "UberXL",
    description: "Affordable rides for groups up to 6",
    short_description: "For groups",
    product_group: "uberxl",
    capacity: 6,
    shared: false,
    fare_multiplier: 1.5,
    cancellation: {
      min_cancellation_fee: 5.0,
      cancellation_grace_period_threshold_sec: 120,
    },
  },
  {
    product_id: "d4444f1f-fa53-79f6-b867-5ig00a63373g",
    display_name: "Uber Black",
    description: "Premium rides in luxury cars",
    short_description: "Premium",
    product_group: "black",
    capacity: 4,
    shared: false,
    fare_multiplier: 2.5,
    cancellation: {
      min_cancellation_fee: 10.0,
      cancellation_grace_period_threshold_sec: 300,
    },
  },
]

const DRIVERS: UberDriver[] = [
  { id: "drv-001", name: "Alex M.", phone_number: "(555) 012-3456", rating: 4.92 },
  { id: "drv-002", name: "Sarah K.", phone_number: "(555) 234-5678", rating: 4.87 },
  { id: "drv-003", name: "James L.", phone_number: "(555) 456-7890", rating: 4.95 },
  { id: "drv-004", name: "Maria R.", phone_number: "(555) 678-9012", rating: 4.89 },
]

const VEHICLES: UberVehicle[] = [
  { make: "Toyota", model: "Camry", vehicle_color_name: "White", license_plate: "7ABC123" },
  { make: "Honda", model: "Accord", vehicle_color_name: "Black", license_plate: "8XYZ789" },
  { make: "Tesla", model: "Model 3", vehicle_color_name: "Silver", license_plate: "4EV5678" },
  { make: "BMW", model: "5 Series", vehicle_color_name: "Black", license_plate: "9LUX321" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

function haversineDistance(a: UberCoordinates, b: UberCoordinates): number {
  const R = 3958.8 // Earth's radius in miles
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinLng *
      sinLng
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// ---------------------------------------------------------------------------
// Geocoding — Google Places API with hardcoded fallback
// ---------------------------------------------------------------------------

const KNOWN_LOCATIONS: Record<string, UberCoordinates> = {
  "times square": { latitude: 40.758, longitude: -73.9855 },
  "jfk airport": { latitude: 40.6413, longitude: -73.7781 },
  jfk: { latitude: 40.6413, longitude: -73.7781 },
  laguardia: { latitude: 40.7772, longitude: -73.8726 },
  lga: { latitude: 40.7772, longitude: -73.8726 },
  "central park": { latitude: 40.7829, longitude: -73.9654 },
  "brooklyn bridge": { latitude: 40.7061, longitude: -73.9969 },
  "empire state building": { latitude: 40.7484, longitude: -73.9857 },
  "grand central": { latitude: 40.7527, longitude: -73.9772 },
  "penn station": { latitude: 40.7506, longitude: -73.9935 },
  "wall street": { latitude: 40.7074, longitude: -74.0113 },
  "union square": { latitude: 40.7359, longitude: -73.9911 },
  sfo: { latitude: 37.6213, longitude: -122.379 },
  lax: { latitude: 33.9425, longitude: -118.408 },
  "golden gate bridge": { latitude: 37.8199, longitude: -122.4783 },
  hollywood: { latitude: 34.0928, longitude: -118.3287 },
}

// Service area center — used to bias Google Places results
// In production, this would be dynamic based on the user's region
const SERVICE_AREA = { latitude: 40.7484, longitude: -73.9857 } // NYC
const MAX_SERVICE_RADIUS_MILES = 30 // Reject results beyond this distance

async function geocodeWithGoogle(
  address: string
): Promise<UberCoordinates | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.location,places.displayName,places.formattedAddress",
        },
        body: JSON.stringify({
          textQuery: address,
          locationBias: {
            circle: {
              center: SERVICE_AREA,
              radius: MAX_SERVICE_RADIUS_MILES * 1609.34, // miles to meters
            },
          },
        }),
      }
    )
    const data = await res.json()
    const place = data.places?.[0]
    if (!place?.location) return null

    // Verify result is within service area
    const distance = haversineDistance(
      SERVICE_AREA,
      { latitude: place.location.latitude, longitude: place.location.longitude }
    )
    if (distance > MAX_SERVICE_RADIUS_MILES) return null

    return {
      latitude: place.location.latitude,
      longitude: place.location.longitude,
    }
  } catch {
    return null
  }
}

export async function geocodeAddress(
  address: string
): Promise<UberCoordinates> {
  // Try Google Places API first (real geocoding)
  const google = await geocodeWithGoogle(address)
  if (google) return google

  // Fallback to hardcoded landmarks when Google is unavailable
  const key = address.toLowerCase().trim()
  const exact = KNOWN_LOCATIONS[key]
  if (exact) return exact

  for (const [k, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (key.includes(k) || k.includes(key)) return coords
  }

  // No match found
  throw new Error(`Could not find location: "${address}"`)
}

// ---------------------------------------------------------------------------
// Compute trip status from elapsed time (no timers)
// ---------------------------------------------------------------------------

const STATUS_THRESHOLDS: Array<{ maxSeconds: number; status: UberTripStatus }> =
  [
    { maxSeconds: 3, status: "processing" },
    { maxSeconds: 10, status: "accepted" },
    { maxSeconds: 20, status: "arriving" },
    { maxSeconds: 60, status: "in_progress" },
  ]

function computeStatus(trip: StoredTrip): {
  status: UberTripStatus
  eta: number | null
} {
  if (trip.cancelled) {
    return { status: "rider_canceled", eta: null }
  }

  const elapsedSec = (Date.now() - trip.created_at) / 1000

  for (const threshold of STATUS_THRESHOLDS) {
    if (elapsedSec < threshold.maxSeconds) {
      let eta: number | null = null
      switch (threshold.status) {
        case "processing":
          eta = trip.initial_eta
          break
        case "accepted":
          eta = Math.max(1, trip.initial_eta - 1)
          break
        case "arriving":
          eta = 1
          break
        case "in_progress":
          eta = null
          break
      }
      return { status: threshold.status, eta }
    }
  }

  return { status: "completed", eta: null }
}

function computeLocation(
  trip: StoredTrip,
  status: UberTripStatus
): { latitude: number; longitude: number; bearing: number } | undefined {
  if (status === "processing") return undefined

  if (status === "completed") {
    return {
      latitude: trip.destination.latitude,
      longitude: trip.destination.longitude,
      bearing: 0,
    }
  }

  // Deterministic driver start point ~2km from pickup
  // Uses request_id hash so position is stable between polls
  const hash =
    trip.request_id.charCodeAt(0) + trip.request_id.charCodeAt(1)
  const angle = (hash % 360) * (Math.PI / 180)
  const offset = 0.02 // ~2km in degrees
  const driverStart = {
    latitude: trip.pickup.latitude + Math.cos(angle) * offset,
    longitude: trip.pickup.longitude + Math.sin(angle) * offset,
  }

  let from: { latitude: number; longitude: number }
  let to: { latitude: number; longitude: number }
  let progress: number

  switch (status) {
    case "accepted":
      from = driverStart
      to = trip.pickup
      progress = 0.3
      break
    case "arriving":
      from = driverStart
      to = trip.pickup
      progress = 0.9
      break
    case "in_progress":
      from = trip.pickup
      to = trip.destination
      progress = 0.5
      break
    default:
      return undefined
  }

  const bearing =
    Math.atan2(
      to.longitude - from.longitude,
      to.latitude - from.latitude
    ) * (180 / Math.PI)

  return {
    latitude: from.latitude + (to.latitude - from.latitude) * progress,
    longitude:
      from.longitude + (to.longitude - from.longitude) * progress,
    bearing: (bearing + 360) % 360,
  }
}

// ---------------------------------------------------------------------------
// API: Create Estimate
// ---------------------------------------------------------------------------

const FARE_PER_MILE = 2.5
const MAX_TRIP_DISTANCE_MILES = 50

export async function createEstimate(
  pickup: UberCoordinates,
  dropoff: UberCoordinates
): Promise<UberEstimate[]> {
  const distance = haversineDistance(pickup, dropoff)

  if (distance > MAX_TRIP_DISTANCE_MILES) {
    throw new Error(
      `Trip distance (${Math.round(distance)} miles) exceeds the ${MAX_TRIP_DISTANCE_MILES}-mile limit. Please choose a closer destination.`
    )
  }

  const baseFare = Math.max(5, distance * FARE_PER_MILE)

  // Surge pricing — 20% chance, simulating demand-based pricing
  // 50% chance of surge for demo visibility (production would be demand-based)
  const surgeActive = Math.random() < 0.5
  const surge = surgeActive ? 1.3 + Math.random() * 1.2 : 1.0
  const surgeRounded = Math.round(surge * 10) / 10
  const durationSeconds = Math.max(300, Math.round(distance * 2 * 60)) // ~2 min/mile

  const estimates: UberEstimate[] = []

  for (const product of PRODUCTS) {
    const fare = Math.round(baseFare * product.fare_multiplier * surge * 100) / 100
    const fareId = crypto.randomUUID()

    // Store fare with 2-minute TTL
    await storeFare(fareId)

    const pickupEta =
      product.product_group === "black"
        ? 7 + Math.floor(Math.random() * 8)
        : 3 + Math.floor(Math.random() * 5)

    const noCarsAvailable =
      product.product_group === "black" && Math.random() < 0.3

    estimates.push({
      product: {
        product_id: product.product_id,
        display_name: product.display_name,
        description: product.description,
        short_description: product.short_description,
        product_group: product.product_group,
        capacity: product.capacity,
        shared: product.shared,
        cancellation: product.cancellation,
      },
      estimate_info: {
        fare_id: fareId,
        fare: {
          fare_id: fareId,
          value: fare,
          currency_code: "USD",
          display: `$${fare.toFixed(2)}`,
          expires_at: Date.now() + 120_000,
        },
        pickup_estimate: noCarsAvailable ? null : pickupEta,
        no_cars_available: noCarsAvailable,
        pricing_explanation: surgeActive
          ? "Fares are higher due to increased demand"
          : undefined,
        trip: {
          distance_unit: "mile",
          distance_estimate: Math.round(distance * 10) / 10,
          duration_estimate: durationSeconds,
        },
      },
      fulfillment_indicator: noCarsAvailable ? "RED" : "GREEN",
      estimate: {
        surge_multiplier: surgeRounded,
        display: `$${fare.toFixed(2)}`,
        low_estimate: Math.round(fare * 0.9 * 100) / 100,
        high_estimate: Math.round(fare * 1.1 * 100) / 100,
        currency_code: "USD",
      },
    })
  }

  return estimates
}

// ---------------------------------------------------------------------------
// API: Create Trip
// ---------------------------------------------------------------------------

export async function createTrip(
  productId: string,
  pickup: UberCoordinates,
  dropoff: UberCoordinates,
  fareId?: string
): Promise<UberCreateTripResponse> {
  // Check for existing active trip
  const ACTIVE_STATUSES: UberTripStatus[] = [
    "processing",
    "accepted",
    "arriving",
    "in_progress",
  ]
  const tripIds = await listTripIds()
  for (const id of tripIds) {
    const existing = await getTrip(id)
    if (existing) {
      const { status } = computeStatus(existing)
      if (ACTIVE_STATUSES.includes(status)) {
        throw new Error(
          "You already have an active ride. Complete or cancel it before booking another."
        )
      }
    }
  }

  // Validate fare expiry
  if (fareId) {
    const valid = await checkFare(fareId)
    if (!valid) {
      throw new Error(
        "Fare has expired. Please request a new estimate."
      )
    }
  }

  const requestId = crypto.randomUUID()
  const driver = randomFrom(DRIVERS)
  const vehicle = randomFrom(VEHICLES)
  const eta = 3 + Math.floor(Math.random() * 5)

  const trip: StoredTrip = {
    request_id: requestId,
    product_id: productId,
    created_at: Date.now(),
    pickup,
    destination: dropoff,
    driver,
    vehicle,
    initial_eta: eta,
    surge_multiplier: 1.0,
    cancelled: false,
  }

  await storeTrip(trip)

  return {
    request_id: requestId,
    product_id: productId,
    status: "processing",
    eta,
    surge_multiplier: trip.surge_multiplier,
  }
}

// ---------------------------------------------------------------------------
// API: Get Trip
// ---------------------------------------------------------------------------

export async function getTripStatus(
  requestId: string
): Promise<UberTripResponse> {
  const trip = await getTrip(requestId)
  if (!trip) {
    throw new Error(`Trip ${requestId} not found`)
  }

  const { status, eta } = computeStatus(trip)
  const location = computeLocation(trip, status)

  return {
    request_id: trip.request_id,
    status,
    eta,
    driver: trip.driver,
    vehicle: trip.vehicle,
    location,
    surge_multiplier: trip.surge_multiplier,
    fare: undefined, // Only populated after completion in real API
    pickup: trip.pickup,
    destination: trip.destination,
  }
}

// ---------------------------------------------------------------------------
// API: Cancel Trip
// ---------------------------------------------------------------------------

export async function cancelTrip(
  requestId: string
): Promise<{ status: "rider_canceled"; cancellation_fee?: number }> {
  const trip = await getTrip(requestId)
  if (!trip) {
    throw new Error(`Trip ${requestId} not found`)
  }

  const { status } = computeStatus(trip)

  // Cannot cancel trips that have ended
  if (["completed", "rider_canceled", "driver_canceled"].includes(status)) {
    throw new Error(`Cannot cancel trip — ride is already ${status.replace("_", " ")}`)
  }

  // Cannot cancel in-progress trips via API
  if (status === "in_progress") {
    throw new Error(
      "Cannot cancel a trip that is in progress. Please contact the driver directly."
    )
  }

  // Fee based on current status
  const fee = status === "arriving" ? 2.5 : undefined

  trip.cancelled = true
  await updateTrip(trip)

  return {
    status: "rider_canceled",
    cancellation_fee: fee,
  }
}

// ---------------------------------------------------------------------------
// API: List All Trips
// ---------------------------------------------------------------------------

export async function listAllTrips(): Promise<UberTripResponse[]> {
  const tripIds = await listTripIds()
  const trips: UberTripResponse[] = []

  for (const id of tripIds) {
    const trip = await getTrip(id)
    if (!trip) continue

    const { status, eta } = computeStatus(trip)
    const location = computeLocation(trip, status)

    trips.push({
      request_id: trip.request_id,
      status,
      eta,
      driver: trip.driver,
      vehicle: trip.vehicle,
      location,
      surge_multiplier: trip.surge_multiplier,
      fare: undefined,
      pickup: trip.pickup,
      destination: trip.destination,
    })
  }

  return trips
}
