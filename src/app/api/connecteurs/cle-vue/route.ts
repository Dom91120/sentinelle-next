import { cookies } from "next/headers";
import { CARTES_API, cookieNouvelleCle } from "@/modules/connecteurs/server";
import { reponseApi, requireAdminApi } from "@/server/guards";

/** POST /api/connecteurs/cle-vue : la clé affichée une fois l'a été, son cookie s'efface (appelé par la carte). */
export async function POST(req: Request) {
  return reponseApi(async () => {
    await requireAdminApi();
    const prefixe = (await req.text()).trim();
    if (prefixe in CARTES_API) (await cookies()).delete(cookieNouvelleCle(prefixe));
    return new Response(null, { status: 204 });
  });
}
