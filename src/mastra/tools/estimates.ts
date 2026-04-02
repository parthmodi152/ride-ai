import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import type { PlatformAdapter } from '../adapters/types.js'

const locationSchema = z.object({
  lat: z.number().describe('Latitude coordinate'),
  lng: z.number().describe('Longitude coordinate'),
  address: z.string().describe('Human-readable address'),
})

export const getEstimatesTool = createTool({
  id: 'get-estimates',
  description:
    'Gets fare estimates and available ride products for a trip between two locations. ' +
    'Returns a list of products with pricing, surge multiplier, and ETA. ' +
    'Use this tool after geocoding pickup and dropoff addresses to show the user their ride options.',
  inputSchema: z.object({
    pickup: locationSchema.describe('The pickup location'),
    dropoff: locationSchema.describe('The dropoff location'),
  }),
  outputSchema: z.object({
    products: z.array(
      z.object({
        productId: z.string(),
        name: z.string(),
        estimate: z.string(),
        fareId: z.string(),
        surgeMultiplier: z.number(),
        etaMinutes: z.number(),
      }),
    ),
  }),
  execute: async ({ pickup, dropoff }, context) => {
    const adapter = context?.requestContext?.get('adapter') as PlatformAdapter | undefined
    if (!adapter) {
      throw new Error('No platform adapter available. Ensure the adapter is set in the request context.')
    }

    const result = await adapter.getEstimates({ pickup, dropoff })
    return { products: result.products }
  },
})
