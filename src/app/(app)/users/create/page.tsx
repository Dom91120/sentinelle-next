import { FormulaireUtilisateur } from "@/modules/users/vues";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { contextePage } from "@/server/page";

export const metadata = { title: "Nouvel utilisateur - Sentinelle" };

export default async function UserCreate() {
  const page = await contextePage();
  await requireAdmin();
  const roles = await prisma.role.findMany({ orderBy: { id: "asc" } });
  return <FormulaireUtilisateur user={null} roles={roles} csrf={page.csrf} nonce={page.nonce} />;
}
