import { actionLog } from "@/lib/action-log/log"

export async function GET() {
  return Response.json(actionLog.getAll())
}
