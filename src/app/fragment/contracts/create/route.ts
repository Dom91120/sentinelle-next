import { parseInt_ } from "@/lib/forms-util";
import { fragmentContrat } from "../route-commun";

/** GET /contracts/create?inline=1 (réécrit ici par le proxy) */
export async function GET(req: Request) {
  const sid = parseInt_(new URL(req.url).searchParams.get("software_id"), null);
  return fragmentContrat(null, sid ? [sid] : []);
}
