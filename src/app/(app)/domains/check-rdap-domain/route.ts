import { isoDate } from "@/lib/forms-util";
import { fetchDomainInfo } from "@/modules/domains/server";
import { reponseApi, requireEditApi } from "@/server/guards";
import { json } from "@/server/http";

/** GET /domains/check-rdap-domain?domain= : lecture RDAP à la volée pour pré-remplir le formulaire. */
export async function GET(req: Request) {
  return reponseApi(async () => {
    await requireEditApi("domains");
    const name = (new URL(req.url).searchParams.get("domain") ?? "").trim();
    if (!name) return json({ ok: false, error: "Renseignez d'abord le domaine." }, 400);
    try {
      const info = await fetchDomainInfo(name);
      return json({
        ok: true,
        expiry_date: info.expiryDate ? isoDate(info.expiryDate) : "",
        renewed_on: info.renewedOn ? isoDate(info.renewedOn) : "",
        registrar: info.registrar ?? "",
      });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}
