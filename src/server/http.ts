/**
 * Les gestionnaires de formulaires (route.ts sous src/app/envoi) : jeton CSRF,
 * lecture du formulaire, redirection « à la Flask » (303 vers la page suivante,
 * message flash dans le cookie).
 */
import { timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { type FlashCategory, flash } from "@/server/flash";

export const CSRF_COOKIE = "sentinelle_csrf";

/** Le jeton CSRF de la requête courante (à recopier dans les formulaires). */
export async function csrfToken(): Promise<string> {
  const h = await headers();
  const neuf = h.get("x-csrf-token");
  if (neuf) return neuf;
  return (await cookies()).get(CSRF_COOKIE)?.value ?? "";
}

function egal(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Vérifie le jeton CSRF d'un formulaire (champ `csrf_token` ou en-tête `X-CSRFToken`). */
export async function verifierCsrf(req: Request, form?: FormData | null): Promise<boolean> {
  const attendu = (await cookies()).get(CSRF_COOKIE)?.value ?? "";
  if (!attendu) return false;
  const fourni = (form?.get("csrf_token") as string | null) ?? req.headers.get("x-csrftoken") ?? "";
  if (!fourni || !egal(fourni, attendu)) return false;
  // Origine : même règle que Better Auth (anti-CSRF inter-sites).
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Redirection 303 (après un POST), avec l'ancre éventuelle. */
export function redirection(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

/** Redirection précédée d'un message flash. */
export async function redirigerAvecMessage(
  location: string,
  message: string,
  category: FlashCategory | string = "success",
): Promise<Response> {
  await flash(message, category);
  return redirection(location);
}

/** Le `request.referrer or url_for(...)` de Flask. */
export function referer(req: Request, repli: string): string {
  const r = req.headers.get("referer");
  if (!r) return repli;
  try {
    const u = new URL(r);
    return u.pathname + u.search + u.hash;
  } catch {
    return repli;
  }
}

/** Lit le formulaire (urlencoded ou multipart) ; null si le corps n'en est pas un. */
export async function lireFormulaire(req: Request): Promise<FormData | null> {
  try {
    return await req.formData();
  } catch {
    return null;
  }
}

/** Réponse JSON courte. */
export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

/**
 * Enveloppe d'un gestionnaire POST de formulaire : CSRF vérifié, formulaire lu,
 * erreur imprévue journalisée et transformée en message à l'écran.
 */
export async function traiterFormulaire(
  req: Request,
  fn: (form: FormData) => Promise<Response>,
  retourErreur = "/",
): Promise<Response> {
  const form = await lireFormulaire(req);
  if (!(await verifierCsrf(req, form))) {
    return new Response("Jeton CSRF invalide ou expiré. Rechargez la page et réessayez.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  try {
    return await fn(form ?? new FormData());
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect()/notFound() de Next
    console.error("[formulaire] erreur :", e);
    return redirigerAvecMessage(
      referer(req, retourErreur),
      "Une erreur est survenue. L'action n'a pas été enregistrée.",
      "danger",
    );
  }
}

/** Identifiant entier d'un paramètre de route ; null sinon. */
export function idDe(raw: string | undefined): number | null {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Réponse 404 texte, comme `abort(404)`. */
export function pasTrouve(): Response {
  return new Response("Not Found", { status: 404 });
}

/** L'adresse IP source, pour l'anti-bruteforce (dernière entrée de X-Forwarded-For). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",").at(-1)?.trim() || h.get("x-real-ip") || "";
}
