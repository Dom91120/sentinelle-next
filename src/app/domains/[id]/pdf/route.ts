import { pdfDomaine } from "@/server/pdf-fiches";
import { routePdf } from "@/server/pdf-route";

/** GET /domains/<id>/pdf */
export const GET = routePdf(pdfDomaine);
