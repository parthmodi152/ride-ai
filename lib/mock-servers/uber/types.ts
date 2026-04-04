// Uber's internal API shapes — matches the Guest Rides OpenAPI spec.
// These are NOT our adapter types. They represent what Uber's server returns.

export interface UberCoordinates {
  latitude: number
  longitude: number
}

export interface UberProduct {
  product_id: string
  display_name: string
  description: string
  short_description: string
  product_group: string // "uberx" | "uberxl" | "black" | "comfort" etc.
  capacity: number
  shared: boolean
  image?: string
  cancellation?: {
    min_cancellation_fee: number
    cancellation_grace_period_threshold_sec: number
  }
}

export interface UberFare {
  fare_id: string
  value: number
  currency_code: string
  display: string
  expires_at: number // Unix timestamp
}

export interface UberEstimate {
  product: UberProduct
  estimate_info: {
    fare_id: string
    fare: UberFare
    pickup_estimate: number | null // minutes
    no_cars_available: boolean
    pricing_explanation?: string
    trip: {
      distance_unit: string
      distance_estimate: number
      duration_estimate: number // seconds
    }
  }
  fulfillment_indicator?: "GREEN" | "YELLOW" | "RED" | "UNKNOWN"
  estimate?: {
    surge_multiplier: number
    display: string
    low_estimate: number
    high_estimate: number
    currency_code: string
  }
}

export interface UberDriver {
  id: string
  name: string
  phone_number: string
  rating: number
  picture_url?: string
}

export interface UberVehicle {
  make: string
  model: string
  vehicle_color_name: string
  license_plate: string
  picture_url?: string
}

export interface UberCreateTripResponse {
  request_id: string
  product_id: string
  status: string
  eta: number | null // minutes
  surge_multiplier: number
}

export type UberTripStatus =
  | "processing"
  | "no_drivers_available"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "driver_canceled"
  | "rider_canceled"
  | "completed"

export interface UberTripResponse {
  request_id: string
  status: UberTripStatus
  eta: number | null // minutes until pickup/arrival
  driver?: UberDriver
  vehicle?: UberVehicle
  location?: {
    latitude: number
    longitude: number
    bearing: number
  }
  surge_multiplier: number
  fare?: {
    value: number
    currency_code: string
  }
  pickup: UberCoordinates
  destination: UberCoordinates
}

// Internal stored trip shape (what we persist in Redis)
export interface StoredTrip {
  request_id: string
  product_id: string
  created_at: number // Unix timestamp ms
  pickup: UberCoordinates
  destination: UberCoordinates
  driver: UberDriver
  vehicle: UberVehicle
  initial_eta: number // minutes
  surge_multiplier: number
  cancelled: boolean
}
