import { parseInt_ } from "@/lib/forms-util";
import { FragmentContrat } from "../page-commun";

/** La page-support du fragment /contracts/create?inline=1 (cf. server/fragment.ts). */
export default async function PageFragmentCreation({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const sid = parseInt_(typeof p.software_id === "string" ? p.software_id : null, null);
  const erreur = typeof p.erreur === "string" ? p.erreur : null;
  return <FragmentContrat contract={null} logicielsChoisis={sid ? [sid] : []} erreur={erreur} />;
}
