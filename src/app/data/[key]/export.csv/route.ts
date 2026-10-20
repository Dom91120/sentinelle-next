import { exportCsv, isValid, reponseCsv } from "@/server/csv-io";
import { requireUser } from "@/server/guards";
import { pasTrouve } from "@/server/http";

/** GET /data/<key>/export.csv */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!isValid(key)) return pasTrouve();
  const user = await requireUser();
  if (!user.canView(key)) return new Response("Forbidden", { status: 403 });
  return reponseCsv(await exportCsv(key), `sentinelle-${key}.csv`);
}
