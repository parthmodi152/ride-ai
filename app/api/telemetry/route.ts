import { telemetryStore } from "@/lib/telemetry/store"

export async function GET() {
  return Response.json(telemetryStore.getAll())
}
