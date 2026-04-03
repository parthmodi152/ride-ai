import * as z from "zod"

export const searchRidesSchema = z.object({
  pickup: z.string().describe("The pickup location"),
  destination: z.string().describe("The destination"),
})

export const bookRideSchema = z.object({
  rideId: z
    .string()
    .describe("The product ID of the ride option to book"),
  rideName: z
    .string()
    .describe("The name of the ride (e.g., UberX, Comfort)"),
  price: z.number().describe("The price of the ride"),
  pickup: z.string().describe("The pickup location"),
  destination: z.string().describe("The destination"),
  eta: z.string().describe("Estimated time of arrival for pickup"),
  fareId: z.string().optional().describe("Fare ID to lock the price"),
})

export const cancelRideSchema = z.object({
  bookingId: z.string().describe("The booking/trip ID to cancel"),
  rideName: z.string().describe("The name of the ride being cancelled"),
})

export const trackRideSchema = z.object({
  bookingId: z.string().describe("The booking/trip ID to track"),
})
