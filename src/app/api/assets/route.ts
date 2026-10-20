import { erreurSesame } from "@/server/api-cle";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { json } from "@/server/http";

/**
 * GET /api/assets : liste des applications (catalogue) exposée à Sesame. Auth : en-tête
 * `Authorization: Bearer <clé>`. Filtre optionnel `?type=application`. Réponse : tableau
 * {id, name, description, is_active, responsible, responsible_email} trié par nom.
 */
export async function GET(req: Request) {
  const cfg = await getSettings();
  const err = erreurSesame(req, cfg);
  if (err) return err;
  const atype = new URL(req.url).searchParams.get("type");
  // L'inventaire Logiciels métiers EST le catalogue d'applications exposé à Sesame. Seul 'application' (ou absent) renvoie des données.
  const rows =
    atype && atype !== "application"
      ? []
      : await prisma.software.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return json(
    rows.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || "",
      is_active: Boolean(s.isActive),
      responsible: s.responsible || "",
      responsible_email: s.responsibleEmail || "",
    })),
  );
}
