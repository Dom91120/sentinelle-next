/**
 * Messages flash (port de `flash()` / `get_flashed_messages()` de Flask).
 *
 * Posés dans un cookie par les Server Actions, lus par le layout à la page
 * suivante, puis effacés par le composant client qui les affiche.
 */
import { cookies } from "next/headers";

export type FlashCategory = "success" | "danger" | "warning" | "info";
export type Flash = [FlashCategory, string];

const COOKIE = "sentinelle_flash";

function normaliser(cat: string): FlashCategory {
  return (["success", "danger", "warning", "info"] as const).includes(cat as FlashCategory)
    ? (cat as FlashCategory)
    : "info";
}

/** Ajoute un message à afficher sur la prochaine page. À appeler dans une Server Action ou une route. */
export async function flash(message: string, category: FlashCategory | string = "info"): Promise<void> {
  const jar = await cookies();
  let current: Flash[] = [];
  try {
    const raw = jar.get(COOKIE)?.value;
    if (raw) current = JSON.parse(raw) as Flash[];
  } catch {
    current = [];
  }
  current.push([normaliser(category), message]);
  jar.set(COOKIE, JSON.stringify(current.slice(-10)), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 300,
  });
}

/** Lit les messages en attente (sans les effacer : le rendu ne peut pas écrire de cookie). */
export async function readFlashes(): Promise<Flash[]> {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is Flash => Array.isArray(x) && x.length === 2 && typeof x[1] === "string")
      .map(([c, m]) => [normaliser(String(c)), m]);
  } catch {
    return [];
  }
}

/** Efface les messages (appelé par le client une fois affichés). */
export async function clearFlashes(): Promise<void> {
  const jar = await cookies();
  if (jar.get(COOKIE)) jar.delete(COOKIE);
}
