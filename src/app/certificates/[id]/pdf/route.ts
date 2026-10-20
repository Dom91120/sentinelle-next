import { pdfCertificat } from "@/server/pdf-fiches";
import { routePdf } from "@/server/pdf-route";

/** GET /certificates/<id>/pdf */
export const GET = routePdf(pdfCertificat);
