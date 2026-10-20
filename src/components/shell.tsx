/**
 * La page autour du contenu (port de base.html pour un utilisateur connecté) :
 * barre du haut (mobile), barre latérale (recherche, menu en quatre domaines,
 * administration repliée, pied utilisateur), messages flash, fil d'Ariane.
 */
import { Icone, Lucide } from "@/components/icones";
import { ConfirmModal, ScriptsPage, ToastNotifications } from "@/components/scripts";
import { compte } from "@/lib/libelles";
import { ADMINISTRATION, DOMAINES, entreeActive, filAriane } from "@/lib/navigation";
import type { Flash } from "@/server/flash";
import type { CurrentUser } from "@/server/guards";

const FLASH_ICONS: Record<string, string> = {
  success: "check-circle-fill",
  danger: "exclamation-octagon-fill",
  warning: "exclamation-triangle-fill",
  info: "info-circle-fill",
};

export function FlashMessages({ flashes, nonce }: { flashes: Flash[]; nonce?: string }) {
  if (!flashes.length) return null;
  return (
    <>
      {flashes.map(([category, message], i) => {
        const cat = category in FLASH_ICONS ? category : "info";
        return (
          <div
            key={i}
            className={`alert alert-${cat} alert-dismissible fade show d-flex align-items-center gap-2 js-autodismiss`}
            role="alert"
          >
            <Icone bi={`bi-${FLASH_ICONS[cat]}`} taille="1em" />
            <div className="flex-grow-1">{message}</div>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="alert"
              aria-label="Fermer"
            />
          </div>
        );
      })}
      {/* Les messages sont lus depuis le cookie au rendu ; le client l'efface une fois affichés. */}
      <script src="/js/flash-clear.js" nonce={nonce} />
    </>
  );
}

export type ShellProps = {
  user: CurrentUser;
  counts: Record<string, number>;
  pathname: string;
  flashes: Flash[];
  csrf: string;
  nonce?: string;
  children: React.ReactNode;
  extraJs?: React.ReactNode;
};

