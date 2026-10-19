import { clearFlashes } from "@/server/flash";

/** Efface les messages flash affichés (appelé par flash-clear.js). */
export async function POST() {
  await clearFlashes();
  return new Response(null, { status: 204 });
}
