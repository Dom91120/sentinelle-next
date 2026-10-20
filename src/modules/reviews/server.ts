/** Revues de droits (port de app/reviews.py). */
import { champ, champOuNull, parseDate, parseInt_ } from "@/lib/forms-util";
import { prisma } from "@/server/db";

/** Suggestions issues de l'inventaire Logiciels métiers. */
export async function appAssets() {
  return prisma.software.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function formContext() {
  return { assets: await appAssets() };
}

export type FormContext = Awaited<ReturnType<typeof formContext>>;

/** La fiche logiciel que désigne ce nom (casse ignorée ; deux homonymes actifs : aucune). */
export async function logicielParNom(nom: string): Promise<{ id: number; name: string } | null> {
  if (!nom) return null;
  const candidats = await prisma.software.findMany({ where: { isActive: true, name: { equals: nom, mode: "insensitive" } }, select: { id: true, name: true } });
  return candidats.length === 1 ? candidats[0] : null;
}

export function ajouterJours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Les champs d'une revue depuis le formulaire (application validée à part). */
export async function depuisFormulaire(f: FormData, application: string) {
  const logiciel = await logicielParNom(application);
  return {
    application: logiciel ? logiciel.name : application,
    softwareId: logiciel ? logiciel.id : null,
    responsible: champOuNull(f, "responsible"),
    responsibleEmail: champOuNull(f, "responsible_email"),
    scope: typeof f.get("scope") === "string" ? (f.get("scope") as string) : null,
    frequencyDays: parseInt_(f.get("frequency_days"), 365, 1) ?? 365,
    lastReview: parseDate(f.get("last_review")),
    nextReview: parseDate(f.get("next_review")),
  };
}

export function applicationDe(f: FormData): string {
  return champ(f, "application");
}