export function Shell({
  user,
  counts,
  pathname,
  flashes,
  csrf,
  nonce,
  children,
  extraJs,
}: ShellProps) {
  const [domActif, entreeActif] = entreeActive(pathname);
  const fil = filAriane(pathname);
  const adminVisible = user.isAdmin || user.canView("alerts");
  const adminOuvert = domActif?.key === "administration";
  return (
    <>
      <a href="#main-content" className="skip-link">
        Aller au contenu
      </a>

      <div className="app-topbar">
        <button
          className="topbar-toggle"
          type="button"
          data-action="toggleSidebar"
          aria-label="Ouvrir le menu"
        >
          <Icone bi="bi-list" taille="1em" />
        </button>
        <span className="topbar-title">Sentinelle</span>
        <span
          className="theme-toggle"
          data-action="toggleTheme"
          title="Changer le theme"
          aria-label="Changer le theme"
          role="button"
          tabIndex={0}
        >
          <span className="js-theme-icon" aria-hidden="true">
            🌙
          </span>
        </span>
      </div>
      <div className="sidebar-backdrop" data-action="closeSidebar" />

      <div className="sidebar">
        <a href="/" className="sidebar-header">
          <img src="/logo.svg" alt="" className="sidebar-logo-icon" />
          <span className="sidebar-logo-text">Sentinelle</span>
        </a>

        <div className="sidebar-search px-3 pb-2">
          <form method="GET" action="/search" className="sidebar-search-form" role="search">
            <Icone bi="bi-search" taille="1em" />
            <input
              type="search"
              name="q"
              id="recherche-globale"
              placeholder="Rechercher partout"
              autoComplete="off"
              aria-label="Rechercher partout (Ctrl K)"
            />
            <kbd aria-hidden="true">Ctrl K</kbd>
          </form>
        </div>

        <nav className="sidebar-nav">
          {DOMAINES.map((dom) => (
            <div key={dom.key} className={`sidebar-section dom-${dom.key}`}>
              <div className="sidebar-section-title">{dom.label}</div>
              {dom.entries
                .filter((e) => !e.perm || user.canView(e.perm))
                .map((e) => (
                  <a
                    key={e.endpoint}
                    href={e.href}
                    className={`sidebar-link${entreeActif?.endpoint === e.endpoint ? " active" : ""}`}
                  >
                    <Icone bi={e.icon} />
                    <span>{e.label}</span>
                    {e.count && counts[e.count] ? (
                      <span
                        className="badge bg-danger rounded-pill ms-auto"
                        title={compte(counts[e.count], "danger")}
                      >
                        {counts[e.count]}
                      </span>
                    ) : null}
                  </a>
                ))}
              {dom.key === "aujourdhui" && user.canEdit() && counts.trash ? (
                <a
                  href="/trash"
                  className={`sidebar-link${pathname === "/trash" ? " active" : ""}`}
                >
                  <Icone bi="bi-trash3" />
                  <span>Corbeille</span>
                  <span className="badge bg-secondary rounded-pill ms-auto">{counts.trash}</span>
                </a>
              ) : null}
            </div>
          ))}

          {adminVisible ? (
            <details
              className="sidebar-section sidebar-section--repliable dom-administration"
              data-section="administration"
              open={adminOuvert || undefined}
              {...(adminOuvert ? { "data-forced-open": "" } : {})}
            >
              <summary className="sidebar-section-title">
                {ADMINISTRATION.label}
                <Icone bi="bi-chevron-right" taille="1em" />
              </summary>
              {ADMINISTRATION.entries
                .filter(
                  (e) => (e.admin && user.isAdmin) || (!e.admin && e.perm && user.canView(e.perm)),
                )
                .map((e) => (
                  <a
                    key={e.endpoint}
                    href={e.href}
                    className={`sidebar-link${entreeActif?.endpoint === e.endpoint ? " active" : ""}`}
                  >
                    <Icone bi={e.icon} />
                    <span>{e.label}</span>
                  </a>
                ))}
            </details>
          ) : null}
        </nav>

        <div className="sidebar-footer">
          <details className="sidebar-user">
            <summary className="sidebar-user-row">
              <span className="sidebar-avatar" aria-hidden="true">
                {user.username.slice(0, 2).toUpperCase()}
              </span>
              <span className="sidebar-user-text">
                <span className="sidebar-username">
                  <span>{user.username}</span>
                  <Lucide nom="chevron-down" taille={14} classes="sidebar-caret" />
                </span>
                <span className="sidebar-role">
                  {user.isAdmin ? "Administrateur" : "Utilisateur"}
                </span>
              </span>
            </summary>
            <div className="sidebar-user-menu" role="menu">
              <a href="/profile" className="sidebar-user-item" role="menuitem">
                <Lucide nom="user" taille={14} />
                Mon compte
              </a>
              <a href="/2fa" className="sidebar-user-item" role="menuitem">
                <Lucide nom="shield-check" taille={14} />
                Sécurité
              </a>
              <div className="sidebar-user-sep" role="separator" />
              <a
                href="/logout"
                className="sidebar-user-item sidebar-user-item--danger"
                role="menuitem"
              >
                <Lucide nom="log-out" taille={14} />
                Déconnexion
              </a>
            </div>
          </details>
          <span className="sidebar-footer-icons">
            <span
              className="theme-toggle"
              data-action="toggleTheme"
              title="Changer le thème"
              aria-label="Changer le thème"
              role="button"
              tabIndex={0}
            >
              <span id="theme-icon" className="js-theme-icon" aria-hidden="true">
                🌙
              </span>
            </span>
          </span>
        </div>
      </div>

      <main className="main-content" id="main-content">
        <FlashMessages flashes={flashes} nonce={nonce} />
        {fil.length ? (
          <nav className="fil-ariane" aria-label="Fil d'Ariane">
            {fil.map(([label, url], i) => (
              <span key={i}>
                {i > 0 ? (
                  <span className="fil-sep" aria-hidden="true">
                    ›
                  </span>
                ) : null}
                {url ? (
                  <a href={url}>{label}</a>
                ) : (
                  <span className={i === fil.length - 1 ? "fil-actuel" : undefined}>{label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        {children}
      </main>

      <ToastNotifications nonce={nonce} />
      <ConfirmModal csrf={csrf} nonce={nonce} />
      <ScriptsPage nonce={nonce} extra={extraJs} />
    </>
  );
}
