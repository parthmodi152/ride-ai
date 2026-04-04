import * as z from "zod"

export const searchRidesSchema = z.object({
  pickup: z
    .string()
    .optional()
    .describe(
      "The pickup location address. Omit to use the user's current location."
    ),
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
  fareId: z.string().optional().describe("Fare ID to lock the price"),
})

export const cancelRideSchema = z.object({
  bookingId: z.string().describe("The booking/trip ID to cancel"),
})

export const trackRideSchema = z.object({
  bookingId: z.string().describe("The booking/trip ID to track"),
})
