import { deposer } from "@/modules/documents/routes";
import { requireUser } from "@/server/guards";
import { traiterFormulaire } from "@/server/http";

/** POST /documents/upload */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => deposer(await requireUser(), form));
}
