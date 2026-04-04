import { getAdapter } from "@/lib/adapters/registry"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tripId = searchParams.get("tripId")
  const platform = searchParams.get("platform") ?? "uber-mock"

  if (!tripId) {
    return Response.json({ error: "tripId is required" }, { status: 400 })
  }

  const adapter = getAdapter(platform)

  try {
    const status = await adapter.trackRide({ tripId })
    return Response.json(status)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Trip not found"
    return Response.json({ error: message }, { status: 404 })
  }
}
