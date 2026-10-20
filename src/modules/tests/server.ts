/** Tests récurrents (port de app/tests.py). */
import { champ, idOuNull, parseDate, parseInt_ } from "@/lib/forms-util";
import { prisma } from "@/server/db";

export const VALID_STATUS = new Set(["pending", "success", "failed"]);

/** Le catalogue, pour rattacher une tâche à un logiciel. */
export async function softwareList() {
  return prisma.software.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function formContext() {
  return { softwareList: await softwareList() };
}

export type FormContext = Awaited<ReturnType<typeof formContext>>;

export function ajouterJours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Les champs d'un test depuis le formulaire (hors nom, validé à part). */
export function depuisFormulaire(f: FormData) {
  const lastPerformed = parseDate(f.get("last_performed"));
  const freq = parseInt_(f.get("frequency_days"), 90, 1) ?? 90;
  return {
    testType: champ(f, "test_type"),
    description: typeof f.get("description") === "string" ? (f.get("description") as string) : null,
    lastPerformed,
    nextDue: parseDate(f.get("next_due")),
    frequencyDays: freq,
    softwareId: idOuNull(f, "software_id"),
  };
}
