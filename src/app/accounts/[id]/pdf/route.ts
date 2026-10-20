import { pdfCompte } from "@/server/pdf-fiches";
import { routePdf } from "@/server/pdf-route";

/** GET /accounts/<id>/pdf */
export const GET = routePdf(pdfCompte);
