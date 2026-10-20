import { agendaItems, construireIcs } from "@/server/agenda";
import { prisma } from "@/server/db";
import { getCurrentUser, loadUser } from "@/server/guards";
import { redirection } from "@/server/http";

/**
 * GET /agenda.ics : flux iCalendar des échéances. Connecté (téléchargement) ou
 * ?token=<jeton personnel> (abonnement calendrier, sans session).
 */
export async function GET(req: Request) {
  const token = (new URL(req.url).searchParams.get("token") ?? "").trim();
  let user = null;
  if (token) {
    const row = await prisma.user.findFirst({ where: { icsToken: token }, select: { id: true } });
    if (!row) return new Response("Forbidden", { status: 403 });
    user = await loadUser(row.id);
    if (!user) return new Response("Forbidden", { status: 403 });
  } else {
    user = await getCurrentUser();
    if (!user) return redirection("/login?next=%2Fagenda.ics");
  }
  const [, items] = await agendaItems(user);
  const base = (user.settings.APP_BASE_URL ?? "").replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": "no-cache",
  };
  if (!token) headers["Content-Disposition"] = 'attachment; filename="sentinelle-agenda.ics"';
  return new Response(construireIcs(items, base), { headers });
}
