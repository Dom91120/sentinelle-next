import { Icone } from "@/components/icones";
import { ScriptDiffere } from "@/components/scripts";
import { dateHeure } from "@/lib/libelles";
import { contextePreferences } from "@/modules/preferences/server";
import { requireAdmin } from "@/server/guards";
import { contextePage } from "@/server/page";

export const metadata = { title: "Préférences - Sentinelle" };

const LDAP_PORT_JS = `(function () {
  var ssl = document.getElementById('ldapSsl');
  var port = document.getElementById('ldapPort');
  if (!ssl || !port) return;
  ssl.addEventListener('change', function () {
    var v = (port.value || '').trim();
    if (ssl.checked && (v === '' || v === '389')) { port.value = '636'; }
    else if (!ssl.checked && v === '636') { port.value = '389'; }
  });
})();`;

const SECTION_JS = `(function () {
  var KEY = 'prefsOpenSection';
  var saved = sessionStorage.getItem(KEY);
  if (saved) {
    sessionStorage.removeItem(KEY);
    var cible = document.getElementById(saved);
    if (cible) cible.scrollIntoView({ block: 'start' });
  }
  document.querySelectorAll('#prefsRubriques form').forEach(function (form) {
    form.addEventListener('submit', function () {
      var section = form.closest('.pref-rubrique');
      if (section) sessionStorage.setItem(KEY, section.id);
    });
  });
})();`;

/* Les boutons d'export se mettent en attente au clic : l'archive se construit côté
   serveur avant le premier octet (plus d'une minute avec les pièces jointes), et le
   navigateur ne montre rien. Un jeton passé dans l'URL revient en cookie quand la
   réponse arrive : les boutons reprennent leur libellé. */
const EXPORT_JS = `(function () {
  var liens = document.querySelectorAll('a[data-export-attente]');
  if (!liens.length) return;
  var occupe = false;
  function cookie(nom) {
    var parts = document.cookie.split('; ');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].indexOf(nom + '=') === 0) return parts[i].slice(nom.length + 1);
    }
    return '';
  }
  function jeton() {
    var s = '', a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 16; i++) s += a.charAt(Math.floor(Math.random() * a.length));
    return s;
  }
  function etat(attente) {
    occupe = attente;
    liens.forEach(function (a) {
      a.classList.toggle('btn-attente', attente);
      a.setAttribute('aria-busy', attente ? 'true' : 'false');
      var texte = a.querySelector('[data-texte]');
      if (texte) texte.textContent = attente ? a.dataset.exportAttente : texte.dataset.texte;
    });
  }
  liens.forEach(function (a) {
    a.addEventListener('click', function (ev) {
      if (occupe) { ev.preventDefault(); return; }
      var t = jeton();
      a.href = a.href + (a.href.indexOf('?') === -1 ? '?' : '&') + 't=' + t;
      etat(true);
      var debut = Date.now();
      var minuteur = setInterval(function () {
        var fini = cookie('export_pret') === t;
        if (fini) document.cookie = 'export_pret=; Path=/; Max-Age=0; SameSite=Lax';
        if (fini || Date.now() - debut > 15 * 60 * 1000) {
          clearInterval(minuteur);
          a.href = a.href.replace(/[?&]t=[a-z0-9]+$/, '');
          etat(false);
        }
      }, 500);
    });
  });
})();`;

const ESTIMATION_JS = `(function () {
  var champ = document.getElementById('backupDbKeep');
  var sortie = document.getElementById('backupKeepEstimation');
  if (!champ || !sortie) return;
  var mo = parseFloat(champ.dataset.taille) || 0;
  function dire() {
    var n = parseInt(champ.value, 10);
    if (!n || n < 1 || !mo) { sortie.textContent = ''; return; }
    var total = n * mo;
    sortie.textContent = 'soit environ ' + (total >= 1024
      ? (total / 1024).toFixed(1).replace('.', ',') + ' Go'
      : Math.round(total) + ' Mo') + ' dans le volume';
  }
  champ.addEventListener('input', dire);
  dire();
})();`;

const SOMMAIRE_JS = `(function () {
  var nav = document.getElementById('prefsSommaire');
  if (!nav) return;
  var liens = Array.prototype.slice.call(nav.querySelectorAll('.form-sommaire-lien'));
  var entrees = [];
  liens.forEach(function (a) {
    var section = document.getElementById(a.dataset.cible);
    if (!section) { a.remove(); return; }
    var etat = a.querySelector('.som-etat');
    var badge = section.querySelector('.form-section-titre .badge');
    if (badge && etat) {
      if (badge.classList.contains('bg-success')) etat.classList.add('ok');
      else if (badge.classList.contains('bg-danger')) etat.classList.add('ko');
    }
    a.addEventListener('click', function (e) {
      e.preventDefault();
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', '#' + section.id);
    });
    entrees.push({ a: a, section: section });
  });
  function actualiser() {
    var courant = entrees[0];
    entrees.forEach(function (l) {
      if (l.section.getBoundingClientRect().top <= 160) courant = l;
    });
    entrees.forEach(function (l) { l.a.classList.toggle('active', l === courant); });
  }
  window.addEventListener('scroll', actualiser, { passive: true });
  actualiser();
})();`;

function Csrf({ csrf }: { csrf: string }) {
  return <input type="hidden" name="csrf_token" value={csrf} />;
}

function Enregistrer({
  libelle = "Enregistrer",
  classes = "",
}: {
  libelle?: string;
  classes?: string;
}) {
  return (
    <button type="submit" className={`btn btn-sm btn-primary ${classes}`.trim()}>
      <Icone bi="bi-check-lg" taille="1em" classes="me-1" /> {libelle}
    </button>
  );
}

function Interrupteur({
  id,
  name,
  label,
  checked,
  soumettre,
}: {
  id: string;
  name: string;
  label: React.ReactNode;
  checked: boolean;
  soumettre?: boolean;
}) {
  return (
    <div className="form-check form-switch">
      <input
        className="form-check-input"
        type="checkbox"
        role="switch"
        id={id}
        name={name}
        defaultChecked={checked}
        data-soumettre-au-changement={soumettre ? "" : undefined}
      />
      <label className="form-check-label fw-medium" htmlFor={id}>
        {label}
      </label>
    </div>
  );
}

function Som({ cible, bi, libelle }: { cible: string; bi: string; libelle: string }) {
  return (
    <a href={`#${cible}`} className="form-sommaire-lien" data-cible={cible}>
      <Icone bi={bi} taille="1em" />
      <span>{libelle}</span>
      <span className="som-etat" />
    </a>
  );
}

