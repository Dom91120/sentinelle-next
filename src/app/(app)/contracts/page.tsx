import { Icone } from "@/components/icones";
import { Barre, PaginationBar, Vide } from "@/components/liste";
import { statusRank } from "@/lib/constantes";
import { aujourdhui } from "@/lib/libelles";
import { contractStatus } from "@/lib/statuts";
import { TableauContrats } from "@/modules/contracts/vues";
import { seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";
import { paginate, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Contrats - Sentinelle" };

type Params = Promise<Record<string, string | string[] | undefined>>;

/** contracts/list.html */
export default async function ContractsList({ searchParams }: { searchParams: Params }) {
  const page = await contexteModule("contracts");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const seuils = seuilsDe(page.user.settings);
  const today = aujourdhui();
  const [tous, agregat] = await Promise.all([
    prisma.contract.findMany({
      where: { isActive: true },
      orderBy: [{ endDate: { sort: "asc", nulls: "last" } }],
      include: {
        kindRef: true,
        supplier: true,
        software: { include: { software: true } },
        equipments: { include: { equipment: true } },
      },
    }),
    prisma.contract.aggregate({ where: { isActive: true }, _sum: { costYearly: true } }),
  ]);
  const totalCost = agregat._sum.costYearly ?? 0;
  let contracts = textSearch(tous, q, ["name", "reference", "description"]);
  contracts = contracts
    .map((c) => ({ ...c, statut: contractStatus(c, seuils, today) }))
    .sort((a, b) => statusRank(a.statut) - statusRank(b.statut));
  const perPage = await resolvePerPage(params, page.user, "contracts.list");
  const [rows, p] = paginate(contracts, params, perPage);
  const { user } = page;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Contrats <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">
            Marchés, licences et abonnements : échéances, préavis de résiliation et coûts{" "}
            {totalCost ? `— ${Math.round(totalCost)} € / an au total` : ""}
          </p>
        </div>
        <div className="page-actions">
          {user.canEdit("contracts") ? (
            <a href="/contracts/create" className="btn btn-primary">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouveau contrat
            </a>
          ) : null}
        </div>
      </div>

      <Barre q={q} pathname={page.pathname} search={page.search} />

      <div className="data-card">
        <div className="table-responsive">
          <TableauContrats
            contracts={rows}
            today={today}
            total={false}
            filtrable
            seuils={seuils}
            vide={
              <Vide
                colonnes={8}
                message="Aucun contrat."
                urlAjout={user.canEdit("contracts") ? "/contracts/create" : null}
                icone="bi-file-earmark-text"
              />
            }
          />
        </div>
      </div>
      <PaginationBar p={p} pathname={page.pathname} search={page.search} />
    </>
  );
}
