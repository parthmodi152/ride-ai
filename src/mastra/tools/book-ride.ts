import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import type { PlatformAdapter } from '../adapters/types.js'

const locationSchema = z.object({
  lat: z.number().describe('Latitude coordinate'),
  lng: z.number().describe('Longitude coordinate'),
  address: z.string().describe('Human-readable address'),
})

export const bookRideTool = createTool({
  id: 'book-ride',
  description:
    'Books a ride with the selected product. Requires the productId from get-estimates, plus pickup and dropoff locations. ' +
    'Optionally accepts a fareId to lock in an upfront fare. ' +
    'This action requires human approval because it initiates a real ride request and may incur charges.',
  inputSchema: z.object({
    productId: z.string().describe('The product/ride type ID from get-estimates'),
    pickup: locationSchema.describe('The pickup location'),
    dropoff: locationSchema.describe('The dropoff location'),
    fareId: z.string().optional().describe('Optional fare ID to lock in upfront pricing'),
  }),
  outputSchema: z.object({
    tripId: z.string().describe('The unique identifier for the booked trip'),
    status: z.string().describe('Current status of the trip'),
    estimatedPickupMinutes: z.number().describe('Estimated minutes until pickup arrives'),
  }),
  requireApproval: true,
  execute: async ({ productId, pickup, dropoff, fareId }, context) => {
    const adapter = context?.requestContext?.get('adapter') as PlatformAdapter | undefined
    if (!adapter) {
      throw new Error('No platform adapter available. Ensure the adapter is set in the request context.')
    }

    const result = await adapter.bookRide({ productId, pickup, dropoff, fareId })
    return result
  },
})
