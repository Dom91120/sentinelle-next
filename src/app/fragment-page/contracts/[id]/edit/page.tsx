import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { idDe } from "@/server/http";
import { FragmentContrat } from "../../page-commun";

/** La page-support du fragment /contracts/<id>/edit?inline=1 (cf. server/fragment.ts). */
export default async function PageFragmentEdition({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const id = idDe((await params).id);
  if (!id) notFound();
  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) notFound();
  const p = await searchParams;
  return (
    <FragmentContrat contract={contract} erreur={typeof p.erreur === "string" ? p.erreur : null} />
  );
}
