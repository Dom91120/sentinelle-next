import { fragmentContrat } from "../route-commun";

/** GET /contracts/create?inline=1 (réécrit ici par le proxy) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return fragmentContrat(req, null, { software_id: url.searchParams.get("software_id") });
}
