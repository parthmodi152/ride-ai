export interface Location {
  lat: number
  lng: number
  address: string
}

export interface ProductEstimate {
  productId: string
  name: string
  description: string
  shortDescription: string
  capacity: number
  productGroup: "economy" | "comfort" | "premium"
  image?: string
  shared: boolean

  // Pricing
  fareId: string
  fareValue: number
  fareDisplay: string
  currencyCode: string
  fareExpiresAt: number // Unix timestamp — fare valid for ~2 minutes

  // Surge
  surgeMultiplier: number

  // Time & distance estimates
  etaMinutes: number
  durationMinutes: number
  distanceMiles: number

  // Availability
  noCarsAvailable: boolean
}

export interface EstimateResult {
  products: ProductEstimate[]
}

export interface BookingResult {
  tripId: string
  status: string
  estimatedPickupMinutes: number
  surgeMultiplier: number
  driver: {
    name: string
    rating: number
    phoneNumber: string
  }
  vehicle: {
    make: string
    model: string
    color: string
    licensePlate: string
  }
}

export type TripStatusCode =
  | "processing"
  | "no_drivers_available"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "driver_canceled"
  | "rider_canceled"
  | "completed"

export interface TripStatus {
  tripId: string
  status: TripStatusCode
  driver?: {
    name: string
    rating: number
    phoneNumber: string
  }
  vehicle?: {
    make: string
    model: string
    color: string
    licensePlate: string
  }
  location?: {
    lat: number
    lng: number
    bearing: number
  }
  estimatedArrivalMinutes?: number
  surgeMultiplier?: number
  fare?: {
    value: number
    currencyCode: string
  }
}

export interface CancelResult {
  tripId: string
  status: "rider_canceled"
  cancellationFee?: number
}

export interface PlatformAdapter {
  name: string
  getEstimates(params: {
    pickup: Location
    dropoff: Location
  }): Promise<EstimateResult>
  bookRide(params: {
    productId: string
    pickup: Location
    dropoff: Location
    fareId?: string
  }): Promise<BookingResult>
  trackRide(params: { tripId: string }): Promise<TripStatus>
  cancelRide(params: { tripId: string }): Promise<CancelResult>
}
