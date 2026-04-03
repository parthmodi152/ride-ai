export interface RideOption {
  id: string
  name: string
  description: string
  price: number
  eta: string
  duration: string
  capacity: number
  type: "economy" | "comfort" | "premium"
}

export interface Driver {
  name: string
  rating: number
  car: string
  plate: string
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
  status: "arriving" | "arrived" | "in_progress" | "completed"
}

export interface ActiveRide {
  id: string
  option: RideOption
  driver: Driver
  status: "arriving" | "arrived" | "in_progress" | "completed"
  pickup: string
  destination: string
  eta: string
}
