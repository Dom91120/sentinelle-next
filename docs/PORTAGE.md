# Portage Sentinelle (Flask / SQLite) → sentinelle-next (Next.js / PostgreSQL)

Inventaire exhaustif de l'application d'origine (`sentinelle`, commit `7db9d6a`) et liste de
contrôle du clone. Chaque ligne est cochée quand l'élément est porté **à l'identique** (même
écran, mêmes options, mêmes règles) et vérifié côte à côte. Les lignes restantes en fin de
chantier sont listées dans la section « Reste à faire » avec leur raison.

Légende : `[x]` porté et vérifié · `[~]` porté, à vérifier côte à côte · `[ ]` à faire.

## 1. Socle technique (identique à culturesa-next)

- [x] Next.js 16 App Router, `output: "standalone"`, en-têtes de sécurité statiques, CSP par nonce (`src/proxy.ts`, `src/lib/csp.ts`)
- [x] Prisma 7 + `@prisma/adapter-pg`, client généré dans `src/generated/prisma`, `prisma.config.ts`
- [x] Better Auth 1.7 (emailAndPassword + plugin `username`, twoFactor, nextCookies, rateLimit en base)
- [x] Tailwind v4 présent dans le socle (`@tailwindcss/postcss`) mais rien n'en est chargé : ses utilitaires homonymes de classes Bootstrap (`collapse`, `col-6`, `table`…) s'appliquaient par-dessus. Feuille héritée `public/css/sentinelle.css` (= `static/css/style.css`, plus une section « Ajustements sentinelle-next » en fin de fichier), liée dans le `<head>` après Bootstrap comme dans `base.html`, avec une version calculée du fichier (`static_v`)
- [x] Zod 4, Nodemailer 10, Puppeteer 25 (PDF), qrcode.react, chart.js
- [x] Biome 2 (lint + format), Vitest 4, pnpm 11, Node ≥ 22
- [x] Dockerfile multi-stage node:22-alpine (chromium, postgresql18-client, uid 10001), `docker-entrypoint.sh` (migrate deploy)
- [x] docker-compose : `app` + `db` (postgres:18.6-alpine) + `cron` (busybox crond → `/api/cron/*`) + profil `init`
- [x] CI GitHub (`ci.yml` lint/typecheck/test/audit/docker build, `codeql.yml`), `dependabot.yml`
- [x] Actifs statiques repris tels quels : Bootstrap 5.3.3, Bootstrap Icons 1.11.3, sprite Lucide, polices IBM Plex, `logo.svg`

## 2. Modèles de données (`app/models.py` → `prisma/schema.prisma`)

Tables reprises nom pour nom (`@@map`), colonnes `snake_case` (`@map`) :

- [x] `app_config`, `setting`, `eol_cache`, `webhook`, `role`
- [x] `user` (+ tables Better Auth `session`, `auth_account`, `verification`, `two_factor`, `rate_limits`)
- [x] `account`, `account_history`
- [x] `certificate`, `certificate_history`
- [x] `backup`, `backup_check` (unique backup_id+check_date), `backup_history`
- [x] `test_task`, `test_history`
- [x] `domain`, `domain_history`, `ct_log_entry`
- [x] `access_review`, `review_history`
- [x] `system_update`, `update_history`
- [x] `equipment`
- [x] `supplier`
- [x] `contract`, `contract_history`, `contract_equipment`, `contract_software`
- [x] `consultation`, `quote`
- [x] `referential`, `user_service`, `software_service`
- [x] `software`, `software_equipment`, `software_link`, `software_share`
- [x] `document`, `document_content` (octets à part)
- [x] `scheduler_run`, `import_map`, `action_log`, `login_throttle`, `alert_log`, `alert_snooze`

Logique métier des modèles (à porter en TypeScript pur, `src/lib/statuts.ts` et voisins) :

