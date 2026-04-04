import { listAllTrips } from "@/lib/mock-servers/uber/server"

// Normalize Uber-internal types to adapter-friendly shapes for the UI
export async function GET() {
  const uberTrips = await listAllTrips()

  const trips = uberTrips.map((t) => ({
    tripId: t.request_id,
    status: t.status,
    eta: t.eta,
    driver: t.driver
      ? { name: t.driver.name, rating: t.driver.rating }
      : undefined,
    vehicle: t.vehicle
      ? {
          make: t.vehicle.make,
          model: t.vehicle.model,
          color: t.vehicle.vehicle_color_name,
        }
      : undefined,
    pickup: { lat: t.pickup.latitude, lng: t.pickup.longitude },
    destination: {
      lat: t.destination.latitude,
      lng: t.destination.longitude,
    },
    surgeMultiplier: t.surge_multiplier,
  }))

  return Response.json(trips)
}
