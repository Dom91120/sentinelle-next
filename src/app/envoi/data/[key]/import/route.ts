import { importCsv, isValid, SPECS } from "@/server/csv-io";
import { flash } from "@/server/flash";
import { requireUser } from "@/server/guards";
import { pasTrouve, redirection, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /data/<key>/import : import CSV dans une catégorie. */
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!isValid(key)) return pasTrouve();
  const endpoint = SPECS[key].listUrl;
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUser();
      if (!user.canEdit(key))
        return redirigerAvecMessage(
          endpoint,
          "Vous n'avez pas les droits pour importer dans cette categorie.",
          "danger",
        );
      const file = form.get("file");
      if (!file || typeof file === "string" || !file.name)
        return redirigerAvecMessage(endpoint, "Aucun fichier fourni.", "danger");
      let created = 0;
      let errors: string[] = [];
      try {
        [created, errors] = await importCsv(key, Buffer.from(await file.arrayBuffer()));
      } catch (e) {
        return redirigerAvecMessage(
          endpoint,
          `Import impossible : ${e instanceof Error ? e.message : String(e)}`,
          "danger",
        );
      }
      if (created) await flash(`${created} enregistrement(s) importe(s).`, "success");
      if (errors.length)
        await flash(
          `${errors.length} ligne(s) en erreur : ${errors.slice(0, 5).join(" | ")}`,
          "warning",
        );
      if (!created && !errors.length)
        await flash("Aucune ligne importee (fichier vide ou colonnes non reconnues).", "info");
      return redirection(endpoint);
    },
    endpoint,
  );
}