- [x] `DEFAULT_THRESHOLDS` et `_status_from_days` (EXPIRY 7/15/30, DOMAIN 30/60/90, TASK 7/15/30, CONTRACT 60/90/180, WARRANTY 30/60/90)
- [x] `PERMISSION_CATEGORIES`, `CATEGORY_LABELS`, `PERMISSION_INHERITANCE`, `PERMISSION_LEVELS`, `CONFORMITY_CATEGORIES`
- [x] `User.perm_level` / `can_view` / `can_edit` / `can_delete` / `is_admin`
- [x] `Account.status()` (prochain changement de mot de passe)
- [x] `Certificate.label()`, `monitored()`, `status()` (sans date → warning, révoqué → success), `kind`, `validity`
- [x] `Backup` : périodes (daily 1 / weekly 7 / monthly 31, tolérance 1/2/5), `today_check`, `last_ok_check`, `computed_status`, `success_rate(first_status)`, `streak`
- [x] `TestTask.computed_status`, `AccessReview.computed_status`, `SystemUpdate.status_color`
- [x] `Domain.status()`, `for_host()`, `rattacher_certificats()`
- [x] `Equipment` : `warranty_status`, `os_update_stale` (365 j), `missing_backup`, `linked_items`, `eol_info`, `computed_status`, `status_reasons`, constantes KINDS / FAMILIES / KIND_GROUPS / ENVIRONMENT / CRITICALITY
- [x] `Contract` : `action_deadline`, `days_left`, `status`, `en_cours`, `renewal_label`, `period_label`, CONTRACT_KIND_LABELS, CONTRACT_NATURE_LABELS
- [x] `Software.computed_status` (mises à jour + fin de vie), HOSTING / LIFECYCLE / SOURCE_TYPE / AUTH_MODE / DATA_LOCATION labels
- [x] `Supplier.has_contacts`, SUPPLIER_KIND_LABELS
- [x] `Referential` : REFERENTIAL_KINDS, REFERENTIAL_SCOPES, SEEDS ; `Document.has_file()`, DOCUMENT_PARENTS

## 3. Démarrage et migrations (`create_app`)

- [x] `_seed_roles` (admin / editor niveau 3 sauf alerts=1 / viewer niveau 1), `_migrate_roles` (PERMISSION_INHERITANCE)
- [x] `_seed_referentials` (SEEDS), `_migrate_contract_kinds`, `_migrate_certificate_lists`, `_migrate_referential_scopes`
- [x] `_seed_default_user` : admin avec mot de passe aléatoire affiché en console (ou `ADMIN_INITIAL_PASSWORD`), réinitialisation d'un admin encore en `admin`
- [x] `config_store.seed_from_env` / `load` (clés MANAGED, secrets chiffrés)
- [x] `_migrate_data` (rapprochements par nom → `*_id`, sans toucher un lien posé)
- [x] Journalisation JSON (fichier tournant) → `src/server/log.ts`
- [x] Script de reprise `scripts/reprise-sqlite.ts` : SQLite `instance/admin_dashboard.db` → PostgreSQL, documents inclus, mots de passe Werkzeug conservés, secrets Fernet déchiffrés avec `SENTINELLE_SECRET_KEY`, secrets TOTP repris

## 4. Transversal

- [x] Décorateurs : `login_required`, `require_edit`, `require_delete`, `require_admin`, `view_guard` (`_BP_CATEGORY`) → `src/server/guards.ts`
- [x] `features.py` : quotes / gdpr / links / certificates, `MODULE_CATEGORIES`, `enabled`, `category_enabled`, `require`
- [x] `config_store` : MANAGED, `_BOOL`, `_INT`, `_TRIPLET`, `_CSV`, ALERT_CATEGORIES / LABELS, chiffrement des secrets
- [x] `app_settings.conformity_categories`
- [x] `audit.py` (ActionLog), `snooze.py` (VALID_TYPES, `permission_category`, `get_active_snooze`)
- [x] `paging.py` (PER_PAGE 10, choix 10/25/50/100/200/all, mémoire par utilisateur `list_prefs`)
- [x] `forms_util.py` (`parse_date`, `parse_int`, `parse_float`, STATUS_RANK)
- [x] `voisins.py` (précédent / suivant), `theming.py` (UI_PRIMARY_COLOR, logo teinté), `libelles.py` (STATUS_LABELS, `delai`, `montant`, `date_longue`)
- [x] `navigation.py` : DOMAINES (aujourdhui / echeances / exploitation / parc), ADMINISTRATION, `_ORPHELINS`, RUBRIQUES, GENERIQUES, `lucide_de`, `couleur_icone`, `fil_ariane`
- [x] Processeurs de contexte : `features`, `active_snooze`, `alert_permission`, `role_label`, `ui_primary_css`, `inject_nav_counts` (compteurs danger par catégorie hors reports, cache 60 s, compteurs corbeille), `inject_navigation`
- [x] Filtres Jinja `delai`, `date_longue`, `montant`, `manques` ; globaux `status_label`, `compte`, `jours`, `STATUS_LABELS`, `EQUIPMENT_KIND_ICONS`, `equipment_kinds`, `static_v`
- [x] Messages flash (catégories success / danger / warning / info) → cookie + alertes Bootstrap
- [x] CSRF global (jeton `sentinelle_csrf` posé par `src/proxy.ts`, vérifié sur toute route POST) ; `LoginThrottle` par (identifiant, IP)
- [~] Limiteur de requêtes Flask-Limiter (200/min et 2 000/h par IP, 60 ou 120/min sur `/api/*`) : non porté — Better Auth limite ses propres points d'entrée (`rate_limits`), le reste est à confier au reverse proxy
- [x] `_enforce_admin_2fa` (REQUIRE_2FA_ADMIN)
- [x] `health.py` (`/health`, `/healthz`)

