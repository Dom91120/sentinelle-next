import { fetchCertInfo } from "@/server/cert-checker";
import { reponseApi, requireEditApi } from "@/server/guards";
import { json } from "@/server/http";

/** GET /certificates/check-domain?domain= : lit en direct le certificat d'un domaine (pré-remplissage du formulaire). */
export async function GET(req: Request) {
  return reponseApi(async () => {
    await requireEditApi("certificates");
    const domain = (new URL(req.url).searchParams.get("domain") ?? "").trim();
    if (!domain) return json({ ok: false, error: "Renseignez d'abord le domaine." }, 400);
    try {
      const info = await fetchCertInfo(domain);
      return json({
        ok: true,
        expiry_date: info.expiryDate.toISOString().slice(0, 10),
        issuer: info.issuer ?? "",
      });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}
