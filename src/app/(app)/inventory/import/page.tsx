import { Icone } from "@/components/icones";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Importer l'inventaire - Sentinelle" };

/** inventory/import.html */
export default async function InventoryImport() {
  const page = await contexteModule("inventory");
  await requireEdit("inventory");
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="page-title">Importer l'inventaire (Excel)</h1>
        <a href="/inventory" className="btn btn-outline-secondary">
          <Icone bi="bi-arrow-left" taille="1em" classes="me-1" /> Retour
        </a>
      </div>

      <div className="row justify-content-center">
        <div className="col-lg-7">
          <div className="data-card p-4">
            <form method="POST" encType="multipart/form-data">
              <input type="hidden" name="csrf_token" value={page.csrf} />
              <label className="form-label fw-medium">Fichier Excel (.xlsx)</label>
              <input
                type="file"
                name="file"
                accept=".xlsx,.xlsm"
                className="form-control"
                required
              />
              <div className="alert alert-info py-2 small mt-3 mb-0">
                <Icone bi="bi-info-circle" taille="1em" classes="me-1" />
                Le classeur doit contenir un ou plusieurs onglets nommés <strong>VM</strong>,{" "}
                <strong>Physiques</strong> et/ou <strong>NAS</strong>. Les colonnes sont reconnues
                automatiquement (Nom, OS, Adresse IP, Fin de garantie, Criticité, Sauvegarde…). Les
                lignes sans nom et les colonnes inconnues sont ignorées. L'import{" "}
                <strong>ajoute</strong> les équipements (il ne remplace pas l'existant).
              </div>
              <button type="submit" className="btn btn-primary mt-3">
                <Icone bi="bi-upload" taille="1em" classes="me-1" /> Importer
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