## 5. Authentification (`auth.py`)

- [x] `GET/POST /login` : identifiant + mot de passe, local puis LDAP, LoginThrottle par (identifiant, IP) avec LOGIN_MAX_ATTEMPTS / LOGIN_LOCKOUT_MINUTES, `next` sûr
- [x] `GET/POST /2fa` (code TOTP, compteur d'échecs en base, verrouillage)
- [x] `/logout`
- [x] `GET/POST /profile` : `change_password`, `init_2fa` (QR code), `confirm_2fa`, `disable_2fa`
- [x] `/logo.svg` (logo teinté UI_PRIMARY_COLOR)
- [x] `/auth/o365/connect`, `/auth/o365/callback` (MSAL, jeton chiffré)
- [x] `ldap_auth.py` : bind UPN / DN template, groupe requis, LDAPS + CA, provisionnement `LDAP_DEFAULT_ROLE`, `sync_ad_passwords`

### Préférences (`GET/POST /preferences`, 935 lignes de gabarit)

- [x] Messagerie : `save_mail_enabled`, `set_mail_method` (smtp / o365), `save_smtp`, `save_o365`, `disconnect_o365`, `test_email`
- [x] Destinataires : `save_recipients` (globale + une liste par catégorie ALERT_CATEGORIES)
- [x] Bilan PDF : `save_report` (off / weekly / monthly + destinataires), `send_report_now`
- [x] Bilan quotidien : `send_digest`
- [x] Certificate Transparency : `save_ct`
- [x] Modules : `save_modules` (devis, RGPD, flux, certificats)
- [x] Alertes logiciels : `save_software_alerts`
- [x] Pièces jointes : `save_documents` (activées, taille max Mo, aperçu dans la page)
- [x] Tableau de bord personnalisable : `save_dashboard_custom`
- [x] Mémoire de pagination : `save_pagination_memory`
- [x] Navigation entre fiches : `save_fiche_navigation`
- [x] Formulaires : `save_forms` (anciens formulaires logiciels / contrats / fournisseurs)
- [x] Apparence : `save_ui_color`
- [x] Sauvegarde de la base : `save_backup_keep`, `backup_db`, `delete_db_backup`, liste des copies
- [x] LDAP / AD : `save_ldap`, `test_ldap`
- [x] Seuils : `save_thresholds` (4 triplets)
- [x] Conformité : `save_conformity` (catégories)

## 6. Tableau de bord, agenda, tendances, corbeille (`dashboard.py`)

- [x] `/` : cartes de statistiques (STAT_CARDS), blocs DASHBOARD_WIDGETS, `urgent_items`, `horizons`, `upcoming`, conformité, actions rapides (`quick-check`) — même ordre des fiches (chargement dans l'ordre des id, comme `query.all()`)
- [x] `/dashboard/layout` (JSON : ordre, masqués, largeurs, cartes) + `dashboard-custom.js`
- [x] `/quick-check` (check de sauvegarde / action rapide depuis le tableau de bord)
- [x] `/etat/<status>` (by_status.html)
- [x] `/tendances` (trends.html : doughnut, courbe, barres Chart.js)
- [x] `/agenda`, `/agenda.ics` (jeton), `/agenda/ics-token`
- [x] `/trash`, `/trash/restore`, `/trash/purge-one`, `/trash/purge` (`trash.py` SPECS)
- [x] `/rapport.pdf` (`pdf_report.py`)
- [x] `/healthz`

## 7. Modules (liste, fiche, formulaire, synthèse, historique, actions)

### Comptes (`/accounts`)
- [x] liste (filtres statut, recherche, pagination, tri), `/sync-ad`
- [x] création / édition (`_form_corps`), fiche (`_synthese`, historique, documents, voisins), `/password-changed`, `/delete`, PDF

### Certificats (`/certificates`, module débrayable)
- [x] liste (TLS / électroniques, filtres), `/check-domain` (vérif TLS à la volée)
- [x] création / édition (deux natures, usage/support référentiels, titulaire, montant), fiche, `/renew`, `/check-tls`, `/delete`, PDF, documents

### Domaines (`/domains`)
- [x] liste, `/check-rdap-domain`, création / édition (registrar lié), fiche (frise, certificats rattachés, journal CT), `/scan-ct`, `/ct-ack`, `/check-rdap`, `/delete`, PDF

### Sauvegardes (`/backups`)
- [x] liste, `/daily` (pointage quotidien ; la date du jour y est en français, là où `strftime('%A %d %B %Y')` suit la locale du serveur), `/stats`, fiche (checks, taux de réussite, série), création / édition, `/check`, `/delete`
- [x] `/ingest` (jeton BACKUP_INGEST_TOKEN), `/scan-inbox`, `backup_ingest.py` (analyse de mails .eml/.txt/.html)

### Tests récurrents (`/tests`)
- [x] liste, `/kanban`, `/set-status`, création / édition (TEST_TYPES), fiche, `/complete`, `/delete`, PDF

### Revues de droits (`/reviews`)
- [x] liste, création / édition (logiciel lié), fiche, `/complete`, `/delete`

### Mises à jour (`/updates`)
- [x] liste, création / édition (équipement / logiciel cible), fiche, `/mark-updated`, `/delete`

### Inventaire matériel (`/inventory`)
- [x] liste (filtres par famille / type / environnement / criticité, colonnes, tri, `filtres-colonnes.js`, `_inventory_nav`), `/quick-create`
- [x] création / édition (toutes les rubriques), fiche (synthèse, éléments liés, EOL, raisons de statut), `/delete`
- [x] `/import` (xlsx, `inventory_import.py`)

### Logiciels (`/inventory/logiciels`)
- [x] liste (filtres, tri), `/quick-create`, création / édition (nouveau formulaire et ancien `_form_corps_ancien`), fiche à onglets (synthèse, contacts, flux, contrats, consultations/devis, partages, documents, suivi)
- [x] `/services`, `/servers`, `/servers/<id>/detach`, `/links/add|edit|delete`, `/shares/add|delete`, `/delete`

### Contrats et marchés (`/contracts`)
- [x] liste (`_tableau`), `/quick-create`, création / édition (nouveau et ancien), fiche, `/renew`, `/delete`
- [x] `/software/<id>/attach`, `/<id>/software/<id>/detach`
- [x] consultations `/consultations/<software>/add`, `/consultations/<id>/delete`, devis `/quotes/add`, `/quotes/<id>/select`, `/quotes/<id>/delete` (module devis)

### Fournisseurs (`/suppliers`)
- [x] liste, `/quick-create`, création / édition (nouveau et ancien), fiche (synthèse, contacts, éléments liés), `/delete`

### Alertes (`/alerts`)
- [x] liste (journal AlertLog), `/snooze`, `/unsnooze` (`_snooze_card`)

### Utilisateurs et rôles (`/users`, admin)
- [x] liste, création / édition, `/reset-2fa`, `/delete`
- [x] `/roles`, `/roles/create`, `/roles/<id>/save`, `/roles/<id>/delete` (grille catégories × niveaux)
- [x] `/audit` (ActionLog, plafond 3000), `/scheduler` (SchedulerRun)

### Recherche (`/search`), Connecteurs (`/connecteurs`), Référentiels (`/referentiels`), Pièces jointes
- [x] `/search` (toutes entités, Ctrl K)
- [x] `/connecteurs` : cartes API (Sesame, chatIA), `/webhooks`, `/sesame`, `/chatia`
- [x] `/referentiels` : `/add`, `/<id>/scope`, `/<id>/delete`, services `/services/add|edit|delete`
- [x] `/documents/upload`, `/<id>/file`, `/<id>/download`, `/<id>/view` (INLINE_TYPES), `/<id>/edit`, `/<id>/delete` (ALLOWED_EXTENSIONS, DOCUMENT_MAX_MB)

### Imports / exports (`/data`), PDF, API
- [x] `/data/export-full.zip` (`full_export.py`), `/data/<key>/export.csv`, `/template.csv`, `/import` (`csv_io.py` SPECS)
- [x] `/accounts|certificates|domains|tests/<id>/pdf` (`pdf_entity.py`, `pdf_export.py`)
- [x] `/api/assets` (Sesame, Bearer), `/api/chatia/echeances|alertes|synthese|recherche` (`suivi.py`), `/api/directory/search`, `/api/alert-count`

## 8. Tâches planifiées (`scheduler.py` → `/api/cron/*` + `instrumentation.ts`)

- [x] `scan_backup_inbox` (toutes les 30 min si BACKUP_INBOX_DIR)
- [x] `backup_database` 01:00 (`db_backup.py` → `pg_dump --format=custom`, rétention BACKUP_DB_KEEP ; `pg_dump` doit être sur le PATH ou désigné par `PG_DUMP_BIN`, commande avec arguments admise, et `PG_DUMP_URL` donne l'URL vue par pg_dump s'il tourne ailleurs, par exemple dans le conteneur Postgres)
- [x] `sync_ad_passwords` 06:00 (si LDAP)
- [x] `check_ct_logs` 06:30 (`ct_monitor.py`, `ct_checker.py`)
- [x] `refresh_eol_cache` 06:50 (`eol.py`)
- [x] `refresh_certificates_tls` 07:00 (`cert_checker.py`)
- [x] `refresh_domains_rdap` 07:10 (`domain_checker.py`)
- [x] `send_daily_digest` 07:30 (`digest.py`)
- [x] `send_scheduled_report` 07:40 (REPORT_SCHEDULE)
- [x] `check_passwords` 08:00, `check_certificates` 08:15, `check_domains` 08:20, `check_backups` 08:30, `check_contracts` 08:40, `check_tests` 08:45, `check_reviews` 08:50, `check_updates` 08:55, `check_inventory` 08:58, `check_software` 09:00 (lundi)
- [x] Journal SchedulerRun (500 lignes conservées), statut sur `/users/scheduler`
- [x] `alerts.py` : `should_send_reminder` (cadence 7 / 2 / 1 j), `alert_recipients_for`, `send_alert` (anti-doublon du jour)
- [x] `email_service.py` : SMTP et Graph (O365), `render_alert_email` ; `notify.py` : Teams (adaptive / legacy), Slack, Discord, `notify_all`

## 9. Interface (gabarits Jinja → composants React)

- [x] `base.html` : barre latérale (recherche Ctrl K, domaines, administration en `<details>`, pied utilisateur), alertes flash, fil d'Ariane, thème clair / sombre, mobile
- [x] Macros `_macros`, `_liste`, `_fiche`, `_formulaire`, `_synthese`, `_fiche_section`, `_form_section`, `_onglets`, `_pagination`, `_list_search`, `_csv_toolbar`, `_confirm_modal`, `_documents`, `_document_edit`, `_equipment_select`, `_fragment`, `_icones`, `_inventory_nav`, `_quick_add`, `_snooze_card`, `_toast_notifications`, `_dashboard_widgets`
- [x] Scripts : `theme.js`, `onglets.js`, `edition.js` (édition en place), `formulaire.js`, `formulaire-inline.js`, `filtres-colonnes.js`, `dashboard-custom.js`, `quick-add.js`, `directory-autocomplete.js`, `lookup_fill.js`, `texte-tronque.js`
- [x] 111 gabarits (liste complète dans `app/templates/`) : un écran React par gabarit

## 10. Tests (44 fichiers pytest, 497 tests → Vitest)

- [x] test_statuts, test_alertes, test_alertes_logiciels, test_libelles, test_theming, test_pagination, test_voisins (logique pure)
- [x] test_routes, test_securite, test_fiches, test_formulaires, test_recherche (intégration HTTP) ; test_templates sans objet (compilation Jinja)
- [x] test_api_chatia, test_api_sesame, test_connectors, test_directory, test_notify
- [x] test_certificats_domaine, test_certificats_electroniques, test_comptes_liens, test_conformite_logiciels, test_contracts_suppliers, test_corbeille, test_corrections, test_csv, test_ct, test_dashboard_layout, test_documents, test_domaines_frise, test_domaines_registrar, test_droits_logiciels_fournisseurs, test_export_complet, test_fournisseurs_formulaire, test_inventaire_familles, test_liaisons, test_logiciels_tableau_de_bord, test_maj_cible, test_marches, test_modules, test_revues_logiciel, test_software ; test_migration_certificat et test_migration_pieces (reconstruction d'une base SQLite ancienne) sans objet : la reprise est faite une fois par `scripts/reprise-sqlite.ts`

## Reste à faire

Chantier terminé le 20/10/2026 : tout l'inventaire ci-dessus est porté et vérifié. Ce qui n'est
pas à l'identique est volontaire et listé ici.

### Vérification côte à côte

Les deux applications ont été comparées écran par écran, connectées avec le même compte, sur les
mêmes données (Sentinelle sur une copie de `instance/admin_dashboard.db`, sentinelle-next sur la
base PostgreSQL reprise par `scripts/reprise-sqlite.ts`) : un parcours automatique part du tableau
de bord, suit tous les liens internes (listes, filtres, tris, fiches, formulaires, pages
d'administration) et compare pour chaque adresse le statut HTTP, le titre, le texte du `<main>`,
les liens et les champs de formulaire.

- 647 écrans visités, 646 identiques.
- Le seul écart restant est `/backups/daily` : la date du jour est en français (« mardi 20 octobre
  2026 ») alors que Flask suit la locale du serveur (« Tuesday 20 October 2026 » sur un poste
  anglais).
- Écarts trouvés et corrigés pendant ce parcours : double `<title>` sur douze fiches, ordre des
  fiches dans les listes et sur le tableau de bord (Flask lit dans l'ordre des id), ordre des
  services et des flux d'un logiciel, voisins précédent / suivant (ordre binaire de `lower()`),
  blocs facultatifs vides (« Nature », « Outils », téléphone et courriel d'un fournisseur), heures
  affichées en UTC comme Sentinelle, taux de réussite des sauvegardes à une décimale.

### Écarts assumés

- `pg_dump` est requis pour la base dans l'export complet et les sauvegardes planifiées (`.dump`
  au format custom au lieu d'une copie du fichier SQLite) ; absent, l'archive part sans la base
  et la sauvegarde échoue avec un message clair.
- Les quatre secrets chiffrés par Fernet (SMTP, O365, LDAP, webhooks) sont à ressaisir dans
  Préférences après la reprise si `SENTINELLE_SECRET_KEY` n'était pas fourni au script.
- L'enrôlement 2FA en attente se voit sur le profil avec un bouton « Annuler » (Flask le
  recommençait en silence).
- Les formulaires POST passent par `/envoi/<chemin>` (réécriture du middleware) et les
  redirections avec message par `/message` : invisible pour l'utilisateur, visible dans les journaux.
- Le limiteur de requêtes global (Flask-Limiter) n'est pas porté : voir la section 4.
- Les attributs booléens s'écrivent `selected=""`, `checked=""`, `data-x="true"` (rendu React) :
  même comportement, HTML légèrement différent.

### Non porté, avec raison

- `test_templates` (compilation de tous les gabarits Jinja) : sans objet, le typage TypeScript et
  `pnpm build` jouent ce rôle.
- `test_migration_certificat`, `test_migration_pieces` et les parties « base ancienne » de
  `test_contracts_suppliers`, `test_software`, `test_marches` : elles reconstruisaient une base
  SQLite d'une version antérieure ; la reprise est faite une fois par `scripts/reprise-sqlite.ts`.
- Les tests LDAP réels se jouent contre un annuaire simulé (`SENTINELLE_TEST_LDAP_ACCEPT`).

### Vérifications finales

- `pnpm lint`, `pnpm typecheck` : propres.
- `pnpm test` : 110 tests unitaires (14 fichiers).
- `pnpm test:integration` : 406 tests (32 fichiers) sur une base PostgreSQL de test, serveur Next
  sur :3100.
- `pnpm build` : passe (voir le journal de la session du 20/10/2026).
