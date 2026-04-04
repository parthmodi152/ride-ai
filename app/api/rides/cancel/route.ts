import { getAdapter } from "@/lib/adapters/registry"
import { actionLog } from "@/lib/action-log/log"

export async function POST(req: Request) {
  const { action, platform, tripId } = await req.json()

  const logInput = { platform, tripId }

  if (action === "decline") {
    await actionLog.append({
      type: "ride.cancel_declined",
      tool: "cancelRide",
      input: logInput,
    })
    return Response.json({ state: "kept" })
  }

  const adapter = getAdapter(platform)

  try {
    const result = await adapter.cancelRide({ tripId })

    await actionLog.append({
      type: "ride.cancelled",
      tool: "cancelRide",
      input: logInput,
      output: result,
    })

    return Response.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cancellation failed"

    await actionLog.append({
      type: "ride.cancel_declined",
      tool: "cancelRide",
      input: logInput,
      error: message,
    })

    return Response.json(
      { error: "cancel_failed", message },
      { status: 422 }
    )
  }
}
