import { notFound } from "next/navigation";
import { FormulaireUtilisateur } from "@/modules/users/vues";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { contextePage } from "@/server/page";

export const metadata = { title: "Modifier utilisateur - Sentinelle" };

export default async function UserEdit({ params }: { params: Promise<{ id: string }> }) {
  const page = await contextePage();
  await requireAdmin();
  const { id } = await params;
  const [user, roles] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.role.findMany({ orderBy: { id: "asc" } }),
  ]);
  if (!user) notFound();
  return <FormulaireUtilisateur user={user} roles={roles} csrf={page.csrf} nonce={page.nonce} />;
}
