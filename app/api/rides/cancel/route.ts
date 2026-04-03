import { getAdapter } from "@/lib/adapters/registry"
import { actionLog } from "@/lib/action-log/log"

export async function POST(req: Request) {
  const { action, platform, tripId } = await req.json()

  const logInput = { platform, tripId }

  if (action === "decline") {
    actionLog.append({
      type: "ride.cancel_declined",
      tool: "cancelRide",
      input: logInput,
    })
    return Response.json({ state: "kept" })
  }

  const adapter = getAdapter(platform)
  const result = await adapter.cancelRide({ tripId })

  actionLog.append({
    type: "ride.cancelled",
    tool: "cancelRide",
    input: logInput,
    output: result,
  })

  return Response.json(result)
}
