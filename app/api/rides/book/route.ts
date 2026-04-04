import { getAdapter } from "@/lib/adapters/registry"
import { addressToLocation } from "@/lib/tools/ride-tools"
import { actionLog } from "@/lib/action-log/log"

export async function POST(req: Request) {
  const { action, platform, productId, pickup, destination, fareId } =
    await req.json()

  const logInput = { platform, productId, pickup, destination, fareId }

  if (action === "decline") {
    await actionLog.append({
      type: "ride.booking_declined",
      tool: "bookRide",
      input: logInput,
    })
    return Response.json({ state: "declined" })
  }

  const adapter = getAdapter(platform)

  try {
    const result = await adapter.bookRide({
      productId,
      pickup: await addressToLocation(pickup),
      dropoff: await addressToLocation(destination),
      fareId,
    })

    await actionLog.append({
      type: "ride.booked",
      tool: "bookRide",
      input: logInput,
      output: result,
    })

    return Response.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Booking failed"

    await actionLog.append({
      type: "ride.booking_declined",
      tool: "bookRide",
      input: logInput,
      error: message,
    })

    return Response.json(
      { error: "booking_failed", message },
      { status: 422 }
    )
  }
}
