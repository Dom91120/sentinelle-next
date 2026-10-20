import { importWorkbook } from "@/modules/inventory/server";
import { auditRecord } from "@/server/audit";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /inventory/import : import d'un classeur Excel. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("inventory");
    const file = form.get("file");
    if (!(file instanceof File) || !/\.(xlsx|xlsm)$/i.test(file.name)) return redirigerAvecMessage("/inventory/import", "Veuillez fournir un fichier Excel (.xlsx).", "danger");
    try {
      const [created, report] = await importWorkbook(Buffer.from(await file.arrayBuffer()));
      await auditRecord("import inventaire", `${created} equipement(s)`, "inventory", user.username);
      invalidateNavCounts();
      return redirigerAvecMessage("/inventory", `${created} équipement(s) importé(s). ${report}`, "success");
    } catch (e) {
      return redirigerAvecMessage("/inventory/import", `Échec de l'import : ${e instanceof Error ? e.message : String(e)}`, "danger");
    }
  });
}
