# Portage Sentinelle (Flask / SQLite) → sentinelle-next (Next.js / PostgreSQL)

Inventaire exhaustif de l'application d'origine (`sentinelle`, commit `7db9d6a`) et liste de
contrôle du clone. Chaque ligne est cochée quand l'élément est porté **à l'identique** (même
écran, mêmes options, mêmes règles) et vérifié côte à côte. Les lignes restantes en fin de
chantier sont listées dans la section « Reste à faire » avec leur raison.

Légende : `[x]` porté et vérifié · `[~]` porté, à vérifier côte à côte · `[ ]` à faire.

## 1. Socle technique (identique à culturesa-next)

- [x] Next.js 16 App Router, `output: "standalone"`, en-têtes de sécurité statiques, CSP par nonce (`src/proxy.ts`, `src/lib/csp.ts`)
- [x] Prisma 7 + `@prisma/adapter-pg`, client généré dans `src/generated/prisma`, `prisma.config.ts`
- [ ] Better Auth 1.7 (emailAndPassword + plugin `username`, twoFactor, nextCookies, rateLimit en base)
- [x] Tailwind v4 (`@tailwindcss/postcss`) + feuille héritée `src/app/sentinelle.css` (= `static/css/style.css`)
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

- [ ] `DEFAULT_THRESHOLDS` et `_status_from_days` (EXPIRY 7/15/30, DOMAIN 30/60/90, TASK 7/15/30, CONTRACT 60/90/180, WARRANTY 30/60/90)
- [ ] `PERMISSION_CATEGORIES`, `CATEGORY_LABELS`, `PERMISSION_INHERITANCE`, `PERMISSION_LEVELS`, `CONFORMITY_CATEGORIES`
- [ ] `User.perm_level` / `can_view` / `can_edit` / `can_delete` / `is_admin`
- [ ] `Account.status()` (prochain changement de mot de passe)
- [ ] `Certificate.label()`, `monitored()`, `status()` (sans date → warning, révoqué → success), `kind`, `validity`
- [ ] `Backup` : périodes (daily 1 / weekly 7 / monthly 31, tolérance 1/2/5), `today_check`, `last_ok_check`, `computed_status`, `success_rate(first_status)`, `streak`
- [ ] `TestTask.computed_status`, `AccessReview.computed_status`, `SystemUpdate.status_color`
- [ ] `Domain.status()`, `for_host()`, `rattacher_certificats()`
- [ ] `Equipment` : `warranty_status`, `os_update_stale` (365 j), `missing_backup`, `linked_items`, `eol_info`, `computed_status`, `status_reasons`, constantes KINDS / FAMILIES / KIND_GROUPS / ENVIRONMENT / CRITICALITY
- [ ] `Contract` : `action_deadline`, `days_left`, `status`, `en_cours`, `renewal_label`, `period_label`, CONTRACT_KIND_LABELS, CONTRACT_NATURE_LABELS
- [ ] `Software.computed_status` (mises à jour + fin de vie), HOSTING / LIFECYCLE / SOURCE_TYPE / AUTH_MODE / DATA_LOCATION labels
- [ ] `Supplier.has_contacts`, SUPPLIER_KIND_LABELS
- [ ] `Referential` : REFERENTIAL_KINDS, REFERENTIAL_SCOPES, SEEDS ; `Document.has_file()`, DOCUMENT_PARENTS

## 3. Démarrage et migrations (`create_app`)

- [ ] `_seed_roles` (admin / editor niveau 3 sauf alerts=1 / viewer niveau 1), `_migrate_roles` (PERMISSION_INHERITANCE)
- [ ] `_seed_referentials` (SEEDS), `_migrate_contract_kinds`, `_migrate_certificate_lists`, `_migrate_referential_scopes`
- [ ] `_seed_default_user` : admin avec mot de passe aléatoire affiché en console (ou `ADMIN_INITIAL_PASSWORD`), réinitialisation d'un admin encore en `admin`
- [ ] `config_store.seed_from_env` / `load` (clés MANAGED, secrets chiffrés)
- [ ] `_migrate_data` (rapprochements par nom → `*_id`, sans toucher un lien posé)
- [ ] Journalisation JSON (fichier tournant) → `src/server/log.ts`
- [ ] Script de reprise `scripts/reprise-sqlite.ts` : SQLite `instance/admin_dashboard.db` → PostgreSQL, documents inclus, mots de passe Werkzeug conservés, secrets Fernet déchiffrés avec `SENTINELLE_SECRET_KEY`, secrets TOTP repris

## 4. Transversal

