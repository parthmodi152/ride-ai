import { openai } from "@ai-sdk/openai"
import {
  convertToModelMessages,
  InferUITools,
  stepCountIs,
  streamText,
  UIDataTypes,
  UIMessage,
  validateUIMessages,
} from "ai"
import { getAdapter } from "@/lib/adapters/registry"
import { createRideTools } from "@/lib/tools/ride-tools"
import { actionLogIntegration } from "@/lib/action-log/integration"
import { llmTelemetryIntegration } from "@/lib/telemetry/integration"

export const maxDuration = 30

export async function POST(req: Request) {
  const body = await req.json()
  const platform: string = body.platform ?? "uber-mock"
  const userLocation = body.userLocation as
    | { address: string; lat: number; lng: number }
    | undefined

  const adapter = getAdapter(platform)
  const tools = createRideTools(adapter, { userLocation })

  const messages = await validateUIMessages<
    UIMessage<never, UIDataTypes, InferUITools<typeof tools>>
  >({
    messages: body.messages,
    tools,
  })

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: `You are a helpful AI ride booking assistant for ${adapter.name}. Your job is to help users book rides.

When a user wants to go somewhere:
1. Use the searchRides tool to find available options
2. Present the options and help them choose
3. When they confirm a selection, use the bookRide tool to book it
4. If they want to cancel, use the cancelRide tool
5. If they want to track their ride, use the trackRide tool

Be conversational, friendly, and concise. When presenting ride options, briefly mention the best value and the premium option.

If the user provides just a destination without a pickup location, use their current location as the default pickup.`,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "ride-booking-chat",
      integrations: [
        actionLogIntegration({ tools }),
        llmTelemetryIntegration(),
      ],
    },
  })

  return result.toUIMessageStreamResponse()
}

// Re-export the message type for client-side usage
export type RideAgentMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<ReturnType<typeof createRideTools>>
>
