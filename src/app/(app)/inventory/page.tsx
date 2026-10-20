import { Icone, Lucide } from "@/components/icones";
import { PaginationBar } from "@/components/liste";
import { InventoryNav } from "@/components/partials";
import { ScriptDiffere } from "@/components/scripts";
import { CRITICALITY_COLORS, CRITICALITY_LABELS, EQUIPMENT_FAMILIES, EQUIPMENT_FAMILY_LABELS, EQUIPMENT_KIND_ICONS, EQUIPMENT_KIND_LABELS, equipmentFamily, statusRank } from "@/lib/constantes";
import { STATUS_LABELS, dateCourte } from "@/lib/libelles";
import { warrantyDaysLeft } from "@/lib/statuts";
import { ENV_CHOICES, SEARCH_FIELDS } from "@/modules/inventory/server";
import { envLabel, kindLabel } from "@/modules/inventory/vues";
import { prisma } from "@/server/db";
import { chargerEquipements } from "@/server/donnees";
import { contexteModule } from "@/server/module";
import { paginate, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Matériel - Sentinelle" };

type Params = Promise<Record<string, string | string[] | undefined>>;

// Colonnes configurables : (clé, libellé). Nom (avec l'OS en dessous) et Statut sont toujours affichés.
const COLUMNS: [string, string][] = [
  ["kind", "Type"],
  ["environment", "Env."],
  ["criticality", "Criticité"],
  ["os_last_update", "MAJ OS"],
  ["ip_address", "Adresse IP"],
  ["host_server", "Hôte"],
  ["hypervisor", "Hyperviseur"],
  ["netmask", "Masque"],
  ["vlan", "VLAN"],
  ["vcpu", "vCPU"],
  ["ram_go", "RAM (Go)"],
  ["storage", "Stockage (Go)"],
  ["manufacturer_model", "Constructeur / Modèle"],
  ["serial_number", "N° série"],
  ["service_tag", "Service Tag"],
  ["purchase_date", "Achat"],
  ["warranty_end", "Garantie"],
  ["maintenance_contract", "Maintenance"],
  ["location", "Emplacement"],
  ["management_url", "Administration"],
  ["ports", "Ports"],
  ["protocols", "Protocoles"],
  ["capacity_to", "Capacité (To)"],
  ["used_to", "Utilisé (To)"],
  ["raid", "RAID"],
  ["access", "Accès"],
  ["role_principal", "Rôle"],
  ["business_software", "Logiciels"],
  ["user_services", "Services"],
  ["usage", "Usage"],
  ["supervision", "Supervision"],
  ["pra_pca", "PRA/PCA"],
  ["backup1", "Sauvegarde 1"],
  ["backup2", "Sauvegarde 2"],
  ["observations", "Observations"],
];
const DEFAULT_COLS = ["kind", "environment", "criticality", "ip_address", "warranty_end"];
const ENTETES_COURTS: Record<string, string> = { criticality: "Crit." };
// Colonne de tri → attribut Prisma.
const SORT_ATTR: Record<string, string> = {
  kind: "kind",
  environment: "environment",
  criticality: "criticality",
  os_last_update: "osLastUpdate",
  ip_address: "ipAddress",
  host_server: "hostServer",
  hypervisor: "hypervisor",
  netmask: "netmask",
  vlan: "vlan",
  vcpu: "vcpu",
  ram_go: "ramGo",
  manufacturer_model: "manufacturerModel",
  serial_number: "serialNumber",
  service_tag: "serviceTag",
  purchase_date: "purchaseDate",
  warranty_end: "warrantyEnd",
  maintenance_contract: "maintenanceContract",
  location: "location",
  management_url: "managementUrl",
  ports: "ports",
  protocols: "protocols",
  capacity_to: "capacityTo",
  used_to: "usedTo",
  raid: "raid",
  access: "access",
  role_principal: "rolePrincipal",
  business_software: "businessSoftware",
  user_services: "userServices",
  usage: "usage",
  supervision: "supervision",
  pra_pca: "praPca",
  backup1: "backup1",
  backup2: "backup2",
  observations: "observations",
  os: "os",
  name: "name",
};
const NUMERIC = new Set(["criticality", "vcpu", "ram_go", "capacity_to", "used_to", "storage"]);
const DATES = new Set(["os_last_update", "purchase_date", "warranty_end"]);

const COLS_JS = `(function () {
    var KEY = 'inv_cols_v1';
    var DEFAULT = ${JSON.stringify(DEFAULT_COLS)};
    function saved() {
        try { return JSON.parse(localStorage.getItem(KEY)) || DEFAULT; } catch (e) { return DEFAULT; }
    }
    function apply(sel) {
        document.querySelectorAll('#invTable [data-col]').forEach(function (el) {
            el.style.display = sel.indexOf(el.dataset.col) === -1 ? 'none' : '';
        });
        document.querySelectorAll('.col-toggle').forEach(function (cb) {
            cb.checked = sel.indexOf(cb.value) !== -1;
        });
    }
    var sel = saved();
    apply(sel);
    document.querySelectorAll('.col-toggle').forEach(function (cb) {
        cb.addEventListener('change', function () {
            var s = [];
            document.querySelectorAll('.col-toggle:checked').forEach(function (c) { s.push(c.value); });
            try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
            apply(s);
        });
    });
})();

// Infobulles de statut (le bundle Bootstrap est chargé avant ce script)
if (window.bootstrap && bootstrap.Tooltip) {
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
        new bootstrap.Tooltip(el);
    });
}`;

function str(params: Record<string, string | string[] | undefined>, k: string): string {
  const v = params[k];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** inventory/list.html */
export default async function InventoryList({ searchParams }: { searchParams: Params }) {
  const page = await contexteModule("inventory");
  const params = await searchParams;
  let famille = str(params, "famille");
  if (!(famille in EQUIPMENT_FAMILIES)) famille = "serveurs";
  const natures = EQUIPMENT_FAMILIES[famille];
  const tous = await chargerEquipements();
  let items = tous.filter((e) => equipmentFamily(e.kind || "vm") === famille);
  const q = str(params, "q");
  let kind = str(params, "kind");
  if (!natures.includes(kind)) kind = "";
  const f = {
    environment: str(params, "environment"),
    criticality: str(params, "criticality"),
    status: str(params, "status"),
    os: str(params, "os"),
    vlan: str(params, "vlan"),
    supervision: str(params, "supervision"),
    warranty: str(params, "warranty"),
    no_backup: str(params, "no_backup"),
  };
  if (kind) items = items.filter((e) => e.kind === kind);
  items = textSearch(items, q, SEARCH_FIELDS as (keyof (typeof items)[number])[]);
  items = items.filter((e) => {
    if (f.environment && e.environment !== f.environment) return false;
    if (f.criticality && String(e.criticality ?? "") !== f.criticality) return false;
    if (f.status && e.status !== f.status) return false;
    if (f.os && !(e.os ?? "").toLowerCase().includes(f.os.toLowerCase())) return false;
    if (f.vlan && !(e.vlan ?? "").toLowerCase().includes(f.vlan.toLowerCase())) return false;
    if (f.supervision === "yes" && !(e.supervised || e.supervision)) return false;
    if (f.supervision === "no" && (e.supervised || e.supervision)) return false;
    if (f.no_backup === "1" && (e.backup1 || e.backup2)) return false;
    if (f.warranty === "expiring" || f.warranty === "expired") {
      const d = warrantyDaysLeft(e);
      if (d === null) return false;
      if (f.warranty === "expired" && d >= 0) return false;
      if (f.warranty === "expiring" && !(d >= 0 && d <= 90)) return false;
    }
    return true;
  });
  const activeFilters = Object.values(f).filter(Boolean).length;

  let sort = str(params, "sort");
  const direction = str(params, "dir") || "asc";
  const sortable = sort === "name" || sort === "status" || sort === "storage" || sort in SORT_ATTR;
  if (sort && sortable) {
    const cle = (e: (typeof items)[number]): string | number => {
      if (sort === "name") return (e.name ?? "").toLowerCase();
      if (sort === "status") return statusRank(e.status);
      if (sort === "storage") return [e.hdd1Go, e.hdd2Go, e.hdd3Go].reduce<number>((a, x) => a + (x ?? 0), 0);
      const v = (e as unknown as Record<string, unknown>)[SORT_ATTR[sort]];
      if (NUMERIC.has(sort)) return typeof v === "number" ? v : -1;
      if (DATES.has(sort)) return v instanceof Date ? v.getTime() : Number.NEGATIVE_INFINITY;
      return String(v ?? "").toLowerCase();
    };
    items.sort((a, b) => {
      const x = cle(a);
      const y = cle(b);
      const r = x < y ? -1 : x > y ? 1 : 0;
      return direction === "desc" ? -r : r;
    });
  } else {
    sort = "";
    items.sort((a, b) => statusRank(a.status) - statusRank(b.status));
  }

  const perPage = await resolvePerPage(params, page.user, "inventory.list");
  const [rows, p] = paginate(items, params, perPage);
  const counts: Record<string, number> = {};
  for (const k of natures) counts[k] = await prisma.equipment.count({ where: { isActive: true, kind: k } });
  const ids = rows.map((e) => e.id);
  const logiciels = await prisma.softwareEquipment.findMany({ where: { equipmentId: { in: ids } }, include: { software: { select: { name: true } } } });
  const logicielsPar = new Map<number, string[]>();
  for (const l of logiciels) logicielsPar.set(l.equipmentId, [...(logicielsPar.get(l.equipmentId) ?? []), l.software.name]);

  const { user } = page;
  const reseau = famille === "reseau";
  const search = page.search;
  const lien = (modifs: Record<string, string>) => {
    const a = new URLSearchParams();
    for (const [k, v] of Object.entries(modifs)) if (v) a.set(k, v);
    const s = a.toString();
    return s ? `/inventory?${s}` : "/inventory";
  };
  const sorth = (key: string, label: string) => {
    const a = new URLSearchParams(search);
    a.set("sort", key);
    a.set("dir", sort === key && direction === "asc" ? "desc" : "asc");
    a.delete("page");
    return (
      <a href={`/inventory?${a.toString()}`} className="th-sort">
        {label}
        {sort === key ? <Icone bi={`bi-caret-${direction === "desc" ? "down" : "up"}-fill`} taille="1em" /> : <Icone bi="bi-arrow-down-up" taille="1em" classes="th-sort-idle" />}
      </a>
    );
  };
  const perPageParam = search.get("per_page");
  const totalCounts = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {EQUIPMENT_FAMILY_LABELS[famille]} <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">{reseau ? "Switches, pare-feu, routeurs et bornes WiFi" : "VM, serveurs physiques, NAS et baies de stockage"}</p>
        </div>
        {user.canEdit("inventory") ? (
          <div className="page-actions">
            <a href="/inventory/import" className="btn btn-outline-secondary">
              <Icone bi="bi-file-earmark-excel" taille="1em" classes="me-1" /> Importer Excel
            </a>
            <a href={`/inventory/create?famille=${famille}`} className="btn btn-primary">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouvel équipement
            </a>
          </div>
        ) : null}
      </div>

      <InventoryNav active={famille as "serveurs" | "reseau"} />

      <form method="GET" id="invFilters">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="famille" value={famille} />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={direction} />
        {perPageParam ? <input type="hidden" name="per_page" value={perPageParam} /> : null}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div className="seg-tabs">
            {natures.length > 1 ? (
              <>
                <a className={`seg-tab${!kind ? " active" : ""}`} href={lien({ famille, q })}>
                  Tous <span className="seg-tab-count">{totalCounts}</span>
                </a>
                {natures.map((val) => (
                  <a key={val} className={`seg-tab${kind === val ? " active" : ""}`} href={lien({ famille, kind: val, q })}>
                    {EQUIPMENT_KIND_LABELS[val]} <span className="seg-tab-count">{counts[val]}</span>
                  </a>
                ))}
              </>
            ) : null}
          </div>
          <div className="flex-grow-1 justify-content-end d-flex flex-wrap align-items-center gap-2">
            <div className="list-search">
              <Icone bi="bi-search" taille="1em" />
              <input type="search" name="q" defaultValue={q} className="form-control" placeholder="Rechercher…" aria-label="Rechercher dans la liste" />
            </div>
            <button className="btn btn-outline-secondary btn-icon" type="button" data-bs-toggle="collapse" data-bs-target="#advFilter" title="Filtre avancé" aria-label="Filtre avancé">
              <Icone bi="bi-funnel" taille="1em" />
              {activeFilters ? <span className="badge bg-primary"> {activeFilters}</span> : null}
            </button>
            {q || activeFilters ? (
              <a href={lien({ famille, kind })} className="btn btn-ghost" title="Effacer la recherche">
                <Icone bi="bi-x-lg" taille="1em" classes="me-1" />
                Effacer
              </a>
            ) : null}
            <div className="dropdown">
              <button className="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside">
                <Icone bi="bi-layout-three-columns" taille="1em" classes="me-1" /> Colonnes
              </button>
              <div className="dropdown-menu dropdown-menu-end p-2" style={{ maxHeight: 320, overflowY: "auto" }}>
                {COLUMNS.map(([key, label]) => (
                  <label key={key} className="dropdown-item d-flex align-items-center gap-2 mb-0">
                    <input type="checkbox" className="form-check-input mt-0 col-toggle" value={key} /> {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={`collapse${activeFilters ? " show" : ""}`} id="advFilter">
          <div className="data-card p-3 mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-md-2">
                <label className="form-label small mb-1">Environnement</label>
                <select name="environment" className="form-select form-select-sm" defaultValue={f.environment}>
                  {ENV_CHOICES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Criticité</label>
                <select name="criticality" className="form-select form-select-sm" defaultValue={f.criticality}>
                  <option value="">—</option>
                  {Object.keys(CRITICALITY_LABELS).map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Statut</label>
                <select name="status" className="form-select form-select-sm" defaultValue={f.status}>
                  <option value="">—</option>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">OS contient</label>
                <input type="text" name="os" defaultValue={f.os} className="form-control form-control-sm" placeholder="ex: Windows" />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">VLAN contient</label>
                <input type="text" name="vlan" defaultValue={f.vlan} className="form-control form-control-sm" placeholder="ex: 10, prod..." />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Supervision</label>
                <select name="supervision" className="form-select form-select-sm" defaultValue={f.supervision}>
                  <option value="">—</option>
                  <option value="yes">Supervisé</option>
                  <option value="no">Non supervisé</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Garantie</label>
                <select name="warranty" className="form-select form-select-sm" defaultValue={f.warranty}>
                  <option value="">—</option>
                  <option value="expiring">Expire ≤ 90 j</option>
                  <option value="expired">Expirée</option>
                </select>
              </div>
              <div className="col-md-3 d-flex align-items-center pt-3">
                <div className="form-check">
                  <input type="checkbox" className="form-check-input" name="no_backup" value="1" id="noBackup" defaultChecked={f.no_backup === "1"} />
                  <label className="form-check-label small" htmlFor="noBackup">
                    Sans sauvegarde
                  </label>
                </div>
              </div>
              <div className="col-md-2">
                <button type="submit" className="btn btn-sm btn-primary w-100">
                  <Icone bi="bi-funnel" taille="1em" classes="me-1" /> Filtrer
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover mb-0" id="invTable">
            <thead>
              <tr>
                <th>{sorth("name", "Nom")}</th>
                {COLUMNS.map(([key, label]) => (
                  <th key={key} data-col={key} title={key in ENTETES_COURTS ? label : undefined}>
                    {sorth(key, ENTETES_COURTS[key] ?? label)}
                  </th>
                ))}
                <th>{sorth("status", "Statut")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((e) => {
                  const num = (v: number | null) => (v === null || v === undefined ? "" : String(v));
                  const vals: Record<string, string> = {
                    kind: kindLabel(e),
                    environment: envLabel(e),
                    criticality: num(e.criticality),
                    os: `${e.os ?? ""}${e.osVersion ? ` ${e.osVersion}` : ""}`,
                    os_last_update: e.osLastUpdate ? dateCourte(e.osLastUpdate) : "",
                    ip_address: e.ipAddress ?? "",
                    host_server: e.hostServer ?? "",
                    hypervisor: e.hypervisor ?? "",
                    netmask: e.netmask ?? "",
                    vlan: e.vlan ?? "",
                    vcpu: num(e.vcpu),
                    ram_go: num(e.ramGo),
                    storage: [e.hdd1Go, e.hdd2Go, e.hdd3Go].filter((x) => x).join(" / "),
                    manufacturer_model: e.manufacturerModel ?? "",
                    serial_number: e.serialNumber ?? "",
                    service_tag: e.serviceTag ?? "",
                    purchase_date: e.purchaseDate ? dateCourte(e.purchaseDate) : "",
                    warranty_end: e.warrantyEnd ? dateCourte(e.warrantyEnd) : "",
                    maintenance_contract: e.maintenanceContract ?? "",
                    location: e.location ?? "",
                    management_url: e.managementUrl ?? "",
                    ports: num(e.ports),
                    protocols: e.protocols ?? "",
                    capacity_to: num(e.capacityTo),
                    used_to: num(e.usedTo),
                    raid: e.raid ?? "",
                    access: e.access ?? "",
                    role_principal: e.rolePrincipal ?? "",
                    business_software: (logicielsPar.get(e.id) ?? []).join(", "),
                    user_services: e.userServices ?? "",
                    usage: e.usage ?? "",
                    supervision: e.supervision || (e.supervised ? "Oui" : ""),
                    pra_pca: e.praPca ?? "",
                    backup1: `${e.backup1 ?? ""}${e.backup1Freq ? ` (${e.backup1Freq})` : ""}`,
                    backup2: `${e.backup2 ?? ""}${e.backup2Freq ? ` (${e.backup2Freq})` : ""}`,
                    observations: e.observations ?? "",
                  };
                  const reasons = e.reasons;
                  return (
                    <tr key={e.id} className={`row-${e.status}${e.environment === "decommissioned" ? " inv-decommissioned" : ""}`}>
                      <td>
                        <a href={`/inventory/${e.id}`} className="fw-medium text-decoration-none">
                          {e.name}
                        </a>
                        {vals.os ? (
                          <small className="d-block text-muted" style={{ lineHeight: 1 }}>
                            {vals.os}
                          </small>
                        ) : null}
                      </td>
                      {COLUMNS.map(([key]) => (
                        <td key={key} data-col={key}>
                          {key === "kind" ? (
                            <span className="text-nowrap fw-semibold">
                              <Lucide nom={EQUIPMENT_KIND_ICONS[e.kind] ?? "box"} taille={15} classes={`me-1 kind-icon kind-icon--${e.kind}`} />
                              {vals.kind}
                            </span>
                          ) : key === "criticality" ? (
                            e.criticality ? (
                              <span className={`badge bg-${CRITICALITY_COLORS[e.criticality] ?? "secondary"}`}>{e.criticality}</span>
                            ) : (
                              "-"
                            )
                          ) : (
                            <small>{vals[key] || "-"}</small>
                          )}
                        </td>
                      ))}
                      <td>
                        <span className={`badge-status badge-${e.status}`} data-bs-toggle="tooltip" title={reasons.length ? reasons.join(" · ") : "Aucun point d’attention — équipement OK"}>
                          {STATUS_LABELS[e.status] ?? e.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="text-center py-4 text-muted">
                    <Icone bi="bi-hdd-stack" taille="1em" style="font-size: 2rem;" />
                    <p className="mt-2 mb-0">
                      Aucun équipement.{" "}
                      {user.canEdit("inventory") ? (
                        <>
                          <a href="/inventory/import">Importer votre fichier Excel</a> ou <a href={`/inventory/create?famille=${famille}`}>en ajouter un</a>.
                        </>
                      ) : null}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationBar p={p} pathname={page.pathname} search={page.search} />

      <ScriptDiffere code={COLS_JS} nonce={page.nonce} />
    </>
  );
}
