import { requireUser } from "@/server/guards";
import { reponsePdf } from "@/server/pdf";
import { buildPdf } from "@/server/pdf-report";

/** GET /rapport.pdf (dashboard.report_pdf) : bilan PDF avec les droits de l'utilisateur. */
export async function GET() {
  const user = await requireUser();
  const pdf = await buildPdf(user);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return reponsePdf(pdf, `sentinelle-bilan-${stamp}.pdf`);
}
