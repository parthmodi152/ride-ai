export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")

  if (!lat || !lng) {
    return Response.json({ error: "lat and lng required" }, { status: 400 })
  }

  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    return Response.json({ address: `${lat}, ${lng}` })
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`
    )
    const data = await res.json()
    const address =
      data.results?.[0]?.formatted_address ?? `${lat}, ${lng}`
    return Response.json({ address })
  } catch {
    return Response.json({ address: `${lat}, ${lng}` })
  }
}
