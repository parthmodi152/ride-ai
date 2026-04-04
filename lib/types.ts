export interface RideOption {
  id: string
  name: string
  description: string
  price: number
  eta: string
  duration: string
  distance?: string
  capacity: number
  type: string
  surgeMultiplier?: number
  fareId?: string
  fareDisplay?: string
  noCarsAvailable?: boolean
}

export interface Driver {
  name: string
  rating: number
  car: string
  plate: string
  phone?: string
  photo?: string
  location?: { lat: number; lng: number }
}

export interface Booking {
  id: string
  rideName: string
  price: number
  pickup: string
  destination: string
  driver: Omit<Driver, "photo" | "location">
  eta: string
  status: "processing" | "accepted" | "arriving" | "in_progress" | "completed" | "rider_canceled" | "driver_canceled"
}

export interface ActiveRide {
  id: string
  option: RideOption
  driver: Driver
  status: "processing" | "accepted" | "arriving" | "in_progress" | "completed" | "rider_canceled" | "driver_canceled"
  pickup: string
  destination: string
  eta: string
}
