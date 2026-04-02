import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import type { PlatformAdapter } from '../adapters/types.js'

export const trackRideTool = createTool({
  id: 'track-ride',
  description:
    'Tracks the current status of an active ride. Returns the trip status, and optionally driver details, vehicle info, and estimated arrival time. ' +
    'Use this tool when the user asks about their ride status, driver location, or ETA after booking.',
  inputSchema: z.object({
    tripId: z.string().describe('The trip ID returned from book-ride'),
  }),
  outputSchema: z.object({
    tripId: z.string(),
    status: z.string().describe('Current trip status (PROCESSING, ACCEPTED, ARRIVING, IN_PROGRESS, COMPLETED, CANCELLED)'),
    driver: z
      .object({
        name: z.string(),
        rating: z.number(),
      })
      .optional()
      .describe('Driver information, if assigned'),
    vehicle: z
      .object({
        make: z.string(),
        model: z.string(),
        licensePlate: z.string(),
      })
      .optional()
      .describe('Vehicle information, if assigned'),
    estimatedArrivalMinutes: z.number().optional().describe('Estimated minutes until arrival'),
  }),
  execute: async ({ tripId }, context) => {
    const adapter = context?.requestContext?.get('adapter') as PlatformAdapter | undefined
    if (!adapter) {
      throw new Error('No platform adapter available. Ensure the adapter is set in the request context.')
    }

    const result = await adapter.trackRide({ tripId })
    return result
  },
})
