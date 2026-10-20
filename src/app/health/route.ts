import { prisma } from "@/server/db";
import { json } from "@/server/http";

/** GET /health : l'app et la base répondent. 200/JSON quand tout va bien, 503 sinon. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const actif = { where: { isActive: true } };
    const [accounts, certificates, backups, tests, reviews, domains, updates] = await Promise.all([
      prisma.account.count(actif),
      prisma.certificate.count(actif),
      prisma.backup.count(actif),
      prisma.testTask.count(actif),
      prisma.accessReview.count(actif),
      prisma.domain.count(actif),
      prisma.systemUpdate.count(actif),
    ]);
    return json({ status: "ok", ts: new Date().toISOString(), counts: { accounts, certificates, backups, tests, reviews, domains, updates } });
  } catch (e) {
    return json({ status: "error", error: e instanceof Error ? e.message : String(e) }, 503);
  }
}