- [ ] Décorateurs : `login_required`, `require_edit`, `require_delete`, `require_admin`, `view_guard` (`_BP_CATEGORY`) → `src/server/guards.ts`
- [ ] `features.py` : quotes / gdpr / links / certificates, `MODULE_CATEGORIES`, `enabled`, `category_enabled`, `require`
- [ ] `config_store` : MANAGED, `_BOOL`, `_INT`, `_TRIPLET`, `_CSV`, ALERT_CATEGORIES / LABELS, chiffrement des secrets
- [ ] `app_settings.conformity_categories`
- [ ] `audit.py` (ActionLog), `snooze.py` (VALID_TYPES, `permission_category`, `get_active_snooze`)
- [ ] `paging.py` (PER_PAGE 10, choix 10/25/50/100/200/all, mémoire par utilisateur `list_prefs`)
- [ ] `forms_util.py` (`parse_date`, `parse_int`, `parse_float`, STATUS_RANK)
- [ ] `voisins.py` (précédent / suivant), `theming.py` (UI_PRIMARY_COLOR, logo teinté), `libelles.py` (STATUS_LABELS, `delai`, `montant`, `date_longue`)
- [ ] `navigation.py` : DOMAINES (aujourdhui / echeances / exploitation / parc), ADMINISTRATION, `_ORPHELINS`, RUBRIQUES, GENERIQUES, `lucide_de`, `couleur_icone`, `fil_ariane`
- [ ] Processeurs de contexte : `features`, `active_snooze`, `alert_permission`, `role_label`, `ui_primary_css`, `inject_nav_counts` (compteurs danger par catégorie hors reports, cache 60 s, compteurs corbeille), `inject_navigation`
- [ ] Filtres Jinja `delai`, `date_longue`, `montant`, `manques` ; globaux `status_label`, `compte`, `jours`, `STATUS_LABELS`, `EQUIPMENT_KIND_ICONS`, `equipment_kinds`, `static_v`
- [ ] Messages flash (catégories success / danger / warning / info) → cookie + alertes Bootstrap
- [ ] CSRF global (Server Actions + jeton sur les routes POST classiques), limiteur de requêtes (Flask-Limiter → `rate-limit.ts`)
- [ ] `_enforce_admin_2fa` (REQUIRE_2FA_ADMIN)
- [ ] `health.py` (`/health`, `/healthz`)

## 5. Authentification (`auth.py`)

