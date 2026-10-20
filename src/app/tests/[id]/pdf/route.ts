import { pdfTest } from "@/server/pdf-fiches";
import { routePdf } from "@/server/pdf-route";

/** GET /tests/<id>/pdf */
export const GET = routePdf(pdfTest);
