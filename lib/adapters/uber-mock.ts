import type {
  PlatformAdapter,
  EstimateResult,
  BookingResult,
  TripStatus,
  CancelResult,
  Location,
} from "./types"

const trips = new Map<string, TripStatus>()

function randomId(): string {
  return `trip-${Math.random().toString(36).slice(2, 10)}`
}

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

const DRIVERS = [
  { name: "Alex M.", rating: 4.92 },
  { name: "Sarah K.", rating: 4.87 },
  { name: "James L.", rating: 4.95 },
]

const VEHICLES = [
  { make: "Toyota", model: "Camry", licensePlate: "7ABC123" },
  { make: "Honda", model: "Accord", licensePlate: "8XYZ789" },
  { make: "Tesla", model: "Model 3", licensePlate: "4EV5678" },
]

export class MockUberAdapter implements PlatformAdapter {
  name = "Uber (Mock)"

  private surgeActive = false

  enableSurge() {
    this.surgeActive = true
  }

  disableSurge() {
    this.surgeActive = false
  }

  async getEstimates(params: {
    pickup: Location
    dropoff: Location
  }): Promise<EstimateResult> {
    const distance = Math.sqrt(
      (params.pickup.lat - params.dropoff.lat) ** 2 +
        (params.pickup.lng - params.dropoff.lng) ** 2
    )
    const baseFare = Math.max(5, Math.round(distance * 1000 * 0.15))
    const surge = this.surgeActive ? 1.5 + Math.random() : 1.0

    return {
      products: [
        {
          productId: "uberx-001",
          name: "UberX",
          estimate: `$${(baseFare * surge).toFixed(2)}`,
          fareId: `fare-x-${Date.now()}`,
          surgeMultiplier: Math.round(surge * 10) / 10,
          etaMinutes: 3 + Math.floor(Math.random() * 5),
        },
        {
          productId: "comfort-002",
          name: "Comfort",
          estimate: `$${(baseFare * 1.3 * surge).toFixed(2)}`,
          fareId: `fare-c-${Date.now()}`,
          surgeMultiplier: Math.round(surge * 10) / 10,
          etaMinutes: 5 + Math.floor(Math.random() * 5),
        },
        {
          productId: "uberxl-003",
          name: "UberXL",
          estimate: `$${(baseFare * 1.5 * surge).toFixed(2)}`,
          fareId: `fare-xl-${Date.now()}`,
          surgeMultiplier: Math.round(surge * 10) / 10,
          etaMinutes: 5 + Math.floor(Math.random() * 5),
        },
        {
          productId: "black-004",
          name: "Uber Black",
          estimate: `$${(baseFare * 2.5 * surge).toFixed(2)}`,
          fareId: `fare-b-${Date.now()}`,
          surgeMultiplier: Math.round(surge * 10) / 10,
          etaMinutes: 7 + Math.floor(Math.random() * 8),
        },
      ],
    }
  }

  async bookRide(params: {
    productId: string
    pickup: Location
    dropoff: Location
    fareId?: string
  }): Promise<BookingResult> {
    const tripId = randomId()
    const trip: TripStatus = {
      tripId,
      status: "PROCESSING",
      driver: randomFrom(DRIVERS),
      vehicle: randomFrom(VEHICLES),
      estimatedArrivalMinutes: 3 + Math.floor(Math.random() * 5),
    }
    trips.set(tripId, trip)

    // Simulate status progression
    setTimeout(() => {
      const t = trips.get(tripId)
      if (t && t.status === "PROCESSING") t.status = "ACCEPTED"
    }, 2000)
    setTimeout(() => {
      const t = trips.get(tripId)
      if (t && t.status === "ACCEPTED") t.status = "ARRIVING"
    }, 5000)
    setTimeout(() => {
      const t = trips.get(tripId)
      if (t && t.status === "ARRIVING") t.status = "IN_PROGRESS"
    }, 8000)
    setTimeout(() => {
      const t = trips.get(tripId)
      if (t && t.status === "IN_PROGRESS") t.status = "COMPLETED"
    }, 15000)

    return {
      tripId,
      status: "PROCESSING",
      estimatedPickupMinutes: trip.estimatedArrivalMinutes!,
    }
  }

  async trackRide(params: { tripId: string }): Promise<TripStatus> {
    const trip = trips.get(params.tripId)
    if (!trip) throw new Error(`Trip ${params.tripId} not found`)
    return { ...trip }
  }

  async cancelRide(params: { tripId: string }): Promise<CancelResult> {
    const trip = trips.get(params.tripId)
    if (!trip) throw new Error(`Trip ${params.tripId} not found`)

    const fee =
      trip.status === "IN_PROGRESS"
        ? 5.0
        : trip.status === "ARRIVING"
          ? 2.5
          : undefined
    trip.status = "CANCELLED"

    return {
      tripId: params.tripId,
      cancelled: true,
      cancellationFee: fee,
    }
  }
}
