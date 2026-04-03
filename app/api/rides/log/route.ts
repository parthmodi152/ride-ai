import { actionLog } from "@/lib/action-log/log"

export async function GET() {
  return Response.json(await actionLog.getAll())
}
