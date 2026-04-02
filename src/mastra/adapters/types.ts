export interface Location {
  lat: number
  lng: number
  address: string
}

export interface ProductEstimate {
  productId: string
  name: string
  estimate: string
  fareId: string
  surgeMultiplier: number
  etaMinutes: number
}

export interface EstimateResult {
  products: ProductEstimate[]
}

export interface BookingResult {
  tripId: string
  status: string
  estimatedPickupMinutes: number
}

export interface TripStatus {
  tripId: string
  status: 'PROCESSING' | 'ACCEPTED' | 'ARRIVING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  driver?: { name: string; rating: number }
  vehicle?: { make: string; model: string; licensePlate: string }
  estimatedArrivalMinutes?: number
}

export interface CancelResult {
  tripId: string
  cancelled: boolean
  cancellationFee?: number
}

export interface PlatformAdapter {
  name: string
  getEstimates(params: { pickup: Location; dropoff: Location }): Promise<EstimateResult>
  bookRide(params: { productId: string; pickup: Location; dropoff: Location; fareId?: string }): Promise<BookingResult>
  trackRide(params: { tripId: string }): Promise<TripStatus>
  cancelRide(params: { tripId: string }): Promise<CancelResult>
}