- [ ] `GET/POST /login` : identifiant + mot de passe, local puis LDAP, LoginThrottle par (identifiant, IP) avec LOGIN_MAX_ATTEMPTS / LOGIN_LOCKOUT_MINUTES, `next` sûr
- [ ] `GET/POST /2fa` (code TOTP, compteur d'échecs en base, verrouillage)
- [ ] `/logout`
- [ ] `GET/POST /profile` : `change_password`, `init_2fa` (QR code), `confirm_2fa`, `disable_2fa`
- [ ] `/logo.svg` (logo teinté UI_PRIMARY_COLOR)
- [ ] `/auth/o365/connect`, `/auth/o365/callback` (MSAL, jeton chiffré)
- [ ] `ldap_auth.py` : bind UPN / DN template, groupe requis, LDAPS + CA, provisionnement `LDAP_DEFAULT_ROLE`, `sync_ad_passwords`

### Préférences (`GET/POST /preferences`, 935 lignes de gabarit)

- [ ] Messagerie : `save_mail_enabled`, `set_mail_method` (smtp / o365), `save_smtp`, `save_o365`, `disconnect_o365`, `test_email`
- [ ] Destinataires : `save_recipients` (globale + une liste par catégorie ALERT_CATEGORIES)
- [ ] Bilan PDF : `save_report` (off / weekly / monthly + destinataires), `send_report_now`
- [ ] Bilan quotidien : `send_digest`
- [ ] Certificate Transparency : `save_ct`
- [ ] Modules : `save_modules` (devis, RGPD, flux, certificats)
- [ ] Alertes logiciels : `save_software_alerts`
- [ ] Pièces jointes : `save_documents` (activées, taille max Mo, aperçu dans la page)
- [ ] Tableau de bord personnalisable : `save_dashboard_custom`
- [ ] Mémoire de pagination : `save_pagination_memory`
- [ ] Navigation entre fiches : `save_fiche_navigation`
- [ ] Formulaires : `save_forms` (anciens formulaires logiciels / contrats / fournisseurs)
- [ ] Apparence : `save_ui_color`
- [ ] Sauvegarde de la base : `save_backup_keep`, `backup_db`, `delete_db_backup`, liste des copies
- [ ] LDAP / AD : `save_ldap`, `test_ldap`
- [ ] Seuils : `save_thresholds` (4 triplets)
- [ ] Conformité : `save_conformity` (catégories)

## 6. Tableau de bord, agenda, tendances, corbeille (`dashboard.py`)

- [ ] `/` : cartes de statistiques (STAT_CARDS), blocs DASHBOARD_WIDGETS, `urgent_items`, `horizons`, `upcoming`, conformité, actions rapides (`quick-check`)
- [ ] `/dashboard/layout` (JSON : ordre, masqués, largeurs, cartes) + `dashboard-custom.js`
- [ ] `/quick-check` (check de sauvegarde / action rapide depuis le tableau de bord)
- [ ] `/etat/<status>` (by_status.html)
- [ ] `/tendances` (trends.html : doughnut, courbe, barres Chart.js)
- [ ] `/agenda`, `/agenda.ics` (jeton), `/agenda/ics-token`
- [ ] `/trash`, `/trash/restore`, `/trash/purge-one`, `/trash/purge` (`trash.py` SPECS)
- [ ] `/rapport.pdf` (`pdf_report.py`)
- [ ] `/healthz`

## 7. Modules (liste, fiche, formulaire, synthèse, historique, actions)

### Comptes (`/accounts`)
- [ ] liste (filtres statut, recherche, pagination, tri), `/sync-ad`
- [ ] création / édition (`_form_corps`), fiche (`_synthese`, historique, documents, voisins), `/password-changed`, `/delete`, PDF

### Certificats (`/certificates`, module débrayable)
- [ ] liste (TLS / électroniques, filtres), `/check-domain` (vérif TLS à la volée)
- [ ] création / édition (deux natures, usage/support référentiels, titulaire, montant), fiche, `/renew`, `/check-tls`, `/delete`, PDF, documents

### Domaines (`/domains`)
- [ ] liste, `/check-rdap-domain`, création / édition (registrar lié), fiche (frise, certificats rattachés, journal CT), `/scan-ct`, `/ct-ack`, `/check-rdap`, `/delete`, PDF

### Sauvegardes (`/backups`)
- [ ] liste, `/daily` (pointage quotidien), `/stats`, fiche (checks, taux de réussite, série), création / édition, `/check`, `/delete`
- [ ] `/ingest` (jeton BACKUP_INGEST_TOKEN), `/scan-inbox`, `backup_ingest.py` (analyse de mails .eml/.txt/.html)

### Tests récurrents (`/tests`)
- [ ] liste, `/kanban`, `/set-status`, création / édition (TEST_TYPES), fiche, `/complete`, `/delete`, PDF

### Revues de droits (`/reviews`)
- [ ] liste, création / édition (logiciel lié), fiche, `/complete`, `/delete`

### Mises à jour (`/updates`)
- [ ] liste, création / édition (équipement / logiciel cible), fiche, `/mark-updated`, `/delete`

### Inventaire matériel (`/inventory`)
- [ ] liste (filtres par famille / type / environnement / criticité, colonnes, tri, `filtres-colonnes.js`, `_inventory_nav`), `/quick-create`
- [ ] création / édition (toutes les rubriques), fiche (synthèse, éléments liés, EOL, raisons de statut), `/delete`
- [ ] `/import` (xlsx, `inventory_import.py`)

### Logiciels (`/inventory/logiciels`)
- [ ] liste (filtres, tri), `/quick-create`, création / édition (nouveau formulaire et ancien `_form_corps_ancien`), fiche à onglets (synthèse, contacts, flux, contrats, consultations/devis, partages, documents, suivi)
- [ ] `/services`, `/servers`, `/servers/<id>/detach`, `/links/add|edit|delete`, `/shares/add|delete`, `/delete`

### Contrats et marchés (`/contracts`)
- [ ] liste (`_tableau`), `/quick-create`, création / édition (nouveau et ancien), fiche, `/renew`, `/delete`
- [ ] `/software/<id>/attach`, `/<id>/software/<id>/detach`
- [ ] consultations `/consultations/<software>/add`, `/consultations/<id>/delete`, devis `/quotes/add`, `/quotes/<id>/select`, `/quotes/<id>/delete` (module devis)

### Fournisseurs (`/suppliers`)
- [ ] liste, `/quick-create`, création / édition (nouveau et ancien), fiche (synthèse, contacts, éléments liés), `/delete`

### Alertes (`/alerts`)
- [ ] liste (journal AlertLog), `/snooze`, `/unsnooze` (`_snooze_card`)

### Utilisateurs et rôles (`/users`, admin)
- [ ] liste, création / édition, `/reset-2fa`, `/delete`
- [ ] `/roles`, `/roles/create`, `/roles/<id>/save`, `/roles/<id>/delete` (grille catégories × niveaux)
- [ ] `/audit` (ActionLog, plafond 3000), `/scheduler` (SchedulerRun)

### Recherche (`/search`), Connecteurs (`/connecteurs`), Référentiels (`/referentiels`), Pièces jointes
- [ ] `/search` (toutes entités, Ctrl K)
- [ ] `/connecteurs` : cartes API (Sesame, chatIA), `/webhooks`, `/sesame`, `/chatia`
- [ ] `/referentiels` : `/add`, `/<id>/scope`, `/<id>/delete`, services `/services/add|edit|delete`
- [ ] `/documents/upload`, `/<id>/file`, `/<id>/download`, `/<id>/view` (INLINE_TYPES), `/<id>/edit`, `/<id>/delete` (ALLOWED_EXTENSIONS, DOCUMENT_MAX_MB)

### Imports / exports (`/data`), PDF, API
- [ ] `/data/export-full.zip` (`full_export.py`), `/data/<key>/export.csv`, `/template.csv`, `/import` (`csv_io.py` SPECS)
- [ ] `/accounts|certificates|domains|tests/<id>/pdf` (`pdf_entity.py`, `pdf_export.py`)
- [ ] `/api/assets` (Sesame, Bearer), `/api/chatia/echeances|alertes|synthese|recherche` (`suivi.py`), `/api/directory/search`, `/api/alert-count`

## 8. Tâches planifiées (`scheduler.py` → `/api/cron/*` + `instrumentation.ts`)

- [ ] `scan_backup_inbox` (toutes les 30 min si BACKUP_INBOX_DIR)
- [ ] `backup_database` 01:00 (`db_backup.py` → pg_dump, rétention BACKUP_DB_KEEP)
- [ ] `sync_ad_passwords` 06:00 (si LDAP)
- [ ] `check_ct_logs` 06:30 (`ct_monitor.py`, `ct_checker.py`)
- [ ] `refresh_eol_cache` 06:50 (`eol.py`)
- [ ] `refresh_certificates_tls` 07:00 (`cert_checker.py`)
- [ ] `refresh_domains_rdap` 07:10 (`domain_checker.py`)
- [ ] `send_daily_digest` 07:30 (`digest.py`)
- [ ] `send_scheduled_report` 07:40 (REPORT_SCHEDULE)
- [ ] `check_passwords` 08:00, `check_certificates` 08:15, `check_domains` 08:20, `check_backups` 08:30, `check_contracts` 08:40, `check_tests` 08:45, `check_reviews` 08:50, `check_updates` 08:55, `check_inventory` 08:58, `check_software` 09:00 (lundi)
- [ ] Journal SchedulerRun (500 lignes conservées), statut sur `/users/scheduler`
- [ ] `alerts.py` : `should_send_reminder` (cadence 7 / 2 / 1 j), `alert_recipients_for`, `send_alert` (anti-doublon du jour)
- [ ] `email_service.py` : SMTP et Graph (O365), `render_alert_email` ; `notify.py` : Teams (adaptive / legacy), Slack, Discord, `notify_all`

## 9. Interface (gabarits Jinja → composants React)

- [ ] `base.html` : barre latérale (recherche Ctrl K, domaines, administration en `<details>`, pied utilisateur), alertes flash, fil d'Ariane, thème clair / sombre, mobile
- [ ] Macros `_macros`, `_liste`, `_fiche`, `_formulaire`, `_synthese`, `_fiche_section`, `_form_section`, `_onglets`, `_pagination`, `_list_search`, `_csv_toolbar`, `_confirm_modal`, `_documents`, `_document_edit`, `_equipment_select`, `_fragment`, `_icones`, `_inventory_nav`, `_quick_add`, `_snooze_card`, `_toast_notifications`, `_dashboard_widgets`
- [ ] Scripts : `theme.js`, `onglets.js`, `edition.js` (édition en place), `formulaire.js`, `formulaire-inline.js`, `filtres-colonnes.js`, `dashboard-custom.js`, `quick-add.js`, `directory-autocomplete.js`, `lookup_fill.js`, `texte-tronque.js`
- [ ] 111 gabarits (liste complète dans `app/templates/`) : un écran React par gabarit

## 10. Tests (44 fichiers pytest, 497 tests → Vitest)

- [ ] test_statuts, test_alertes, test_alertes_logiciels, test_libelles, test_theming, test_pagination, test_voisins (logique pure)
- [ ] test_routes, test_securite, test_fiches, test_formulaires, test_templates, test_recherche (intégration HTTP)
- [ ] test_api_chatia, test_api_sesame, test_connectors, test_directory, test_notify
- [ ] test_certificats_domaine, test_certificats_electroniques, test_comptes_liens, test_conformite_logiciels, test_contracts_suppliers, test_corbeille, test_corrections, test_csv, test_ct, test_dashboard_layout, test_documents, test_domaines_frise, test_domaines_registrar, test_droits_logiciels_fournisseurs, test_export_complet, test_fournisseurs_formulaire, test_inventaire_familles, test_liaisons, test_logiciels_tableau_de_bord, test_maj_cible, test_marches, test_migration_certificat, test_migration_pieces, test_modules, test_revues_logiciel, test_software

## Reste à faire

(rempli en fin de chantier)
