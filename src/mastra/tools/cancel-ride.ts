import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import type { PlatformAdapter } from '../adapters/types.js'

export const cancelRideTool = createTool({
  id: 'cancel-ride',
  description:
    'Cancels an active ride. Returns whether the cancellation was successful and any applicable cancellation fee. ' +
    'This action requires human approval because cancelling may incur a fee and cannot be undone.',
  inputSchema: z.object({
    tripId: z.string().describe('The trip ID of the ride to cancel'),
  }),
  outputSchema: z.object({
    tripId: z.string(),
    cancelled: z.boolean().describe('Whether the ride was successfully cancelled'),
    cancellationFee: z.number().optional().describe('Cancellation fee charged, if any'),
  }),
  requireApproval: true,
  execute: async ({ tripId }, context) => {
    const adapter = context?.requestContext?.get('adapter') as PlatformAdapter | undefined
    if (!adapter) {
      throw new Error('No platform adapter available. Ensure the adapter is set in the request context.')
    }

    const result = await adapter.cancelRide({ tripId })
    return result
  },
})