function Rubrique({
  id,
  bi,
  titre,
  badge,
  aide,
  children,
}: {
  id: string;
  bi: string;
  titre: string;
  badge?: React.ReactNode;
  aide: string;
  children: React.ReactNode;
}) {
  return (
    <section className="form-section pref-rubrique" id={id}>
      <div className="form-section-titre">
        <Icone bi={bi} taille="1em" classes="me-2" />
        {titre}
        {badge}
      </div>
      <p className="form-section-aide">{aide}</p>
      <div className="form-section-corps">{children}</div>
    </section>
  );
}

function BadgeOk({ libelle }: { libelle: string }) {
  return (
    <span className="badge bg-success ms-2">
      <Icone bi="bi-check-circle" taille="1em" classes="me-1" />
      {libelle}
    </span>
  );
}

/** auth/preferences.html */
export default async function PreferencesPage() {
  const page = await contextePage();
  const admin = await requireAdmin();
  const { csrf, nonce } = page;
  const p = await contextePreferences(admin.settings);
  const modulesCoupes = p.modules.filter((m) => !m.on);
  const parCatRempli = Object.values(p.alertRecipientsByCat).some(Boolean);
  const pluriel = (n: number) => (n > 1 ? "s" : "");
  const lignesSeuils: [string, string][] = [
    ["expiry", "Comptes & certificats"],
    ["domain", "Noms de domaine"],
    ["task", "Tests & revues de droits"],
    ["contract", "Contrats & licences (échéance - préavis)"],
  ];
  const anciens = [
    p.softwareFormLegacy ? "logiciels" : "",
    p.contractFormLegacy ? "contrats" : "",
    p.supplierFormLegacy ? "fournisseurs" : "",
  ].filter(Boolean);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Préférences</h1>
          <p className="page-subtitle">
            Les réglages de Sentinelle : connexion, messagerie, seuils d'alerte, apparence
          </p>
        </div>
      </div>

      <div className="pref-etat" aria-label="État des réglages">
        {p.mailConfigured ? (
          <span className="badge-status badge-success">
            <Icone bi="bi-envelope" taille="1em" />
            Messagerie : {p.mailMethod === "o365" ? "Office 365" : "SMTP"}
          </span>
        ) : (
          <span className="badge-status badge-danger">
            <Icone bi="bi-envelope" taille="1em" />
            Messagerie non configurée
          </span>
        )}
        {p.ldap.enabled ? (
          <span className="badge-status badge-success">
            <Icone bi="bi-diagram-3" taille="1em" />
            LDAP activé
          </span>
        ) : (
          <span className="badge-status badge-muted">
            <Icone bi="bi-diagram-3" taille="1em" />
            LDAP désactivé
          </span>
        )}
        {p.ctMonitoring ? (
          <span className="badge-status badge-success">
            <Icone bi="bi-shield-lock" taille="1em" />
            Surveillance CT activée
          </span>
        ) : (
          <span className="badge-status badge-muted">
            <Icone bi="bi-shield-lock" taille="1em" />
            Surveillance CT désactivée
          </span>
        )}
        {p.softwareAlerts ? (
          <span className="badge-status badge-success">
            <Icone bi="bi-window-stack" taille="1em" />
            Alertes logiciels activées
          </span>
        ) : (
          <span className="badge-status badge-muted">
            <Icone bi="bi-window-stack" taille="1em" />
            Alertes logiciels désactivées
          </span>
        )}
        {p.dbBackups.length ? (
          <span className="badge-status badge-success">
            <Icone bi="bi-database" taille="1em" />
            {p.dbBackups.length} sauvegarde{pluriel(p.dbBackups.length)}
          </span>
        ) : (
          <span className="badge-status badge-danger">
            <Icone bi="bi-database" taille="1em" />
            Aucune sauvegarde
          </span>
        )}
        {modulesCoupes.length ? (
          <span className="badge-status badge-muted">
            <Icone bi="bi-toggles" taille="1em" />
            {modulesCoupes.length} module{pluriel(modulesCoupes.length)} désactivé
            {pluriel(modulesCoupes.length)}
          </span>
        ) : (
          <span className="badge-status badge-muted">
            <Icone bi="bi-toggles" taille="1em" />
            Tous les modules actifs
          </span>
        )}
        {p.documentsEnabled ? (
          <span className="badge-status badge-muted">
            <Icone bi="bi-paperclip" taille="1em" />
            Pièces jointes : {p.documentMaxMb} Mo
          </span>
        ) : (
          <span className="badge-status badge-muted">
            <Icone bi="bi-paperclip" taille="1em" />
            Pièces jointes désactivées
          </span>
        )}
        {p.uiPrimaryColor ? (
          <span
            className="badge-status badge-muted"
            style={{ "--badge": p.uiPrimaryColor } as React.CSSProperties}
          >
            <Icone bi="bi-palette" taille="1em" />
            Couleur personnalisée
          </span>
        ) : (
          <span className="badge-status badge-muted">
            <Icone bi="bi-palette" taille="1em" />
            Palette d'origine
          </span>
        )}
      </div>

      <div className="form-page pref-page">
        <nav className="form-sommaire" id="prefsSommaire" aria-label="Rubriques des préférences">
          <div className="som-famille">Accès &amp; sécurité</div>
          <Som cible="secLdap" bi="bi-diagram-3" libelle="Authentification LDAP" />
          <Som cible="secConformity" bi="bi-speedometer2" libelle="Conformité globale" />
          <Som cible="secSurveillance" bi="bi-shield-lock" libelle="Surveillance" />
          <div className="som-famille">Messagerie &amp; alertes</div>
          <Som cible="secMail" bi="bi-envelope" libelle="Messagerie" />
          <Som cible="secRecipients" bi="bi-people" libelle="Destinataires & test" />
          <Som cible="secThresholds" bi="bi-sliders" libelle="Seuils d'alerte" />
          <div className="som-famille">Données</div>
          <Som cible="secDb" bi="bi-database" libelle="Base de données" />
          <Som cible="secDocuments" bi="bi-paperclip" libelle="Pièces jointes" />
          <Som cible="secModules" bi="bi-toggles" libelle="Modules" />
          <Som cible="secReferentiels" bi="bi-list-ul" libelle="Référentiels" />
          <div className="som-famille">Affichage</div>
          <Som cible="secDashboard" bi="bi-grid-1x2" libelle="Tableau de bord" />
          <Som cible="secForms" bi="bi-window-stack" libelle="Formulaires" />
          <Som cible="secAppearance" bi="bi-palette" libelle="Apparence" />
        </nav>
        <div className="form-corps" id="prefsRubriques">
          <div className="form-famille">Accès &amp; sécurité</div>

          <Rubrique
            id="secLdap"
            bi="bi-diagram-3"
            titre="Authentification LDAP / Active Directory"
            badge={p.ldap.enabled ? <span className="badge bg-success ms-2">Activé</span> : null}
            aide="Connexion des utilisateurs avec leur compte de l'annuaire ; les comptes locaux restent utilisables."
          >
            <form method="POST" action="/preferences" encType="multipart/form-data">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_ldap" />
              <div className="form-check form-switch mb-2">
                <input
                  type="checkbox"
                  className="form-check-input"
                  name="ldap_enabled"
                  id="ldapEnabled"
                  defaultChecked={p.ldap.enabled}
                />
                <label className="form-check-label" htmlFor="ldapEnabled">
                  Activer l'authentification LDAP/AD{" "}
                  <span className="text-muted small">
                    (les comptes locaux restent utilisables en parallèle)
                  </span>
                </label>
              </div>
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="ldapServer">
                    Serveur <span className="text-muted">(FQDN ou IP, sans ldap://)</span>
                  </label>
                  <input
                    type="text"
                    name="ldap_server"
                    id="ldapServer"
                    className="form-control form-control-sm"
                    defaultValue={p.ldap.server}
                    placeholder="dc.votredomaine.lan ou IP de votre DC"
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label small" htmlFor="ldapPort">
                    Port
                  </label>
                  <input
                    type="number"
                    name="ldap_port"
                    id="ldapPort"
                    className="form-control form-control-sm"
                    defaultValue={p.ldap.port}
                  />
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <div>
                    <div className="form-check form-switch">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        name="ldap_ssl"
                        id="ldapSsl"
                        defaultChecked={p.ldap.ssl}
                      />
                      <label className="form-check-label small" htmlFor="ldapSsl">
                        SSL / LDAPS (port 636)
                      </label>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        name="ldap_validate_cert"
                        id="ldapValidate"
                        defaultChecked={p.ldap.validate_cert}
                      />
                      <label className="form-check-label small" htmlFor="ldapValidate">
                        Valider le certificat
                      </label>
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  <small className="text-muted">
                    Certificat CA — <strong>optionnel</strong> : utile uniquement si « Valider le
                    certificat » est coché et que votre DC utilise une CA interne. Deux méthodes au
                    choix (l'import écrase le chemin) :
                  </small>
                </div>
                <div className="col-md-7">
                  <label className="form-label small" htmlFor="ldapCaCert">
                    Chemin d'un CA (PEM) déjà sur le serveur{" "}
                    <span className="text-muted">— optionnel</span>
                  </label>
                  <input
                    type="text"
                    name="ldap_ca_cert"
                    id="ldapCaCert"
                    className="form-control form-control-sm"
                    defaultValue={p.ldap.ca_cert}
                    placeholder="C:\chemin\vers\ca.pem"
                  />
                </div>
                <div className="col-md-5">
                  <label className="form-label small" htmlFor="ldapCaFile">
                    … ou importer le fichier CA{" "}
                    <span className="text-muted">(.pem / .crt / .cer) — optionnel</span>
                  </label>
                  <input
                    type="file"
                    name="ldap_ca_cert_file"
                    id="ldapCaFile"
                    accept=".pem,.crt,.cer,.cert"
                    className="form-control form-control-sm"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small" htmlFor="ldapDomain">
                    Domaine (UPN)
                  </label>
                  <input
                    type="text"
                    name="ldap_domain"
                    id="ldapDomain"
                    className="form-control form-control-sm"
                    defaultValue={p.ldap.domain}
                    placeholder="votredomaine.lan"
                  />
                </div>
                <div className="col-md-8">
                  <label className="form-label small" htmlFor="ldapBaseDn">
                    Base DN (recherche)
                  </label>
                  <input
                    type="text"
                    name="ldap_base_dn"
                    id="ldapBaseDn"
                    className="form-control form-control-sm"
                    defaultValue={p.ldap.base_dn}
                    placeholder="DC=votredomaine,DC=lan"
                  />
                </div>
                <div className="col-md-12">
                  <label className="form-label small" htmlFor="ldapGroup">
                    Groupe AD autorisé{" "}
                    <span className="badge bg-warning text-dark ms-1">fortement conseillé</span>
                  </label>
                  <input
                    type="text"
                    name="ldap_required_group"
                    id="ldapGroup"
                    className="form-control form-control-sm"
                    defaultValue={p.ldap.required_group}
                    placeholder="ex : Sentinelle-Users  ou  CN=Sentinelle,OU=Groupes,DC=votredomaine,DC=lan"
                  />
                  <small className="text-muted">
                    Restreint la connexion aux <strong>membres de ce groupe</strong> (groupes
                    imbriqués inclus), au lieu d'ouvrir l'accès à tout l'annuaire. Laisser vide =
                    tout utilisateur AD peut se connecter. Nécessite le Base DN.
                  </small>
                </div>
              </div>
              <div className="row g-2 mt-1">
                <div className="col-12">
                  <small className="text-muted">
                    Compte de service (lecture seule) — sert uniquement à{" "}
                    <strong>lire l'annuaire AD</strong> (recherche d'utilisateurs, synchro des
                    expirations de mots de passe). Ce n'est <strong>pas</strong> un compte
                    utilisateur Sentinelle : il n'a ni rôle ni accès à l'application.
                  </small>
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="ldapBindUser">
                    Identifiant du compte de service
                  </label>
                  <input
                    type="text"
                    name="ldap_bind_user"
                    id="ldapBindUser"
                    className="form-control form-control-sm"
                    defaultValue={p.ldap.bind_user}
                    placeholder="svc-sentinelle@votredomaine.lan"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="ldapBindPassword">
                    Mot de passe{" "}
                    {p.ldap.bind_set ? <span className="text-success">(défini)</span> : null}
                  </label>
                  <input
                    type="password"
                    name="ldap_bind_password"
                    id="ldapBindPassword"
                    className="form-control form-control-sm"
                    placeholder={
                      p.ldap.bind_set
                        ? "laisser vide pour ne pas changer"
                        : "mot de passe du compte de service"
                    }
                  />
                </div>
              </div>
              <div className="d-flex align-items-center gap-2 mt-2">
                <Enregistrer libelle="Enregistrer LDAP" />
              </div>
              <small className="text-muted d-block mt-1">
                Les utilisateurs AD validés sont créés automatiquement en lecture seule ; ajustez
                leur rôle ensuite dans Utilisateurs. La synchro des expirations utilise le compte de
                service + le Base DN.
              </small>
            </form>
            <form method="POST" action="/preferences" className="mt-2">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="test_ldap" />
              <button type="submit" className="btn btn-sm btn-outline-secondary">
                <Icone bi="bi-plug" taille="1em" classes="me-1" /> Tester la connexion
              </button>
              <small className="text-muted ms-1">
                Teste la configuration <strong>enregistrée</strong> (compte de service).
              </small>
            </form>
            <ScriptDiffere code={LDAP_PORT_JS} nonce={nonce} />
          </Rubrique>

          <Rubrique
            id="secConformity"
            bi="bi-speedometer2"
            titre="Conformité globale"
            badge={
              <>
                {p.configured.conformity ? <BadgeOk libelle="Personnalisé" /> : null}
                <span className="badge bg-secondary ms-2">
                  {p.conformityIncluded.size}/{p.conformityCategories.length}
                </span>
              </>
            }
            aide="Les contrôles qui entrent dans le score de conformité du tableau de bord."
          >
            <p className="text-muted small">
              Catégories prises en compte dans l'indicateur de <strong>Conformité globale</strong>{" "}
              du tableau de bord. Les cartes de chaque catégorie restent visibles ; seul le
              pourcentage global est affecté.
            </p>
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_conformity" />
              <div className="row g-2">
                {p.conformityCategories.map((cat) => (
                  <div key={cat} className="col-md-6 col-lg-4">
                    <label
                      className="d-flex align-items-center gap-2 p-2 rounded border mb-0"
                      style={{ cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        name="conformity"
                        value={cat}
                        defaultChecked={p.conformityIncluded.has(cat)}
                      />
                      <span className="fw-medium small">{p.conformityLabels[cat] ?? cat}</span>
                    </label>
                  </div>
                ))}
              </div>
              <Enregistrer libelle="Enregistrer la conformité" classes="mt-2" />
            </form>
          </Rubrique>

          <Rubrique
            id="secSurveillance"
            bi="bi-shield-lock"
            titre="Surveillance"
            badge={
              p.ctMonitoring ? (
                <BadgeOk libelle="CT activé" />
              ) : (
                <span className="badge bg-secondary ms-2">CT désactivé</span>
              )
            }
            aide="Veille Certificate Transparency et suivi des logiciels : ce qui se surveille sans date d'échéance."
          >
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_ct" />
              <Interrupteur
                id="ctMonitoring"
                name="ct_monitoring"
                label="Certificate Transparency (crt.sh)"
                checked={p.ctMonitoring}
              />
              <p className="text-muted small mt-1 mb-2">
                Scan quotidien des journaux CT pour détecter les certificats émis pour vos domaines
                à l'insu de la DSI (shadow IT, prestataire, usurpation). Les alertes suivent la
                catégorie « Domaines ».
              </p>
              <Enregistrer />
            </form>
            <hr />
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_software_alerts" />
              <Interrupteur
                id="softwareAlerts"
                name="software_alerts"
                label="Alertes logiciels"
                checked={p.softwareAlerts}
              />
              <p className="text-muted small mt-1 mb-2">
                Chaque lundi, un mail pour les logiciels en fin de vie sans successeur et ceux dont
                le nombre d'utilisateurs dépasse le plafond du contrat. Les alertes suivent la
                catégorie « Logiciels ».
              </p>
              <Enregistrer />
            </form>
          </Rubrique>
          <div className="form-famille">Messagerie &amp; alertes</div>

          <Rubrique
            id="secMail"
            bi="bi-envelope"
            titre="Messagerie"
            badge={
              p.mailConfigured ? (
                <BadgeOk libelle="Configuré" />
              ) : (
                <span className="badge bg-danger ms-2">
                  <Icone bi="bi-x-circle" taille="1em" classes="me-1" />
                  Non configuré
                </span>
              )
            }
            aide="Le compte qui envoie les alertes, les bilans et les envois de test."
          >
            <div className="d-flex align-items-center gap-2 mb-3">
              <form method="POST" action="/preferences" className="d-flex align-items-center gap-2">
                <Csrf csrf={csrf} />
                <input type="hidden" name="action" value="set_mail_method" />
                <label className="text-muted small mb-0" style={{ width: 90 }} htmlFor="mailMethod">
                  Méthode
                </label>
                <select
                  name="mail_method"
                  id="mailMethod"
                  className="form-select form-select-sm"
                  style={{ width: "auto" }}
                  defaultValue={p.mailMethod}
                  data-soumettre-au-changement=""
                >
                  <option value="o365">Office 365 (Graph API)</option>
                  <option value="smtp">SMTP</option>
                </select>
              </form>
              <form method="POST" action="/preferences" className="ms-auto">
                <Csrf csrf={csrf} />
                <input type="hidden" name="action" value="save_mail_enabled" />
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="mailEnabled"
                    name="mail_enabled"
                    defaultChecked={p.mailEnabled}
                    data-soumettre-au-changement=""
                  />
                  <label className="form-check-label fw-medium" htmlFor="mailEnabled">
                    Envoi des mails
                  </label>
                </div>
              </form>
            </div>

            {p.mailMethod === "o365" ? (
              <div className="data-card p-3 mb-0" style={{ background: "var(--body-bg)" }}>
                <h6 className="fw-bold small mb-2">
                  <Icone bi="bi-microsoft" taille="1em" classes="me-1" />
                  Configuration Office 365
                </h6>
                <form method="POST" action="/preferences">
                  <Csrf csrf={csrf} />
                  <input type="hidden" name="action" value="save_o365" />
                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label small" htmlFor="o365ClientId">
                        Client ID (Application ID)
                      </label>
                      <input
                        type="text"
                        name="o365_client_id"
                        id="o365ClientId"
                        className="form-control form-control-sm"
                        defaultValue={p.o365.client_id}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small" htmlFor="o365ClientSecret">
                        Client Secret
                      </label>
                      <input
                        type="password"
                        name="o365_client_secret"
                        id="o365ClientSecret"
                        className="form-control form-control-sm"
                        defaultValue={p.o365.client_secret}
                        placeholder="Entrez le secret client"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small" htmlFor="o365TenantId">
                        Tenant ID (Directory ID)
                      </label>
                      <input
                        type="text"
                        name="o365_tenant_id"
                        id="o365TenantId"
                        className="form-control form-control-sm"
                        defaultValue={p.o365.tenant_id}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small" htmlFor="o365Sender">
                        Email emetteur
                      </label>
                      <input
                        type="email"
                        name="o365_sender_email"
                        id="o365Sender"
                        className="form-control form-control-sm"
                        defaultValue={p.o365.sender_email}
                        placeholder="sentinelle@votredomaine.com"
                      />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label small" htmlFor="o365Redirect">
                        URL de redirection
                      </label>
                      <input
                        type="url"
                        name="o365_redirect_uri"
                        id="o365Redirect"
                        className="form-control form-control-sm"
                        defaultValue={p.o365.redirect_uri}
                        placeholder="http://127.0.0.1:3000/auth/o365/callback"
                      />
                      <small className="text-muted">
                        Ajoutez cette URL dans Azure AD &gt; Authentication &gt; Add a platform &gt;
                        Web
                      </small>
                    </div>
                  </div>
                  <Enregistrer libelle="Enregistrer la configuration" classes="mt-2" />
                </form>

                <hr className="my-3" />

                {p.o365AppConfigured ? (
                  p.o365Connected ? (
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <span className="badge bg-success me-2">
                          <Icone bi="bi-check-circle" taille="1em" classes="me-1" />
                          Connecte
                        </span>
                        <span className="fw-medium">{p.o365UserEmail}</span>
                      </div>
                      <form method="POST" action="/preferences">
                        <Csrf csrf={csrf} />
                        <input type="hidden" name="action" value="disconnect_o365" />
                        <button type="submit" className="btn btn-sm btn-outline-danger">
                          <Icone bi="bi-box-arrow-right" taille="1em" classes="me-1" /> Deconnecter
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <a href="/auth/o365/connect" className="btn btn-primary">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 23 23"
                          width="18"
                          height="18"
                          style={{ verticalAlign: "middle", marginRight: 8 }}
                          aria-hidden="true"
                        >
                          <path fill="#f25022" d="M1 1h10v10H1z" />
                          <path fill="#00a4ef" d="M12 1h10v10H12z" />
                          <path fill="#7fba00" d="M1 12h10v10H1z" />
                          <path fill="#ffb900" d="M12 12h10v10H12z" />
                        </svg>
                        Se connecter avec Microsoft
                      </a>
                      <p className="text-muted mt-2 mb-0 small">
                        Cliquez pour autoriser Sentinelle a envoyer des emails via votre compte
                      </p>
                    </div>
                  )
                ) : (
                  <div className="alert alert-info py-2 small mb-0">
                    <Icone bi="bi-info-circle" taille="1em" classes="me-1" />
                    <strong>Configuration Azure AD requise :</strong>
                    <ol className="mt-1 mb-0 ps-3">
                      <li>
                        Aller sur <strong>portal.azure.com</strong> &gt; Azure Active Directory &gt;
                        App registrations &gt; New registration
                      </li>
                      <li>
                        Ajouter la permission <strong>Mail.Send</strong> (Delegated) sous Microsoft
                        Graph
                      </li>
                      <li>
                        Dans <strong>Authentication</strong> &gt; Add a platform &gt; Web, ajoutez
                        l'URL de redirection ci-dessus
                      </li>
                      <li>
                        Creer un secret client dans <strong>Certificats &amp; secrets</strong>
                      </li>
                      <li>Renseigner les champs ci-dessus et enregistrer</li>
                      <li>
                        Cliquer sur <strong>Se connecter avec Microsoft</strong> pour autoriser
                        l'envoi
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <div className="data-card p-3 mb-0" style={{ background: "var(--body-bg)" }}>
                <h6 className="fw-bold small mb-2">
                  <Icone bi="bi-envelope" taille="1em" classes="me-1" />
                  Configuration SMTP
                </h6>
                <form method="POST" action="/preferences">
                  <Csrf csrf={csrf} />
                  <input type="hidden" name="action" value="save_smtp" />
                  <div className="row g-2">
                    <div className="col-md-8">
                      <label className="form-label small" htmlFor="smtpServer">
                        Serveur
                      </label>
                      <input
                        type="text"
                        name="smtp_server"
                        id="smtpServer"
                        className="form-control form-control-sm"
                        defaultValue={p.smtp.server}
                        placeholder="smtp.office365.com"
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small" htmlFor="smtpPort">
                        Port
                      </label>
                      <input
                        type="number"
                        name="smtp_port"
                        id="smtpPort"
                        className="form-control form-control-sm"
                        defaultValue={p.smtp.port}
                        placeholder="587"
                      />
                    </div>
                    <div className="col-md-2 d-flex align-items-end">
                      <span className="text-muted small">587 = TLS</span>
                    </div>
                    <div className="col-md-12">
                      <label className="form-label small" htmlFor="smtpSender">
                        Adresse expeditrice (From)
                      </label>
                      <input
                        type="email"
                        name="smtp_sender"
                        id="smtpSender"
                        className="form-control form-control-sm"
                        defaultValue={p.smtp.sender}
                        placeholder="sentinelle@votredomaine.fr"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small" htmlFor="smtpUser">
                        Utilisateur <span className="text-muted">(optionnel)</span>
                      </label>
                      <input
                        type="text"
                        name="smtp_username"
                        id="smtpUser"
                        className="form-control form-control-sm"
                        defaultValue={p.smtp.username}
                        placeholder="laisser vide pour Direct Send"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small" htmlFor="smtpPassword">
                        Mot de passe <span className="text-muted">(optionnel)</span>
                      </label>
                      <input
                        type="password"
                        name="smtp_password"
                        id="smtpPassword"
                        className="form-control form-control-sm"
                        placeholder="laisser vide pour Direct Send"
                      />
                    </div>
                  </div>
                  <div className="alert alert-info py-2 small mt-2 mb-0">
                    <Icone bi="bi-info-circle" taille="1em" classes="me-1" />
                    <strong>Direct Send (recommande, sans mot de passe) :</strong> Serveur ={" "}
                    <code>votredomaine-fr.mail.protection.outlook.com</code>, Port = <code>25</code>
                    , Utilisateur et Mot de passe <strong>vides</strong>. L'adresse expeditrice doit
                    etre de votre domaine et les destinataires internes.
                  </div>
                  <Enregistrer libelle="Enregistrer la configuration SMTP" classes="mt-2" />
                </form>
              </div>
            )}
          </Rubrique>

          <Rubrique
            id="secRecipients"
            bi="bi-people"
            titre="Destinataires & test d'envoi"
            badge={p.configured.recipients ? <BadgeOk libelle="Configuré" /> : null}
            aide="Qui reçoit les alertes et le bilan PDF planifié ; un envoi de test pour vérifier."
          >
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_recipients" />
              <label className="form-label small" htmlFor="alertRecipients">
                Adresses qui recevront les alertes automatiques{" "}
                <span className="text-muted">
                  (separees par des virgules ou des retours a la ligne)
                </span>
              </label>
              <textarea
                name="alert_recipients"
                id="alertRecipients"
                rows={2}
                className="form-control form-control-sm"
                placeholder="dsi@votredomaine.fr, sauvegarde@votredomaine.fr"
                defaultValue={p.alertRecipients}
              />

              <details className="mt-3" open={parCatRempli}>
                <summary className="small fw-bold" style={{ cursor: "pointer" }}>
                  <Icone bi="bi-diagram-3" taille="1em" classes="me-1" />
                  Destinataires par catégorie{" "}
                  <span className="text-muted fw-normal">
                    — optionnel : une catégorie sans adresse utilise la liste globale ci-dessus
                  </span>
                </summary>
                <div className="row g-2 mt-1">
                  {Object.entries(p.alertCategoryLabels).map(([cat, label]) => (
                    <div key={cat} className="col-md-6">
                      <label className="form-label small mb-1" htmlFor={`rcpt_${cat}`}>
                        {label}
                      </label>
                      <input
                        type="text"
                        id={`rcpt_${cat}`}
                        name={`alert_recipients_${cat}`}
                        className="form-control form-control-sm"
                        defaultValue={
                          p.alertRecipientsByCat[cat as keyof typeof p.alertRecipientsByCat]
                        }
                        placeholder="— liste globale —"
                      />
                    </div>
                  ))}
                </div>
              </details>

              <Enregistrer libelle="Enregistrer les destinataires" classes="mt-3" />
            </form>

            <hr />
            <h6 className="fw-bold mb-2">
              <Icone bi="bi-file-earmark-pdf" taille="1em" classes="me-2" />
              Bilan PDF planifié
            </h6>
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_report" />
              <div className="row g-2 align-items-end">
                <div className="col-md-3">
                  <label className="form-label small" htmlFor="reportSchedule">
                    Fréquence d'envoi
                  </label>
                  <select
                    name="report_schedule"
                    id="reportSchedule"
                    className="form-select form-select-sm"
                    defaultValue={p.reportSchedule}
                  >
                    <option value="off">Désactivé</option>
                    <option value="weekly">Hebdomadaire (lundi)</option>
                    <option value="monthly">Mensuel (le 1er)</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="reportRecipients">
                    Destinataires{" "}
                    <span className="text-muted">(vide = destinataires des alertes)</span>
                  </label>
                  <input
                    type="text"
                    name="report_recipients"
                    id="reportRecipients"
                    className="form-control form-control-sm"
                    defaultValue={p.reportRecipients}
                    placeholder="direction@votredomaine.fr"
                  />
                </div>
                <div className="col-md-3 d-flex gap-2">
                  <Enregistrer />
                </div>
              </div>
            </form>
            <form method="POST" action="/preferences" className="mt-2">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="send_report_now" />
              <button type="submit" className="btn btn-sm btn-outline-secondary">
                <Icone bi="bi-send" taille="1em" classes="me-1" /> Envoyer le bilan maintenant
              </button>
            </form>

            <hr />
            <h6 className="fw-bold mb-2">
              <Icone bi="bi-send" taille="1em" classes="me-2" />
              Test d'envoi
            </h6>
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <div className="row g-2 align-items-end">
                <div className="col-md-6">
                  <label className="form-label small" htmlFor="testEmail">
                    Destinataire
                  </label>
                  <input
                    type="email"
                    name="test_email"
                    id="testEmail"
                    className="form-control form-control-sm"
                    defaultValue={admin.email}
                    placeholder="email@exemple.com"
                  />
                </div>
                <div className="col-md-6 d-flex gap-2">
                  <button
                    type="submit"
                    name="action"
                    value="test_email"
                    className="btn btn-sm btn-primary mt-2"
                    disabled={!p.mailConfigured}
                  >
                    <Icone bi="bi-send" taille="1em" classes="me-1" /> Email de test
                  </button>
                  <button
                    type="submit"
                    name="action"
                    value="send_digest"
                    className="btn btn-sm btn-outline-primary mt-2"
                    disabled={!p.mailConfigured}
                  >
                    <Icone bi="bi-clipboard-data" taille="1em" classes="me-1" /> Envoyer un récap
                  </button>
                </div>
              </div>
            </form>
          </Rubrique>

          <Rubrique
            id="secThresholds"
            bi="bi-sliders"
            titre="Seuils d'alerte (jours restants)"
            badge={p.configured.thresholds ? <BadgeOk libelle="Personnalisé" /> : null}
            aide="Le nombre de jours restants qui fait passer un statut en Proche, Attention puis Critique."
          >
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_thresholds" />
              <table className="table table-sm align-middle mb-2">
                <thead>
                  <tr>
                    <th />
                    <th className="text-danger">Critique ≤</th>
                    <th className="text-warning">Attention ≤</th>
                    <th className="text-info">Proche ≤</th>
                  </tr>
                </thead>
                <tbody>
                  {lignesSeuils.map(([key, label]) => (
                    <tr key={key}>
                      <td className="fw-medium">{label}</td>
                      {(["danger", "warning", "info"] as const).map((niveau, i) => (
                        <td key={niveau}>
                          <input
                            type="number"
                            min={0}
                            name={`${key}_${niveau}`}
                            defaultValue={p.thresholds[key][i]}
                            className="form-control form-control-sm"
                            style={{ width: 90 }}
                            aria-label={`${label} : ${niveau}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Enregistrer libelle="Enregistrer les seuils" />
              <small className="text-muted d-block mt-1">
                Détermine la couleur de statut selon le nombre de jours restants avant échéance.
              </small>
            </form>
          </Rubrique>
          <div className="form-famille">Données</div>

          <Rubrique
            id="secDb"
            bi="bi-database"
            titre="Base de données"
            badge={
              p.dbBackups.length ? (
                <BadgeOk
                  libelle={`${p.dbBackups.length} sauvegarde${pluriel(p.dbBackups.length)}`}
                />
              ) : (
                <span className="badge bg-danger ms-2">
                  <Icone bi="bi-x-circle" taille="1em" classes="me-1" />
                  Aucune sauvegarde
                </span>
              )
            }
            aide="Copies de la base, pièces jointes comprises : rétention et sauvegarde manuelle."
          >
            <form method="POST" action="/preferences" className="mb-3">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_backup_keep" />
              <div className="row g-2 align-items-end">
                <div className="col-auto">
                  <label className="form-label small mb-1" htmlFor="backupDbKeep">
                    Sauvegardes conservées
                  </label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    id="backupDbKeep"
                    name="backup_db_keep"
                    min={1}
                    max={30}
                    defaultValue={p.backupDbKeep}
                    style={{ width: "6rem" }}
                    data-taille={p.dbTailleMo}
                  />
                </div>
                <div className="col-auto">
                  <Enregistrer />
                </div>
                <div className="col">
                  <small className="text-muted" id="backupKeepEstimation" />
                </div>
              </div>
              <div className="form-text">
                La plus ancienne part quand une nouvelle arrive. Une copie pèse autant que la base (
                {p.dbTailleMo} Mo aujourd'hui), pièces jointes comprises.
              </div>
            </form>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <small className="text-muted">
                {p.dbBackups.length} sauvegarde(s) conservée(s)
                {p.dbBackups.length ? ` — dernière le ${dateHeure(p.dbBackups[0].date)}` : ""}
              </small>
              <div className="d-flex gap-2">
                <div className="btn-group">
                  <a
                    href="/data/export-full.zip"
                    className="btn btn-sm btn-outline-success"
                    title="Archive ZIP (base + CSV + pièces jointes + page HTML) pour clé USB"
                    data-export-attente="Préparation de l'archive…"
                  >
                    <Icone bi="bi-usb-drive" taille="1em" classes="me-1" />
                    <span data-texte="Export complet">Export complet</span>
                  </a>
                  <a
                    href="/data/export-full.zip?sans_documents=1"
                    className="btn btn-sm btn-outline-secondary"
                    title="Même archive, sans les octets des pièces jointes : les fiches restent, leur contenu non"
                    data-export-attente="Préparation…"
                  >
                    <span data-texte="allégé">allégé</span>
                  </a>
                </div>
                <form method="POST" action="/preferences">
                  <Csrf csrf={csrf} />
                  <button
                    type="submit"
                    name="action"
                    value="backup_db"
                    className="btn btn-sm btn-outline-primary"
                  >
                    <Icone bi="bi-download" taille="1em" classes="me-1" /> Sauvegarder maintenant
                  </button>
                </form>
              </div>
            </div>
            {p.dbBackups.length ? (
              <>
                <ul className="list-group list-group-flush small">
                  {p.dbBackups.slice(0, 8).map((b) => (
                    <li
                      key={b.name}
                      className="list-group-item d-flex justify-content-between align-items-center px-0 bg-transparent"
                    >
                      <span>
                        <Icone bi="bi-file-earmark-zip" taille="1em" classes="me-1" />
                        {b.name}
                      </span>
                      <span className="d-flex align-items-center gap-2">
                        <span className="text-muted">
                          {dateHeure(b.date)} · {b.sizeKb} Ko
                        </span>
                        <a
                          href={`/data/db-backup/${encodeURIComponent(b.name)}`}
                          className="btn btn-sm btn-outline-primary py-0 px-1"
                          title="Télécharger"
                          aria-label="Télécharger"
                        >
                          <Icone bi="bi-download" taille="1em" />
                        </a>
                        <form method="POST" action="/preferences">
                          <Csrf csrf={csrf} />
                          <input type="hidden" name="action" value="delete_db_backup" />
                          <input type="hidden" name="name" value={b.name} />
                          <button
                            type="submit"
                            className="btn btn-sm btn-outline-danger py-0 px-1"
                            title="Supprimer"
                            aria-label="Supprimer"
                            data-confirm="Supprimer cette sauvegarde ?"
                          >
                            <Icone bi="bi-trash" taille="1em" />
                          </button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
                <small className="text-muted d-block mt-1">
                  Sauvegarde automatique quotidienne (01h00).
                </small>
              </>
            ) : null}
          </Rubrique>

          <Rubrique
            id="secDocuments"
            bi="bi-paperclip"
            titre="Pièces jointes"
            badge={
              p.documentsEnabled ? (
                <BadgeOk libelle={`Activées (${p.documentMaxMb} Mo)`} />
              ) : (
                <span className="badge bg-secondary ms-2">Désactivées</span>
              )
            }
            aide="Fichiers accrochés aux fiches : activation, taille maximale, affichage."
          >
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_documents" />
              <Interrupteur
                id="documentsEnabled"
                name="documents_enabled"
                label="Pièces jointes sur les fiches"
                checked={p.documentsEnabled}
              />
              <p className="text-muted small mt-1 mb-2">
                Marchés signés, délibérations, guides, attestations d'autorité — déposés sur la
                fiche qu'ils documentent. Les fichiers vivent <strong>en base</strong> : une
                sauvegarde de la base est complète à elle seule, aucun fichier ne peut se retrouver
                orphelin. Désactivées, elles disparaissent des écrans ; les fichiers déjà déposés
                restent en base.
              </p>
              <div className="mb-2">
                <Interrupteur
                  id="documentInlineView"
                  name="document_inline_view"
                  label="Ouvrir les documents dans le navigateur"
                  checked={p.documentInlineView}
                />
              </div>
              <p className="text-muted small mb-2">
                Ouvre les <strong>PDF et les images</strong> dans un nouvel onglet, sans les
                enregistrer d'abord — la fiche reste ouverte derrière, et le navigateur apporte sa
                visionneuse : zoom, recherche, impression. Les autres types se téléchargent
                toujours. Le SVG en est volontairement exclu : c'est du XML qui peut porter des
                scripts.
              </p>
              <div className="row g-2 align-items-end mb-2" style={{ maxWidth: "22rem" }}>
                <div className="col-7">
                  <label className="form-label small mb-1" htmlFor="documentMaxMb">
                    Taille maximale par fichier
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      id="documentMaxMb"
                      name="document_max_mb"
                      min={1}
                      max={100}
                      defaultValue={p.documentMaxMb}
                    />
                    <span className="input-group-text">Mo</span>
                  </div>
                </div>
              </div>
              <Enregistrer />
            </form>
          </Rubrique>

          <Rubrique
            id="secModules"
            bi="bi-toggles"
            titre="Modules"
            badge={
              modulesCoupes.length ? (
                <span className="badge bg-secondary ms-2">
                  {p.modules.length - modulesCoupes.length}/{p.modules.length} actifs
                </span>
              ) : (
                <BadgeOk libelle="Tous actifs" />
              )
            }
            aide="Les volets que la collectivité utilise ou non. Un module désactivé disparaît des écrans ; ce qui a été saisi reste en base et revient en le réactivant."
          >
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_modules" />
              {p.modules.map((m, i) => (
                <div key={m.name}>
                  <div className={`form-check form-switch${i ? " mt-3" : ""}`}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id={`module_${m.name}`}
                      name={`module_${m.name}`}
                      defaultChecked={m.on}
                    />
                    <label className="form-check-label fw-medium" htmlFor={`module_${m.name}`}>
                      {m.label}
                    </label>
                  </div>
                  <p className="text-muted small mt-1 mb-0">{m.help}</p>
                </div>
              ))}
              <Enregistrer classes="mt-3" />
            </form>
          </Rubrique>

          <Rubrique
            id="secReferentiels"
            bi="bi-list-ul"
            titre="Référentiels et services utilisateurs"
            aide="Listes de valeurs et services utilisateurs, gérés sur leur propre écran."
          >
            <p className="text-muted small mb-2">
              Les listes de valeurs proposées dans les formulaires — technologies applicatives,
              catégories de pièces jointes, types de tâches — et l'annuaire des services
              utilisateurs (directions de la collectivité), avec leur référent.
            </p>
            <p className="text-muted small mb-3">
              Seuls les libellés <strong>descriptifs</strong> s'y règlent : le cycle de vie d'un
              logiciel ou le statut d'un certificat pilotent des filtres et des couleurs, et restent
              fixes.
            </p>
            <a href="/referentiels" className="btn btn-sm btn-primary">
              <Icone bi="bi-arrow-right" taille="1em" classes="me-1" /> Gérer les référentiels
            </a>
          </Rubrique>
          <div className="form-famille">Affichage</div>

          <Rubrique
            id="secDashboard"
            bi="bi-grid-1x2"
            titre="Tableau de bord"
            badge={
              p.dashboardCustom ? (
                <BadgeOk libelle="Personnalisable" />
              ) : (
                <span className="badge bg-secondary ms-2">Disposition fixe</span>
              )
            }
            aide="Ce que chaque utilisateur peut réorganiser sur son tableau de bord."
          >
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_dashboard_custom" />
              <Interrupteur
                id="dashboardCustom"
                name="dashboard_custom"
                label="Tableau de bord personnalisable"
                checked={p.dashboardCustom}
              />
              <p className="text-muted small mt-1 mb-2">
                Chaque utilisateur peut choisir les blocs affichés sur son tableau de bord et les
                réordonner (bouton « Personnaliser » en haut du tableau de bord). Désactivé : tout
                le monde voit la disposition par défaut.
              </p>
              <Enregistrer />
            </form>
          </Rubrique>

          <Rubrique
            id="secListes"
            bi="bi-list"
            titre="Listes"
            badge={
              p.paginationMemory ? (
                <BadgeOk libelle="Pagination retenue" />
              ) : (
                <span className="badge bg-secondary ms-2">Dix lignes par défaut</span>
              )
            }
            aide="Ce dont les listes se souviennent pour chaque utilisateur."
          >
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_pagination_memory" />
              <Interrupteur
                id="paginationMemory"
                name="pagination_memory"
                label="Retenir la taille de page"
                checked={p.paginationMemory}
              />
              <p className="text-muted small mt-1 mb-2">
                Chaque utilisateur retrouve, liste par liste, le nombre de lignes par page qu'il a
                choisi sous le tableau (10, 15, 20… ou Tous). Désactivé : chaque liste repart à dix
                lignes, le choix ne valant que pour la page affichée.
              </p>
              <Enregistrer />
            </form>
          </Rubrique>

          <Rubrique
            id="secFiches"
            bi="bi-card-text"
            titre="Fiches"
            badge={
              p.ficheNavigation ? (
                <BadgeOk libelle="Précédent / Suivant" />
              ) : (
                <span className="badge bg-secondary ms-2">Sans feuilletage</span>
              )
            }
            aide="Ce que toutes les fiches ont en commun."
          >
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_fiche_navigation" />
              <Interrupteur
                id="ficheNavigation"
                name="fiche_navigation"
                label="Boutons Précédent / Suivant"
                checked={p.ficheNavigation}
              />
              <p className="text-muted small mt-1 mb-2">
                Deux chevrons en tête de chaque fiche pour passer à la précédente ou à la suivante
                dans l'ordre des noms, sans repasser par la liste — comme dans SoftInventory.
                Désactivé : on revient à la liste pour changer de fiche.
              </p>
              <Enregistrer />
            </form>
          </Rubrique>

          <Rubrique
            id="secForms"
            bi="bi-window-stack"
            titre="Formulaires"
            badge={
              anciens.length ? (
                <span className="badge bg-secondary ms-2">
                  Ancien formulaire : {anciens.join(", ")}
                </span>
              ) : (
                <BadgeOk libelle="Nouveaux formulaires" />
              )
            }
            aide="La présentation des formulaires de saisie, pour tous les utilisateurs."
          >
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_forms" />
              <Interrupteur
                id="softwareFormLegacy"
                name="software_form_legacy"
                label="Ancien formulaire des logiciels"
                checked={p.softwareFormLegacy}
              />
              <p className="text-muted small mt-1 mb-2">
                Ajout et modification d'un logiciel (page et onglet Détails) avec l'ancien
                formulaire : neuf rubriques numérotées, marchés, services et serveurs compris ;
                l'onglet Synthèse reprend ses anciennes rubriques. Désactivé : la grille de
                SoftInventory (Identité, Technique, RGPD), les rattachements se gérant dans les
                onglets Contrats et Liaisons, et une Synthèse qui en reprend les cartes, en lecture.
              </p>
              <Interrupteur
                id="contractFormLegacy"
                name="contract_form_legacy"
                label="Ancien formulaire des contrats"
                checked={p.contractFormLegacy}
              />
              <p className="text-muted small mt-1 mb-2">
                Ajout et modification d'un contrat (page et onglet Détails) avec l'ancien formulaire
                : rubriques numérotées avec leur aide, logiciels et équipements couverts en deux
                listes. L'onglet Synthèse reprend alors ses anciennes rubriques et la carte « Couvre
                ». Désactivé : la grille de SoftInventory, une seule carte « Contrat » et les
                éléments couverts en puces, et une Synthèse qui en reprend les cartes, en lecture.
                Le formulaire ouvert dans l'onglet Contrats d'un logiciel reste la grille.
              </p>
              <Interrupteur
                id="supplierFormLegacy"
                name="supplier_form_legacy"
                label="Ancien formulaire des fournisseurs"
                checked={p.supplierFormLegacy}
              />
              <p className="text-muted small mt-1 mb-2">
                Ajout et modification d'un fournisseur (page et onglet Détails) avec l'ancien
                formulaire : rubriques numérotées avec leur sommaire ; l'onglet Synthèse reprend ses
                anciennes rubriques. Désactivé : une seule carte à rubriques (Identité, Assistance,
                Contacts, Notes), et une Synthèse qui en reprend les rubriques, en lecture.
              </p>
              <Enregistrer />
            </form>
          </Rubrique>

          <Rubrique
            id="secAppearance"
            bi="bi-palette"
            titre="Apparence"
            badge={
              p.uiPrimaryColor ? (
                <span className="badge ms-2" style={{ background: p.uiPrimaryColor }}>
                  <Icone bi="bi-check-circle" taille="1em" classes="me-1" />
                  Personnalisée
                </span>
              ) : (
                <span className="badge bg-secondary ms-2">Palette d'origine</span>
              )
            }
            aide="Couleur principale de l'interface, pour tous les utilisateurs."
          >
            <form method="POST" action="/preferences">
              <Csrf csrf={csrf} />
              <input type="hidden" name="action" value="save_ui_color" />
              <p className="text-muted small mb-3">
                Couleur principale de l'interface (boutons, liens, onglets, logo, fond de la page de
                connexion), pour tous les utilisateurs. Elle s'applique aussi au thème sombre
                (déclinaison éclaircie). Décochée : palette d'origine (indigo). Choisissez une
                couleur foncée, le texte posé dessus est blanc.
              </p>
              <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="uiColorEnabled"
                    name="ui_color_enabled"
                    defaultChecked={Boolean(p.uiPrimaryColor)}
                  />
                  <label className="form-check-label fw-medium" htmlFor="uiColorEnabled">
                    Couleur personnalisée
                  </label>
                </div>
                <input
                  type="color"
                  className="form-control form-control-color"
                  name="ui_primary_color"
                  defaultValue={p.uiPrimaryColor || "#4f46e5"}
                  title="Choisir la couleur principale"
                />
              </div>
              <Enregistrer />
            </form>
          </Rubrique>
        </div>
      </div>

      <ScriptDiffere code={SECTION_JS} nonce={nonce} />
      <ScriptDiffere code={ESTIMATION_JS} nonce={nonce} />
      <ScriptDiffere code={EXPORT_JS} nonce={nonce} />
      <ScriptDiffere code={SOMMAIRE_JS} nonce={nonce} />
    </>
  );
}
