-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" VARCHAR(64) NOT NULL,
    "display_username" TEXT,
    "role" VARCHAR(20) NOT NULL DEFAULT 'viewer',
    "auth_source" VARCHAR(10) NOT NULL DEFAULT 'local',
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_failed_count" INTEGER NOT NULL DEFAULT 0,
    "totp_locked_until" TIMESTAMPTZ,
    "ics_token" VARCHAR(64),
    "dashboard_prefs" TEXT,
    "list_prefs" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ,
    "refresh_token_expires_at" TIMESTAMPTZ,
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backup_codes" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "last_request" BIGINT NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting" (
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "eol_cache" (
    "product" VARCHAR(64) NOT NULL,
    "payload" TEXT,
    "fetched_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eol_cache_pkey" PRIMARY KEY ("product")
);

-- CreateTable
CREATE TABLE "app_config" (
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "webhook" (
    "id" SERIAL NOT NULL,
    "category" VARCHAR(32) NOT NULL DEFAULT 'all',
    "channel" VARCHAR(16) NOT NULL,
    "url" VARCHAR(512) NOT NULL,
    "label" VARCHAR(128),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "description" VARCHAR(200),
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" SERIAL NOT NULL,
    "service_name" VARCHAR(128) NOT NULL,
    "username" VARCHAR(128) NOT NULL,
    "url" VARCHAR(256),
    "software_id" INTEGER,
    "equipment_id" INTEGER,
    "supplier_id" INTEGER,
    "description" TEXT,
    "last_password_change" DATE,
    "next_password_change" DATE,
    "rotation_days" INTEGER DEFAULT 90,
    "priority" VARCHAR(20) DEFAULT 'medium',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_history" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "comment" TEXT,
    "performed_by" VARCHAR(64),
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate" (
    "id" SERIAL NOT NULL,
    "kind" VARCHAR(16) NOT NULL DEFAULT 'tls',
    "service_name" VARCHAR(128) NOT NULL,
    "domain" VARCHAR(256),
    "domain_id" INTEGER,
    "issuer" VARCHAR(128),
    "equipment_id" INTEGER,
    "issued_at" DATE,
    "expiry_date" DATE,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "priority" VARCHAR(20) DEFAULT 'medium',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier_id" INTEGER,
    "service_id" INTEGER,
    "civility" VARCHAR(8),
    "holder" VARCHAR(128),
    "first_name" VARCHAR(128),
    "holder_role" VARCHAR(128),
    "holder_email" VARCHAR(120),
    "cert_usage" VARCHAR(24),
    "support" VARCHAR(16),
    "usage_id" INTEGER,
    "support_id" INTEGER,
    "level" VARCHAR(64),
    "serial_number" VARCHAR(128),
    "duration_years" INTEGER,
    "amount_ttc" DOUBLE PRECISION,
    "budget_code" VARCHAR(32),
    "order_signed_on" DATE,
    "revocation_code" VARCHAR(64),
    "validity" VARCHAR(16) DEFAULT 'valide',

    CONSTRAINT "certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_history" (
    "id" SERIAL NOT NULL,
    "certificate_id" INTEGER NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "comment" TEXT,
    "performed_by" VARCHAR(64),
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup" (
    "id" SERIAL NOT NULL,
    "service_name" VARCHAR(128) NOT NULL,
    "backup_type" VARCHAR(64),
    "location" VARCHAR(256),
    "equipment_id" INTEGER,
    "frequency" VARCHAR(64),
    "expected_time" VARCHAR(5),
    "description" TEXT,
    "priority" VARCHAR(20) DEFAULT 'medium',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_check" (
    "id" SERIAL NOT NULL,
    "backup_id" INTEGER NOT NULL,
    "check_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ok',
    "first_status" VARCHAR(20),
    "comment" TEXT,
    "checked_by" VARCHAR(64),
    "checked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_history" (
    "id" SERIAL NOT NULL,
    "backup_id" INTEGER NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "status" VARCHAR(20),
    "comment" TEXT,
    "performed_by" VARCHAR(64),
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_task" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "test_type" VARCHAR(64) NOT NULL,
    "software_id" INTEGER,
    "description" TEXT,
    "last_performed" DATE,
    "next_due" DATE,
    "frequency_days" INTEGER DEFAULT 90,
    "status" VARCHAR(20) DEFAULT 'pending',
    "result" TEXT,
    "priority" VARCHAR(20) DEFAULT 'medium',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_history" (
    "id" SERIAL NOT NULL,
    "test_id" INTEGER NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "result" TEXT,
    "comment" TEXT,
    "performed_by" VARCHAR(64),
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "registrar" VARCHAR(128),
    "registrar_id" INTEGER,
    "expiry_date" DATE,
    "renewed_on" DATE,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "priority" VARCHAR(20) DEFAULT 'medium',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ct_enabled" BOOLEAN NOT NULL DEFAULT true,
    "ct_last_id" BIGINT,

    CONSTRAINT "domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_history" (
    "id" SERIAL NOT NULL,
    "domain_id" INTEGER NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "comment" TEXT,
    "performed_by" VARCHAR(64),
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ct_log_entry" (
    "id" SERIAL NOT NULL,
    "domain_id" INTEGER NOT NULL,
    "crtsh_id" BIGINT,
    "serial_number" VARCHAR(128),
    "common_name" VARCHAR(256),
    "name_value" TEXT,
    "issuer_name" VARCHAR(256),
    "not_before" DATE,
    "not_after" DATE,
    "entry_timestamp" TIMESTAMPTZ,
    "first_seen" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(16) DEFAULT 'new',
    "acknowledged_by" VARCHAR(64),
    "acknowledged_at" TIMESTAMPTZ,

    CONSTRAINT "ct_log_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_review" (
    "id" SERIAL NOT NULL,
    "application" VARCHAR(128) NOT NULL,
    "software_id" INTEGER,
    "responsible" VARCHAR(128),
    "responsible_email" VARCHAR(120),
    "scope" TEXT,
    "frequency_days" INTEGER DEFAULT 365,
    "last_review" DATE,
    "next_review" DATE,
    "status" VARCHAR(20) DEFAULT 'pending',
    "priority" VARCHAR(20) DEFAULT 'medium',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_history" (
    "id" SERIAL NOT NULL,
    "review_id" INTEGER NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "comment" TEXT,
    "performed_by" VARCHAR(64),
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_update" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "system_type" VARCHAR(32) DEFAULT 'application',
    "current_version" VARCHAR(64),
    "latest_version" VARCHAR(64),
    "status" VARCHAR(20) DEFAULT 'up_to_date',
    "equipment_id" INTEGER,
    "software_id" INTEGER,
    "last_update" DATE,
    "updater_type" VARCHAR(20) DEFAULT 'interne',
    "updated_by" VARCHAR(128),
    "description" TEXT,
    "priority" VARCHAR(20) DEFAULT 'medium',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_update_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "update_history" (
    "id" SERIAL NOT NULL,
    "update_id" INTEGER NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "comment" TEXT,
    "performed_by" VARCHAR(64),
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "update_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" SERIAL NOT NULL,
    "kind" VARCHAR(16) NOT NULL DEFAULT 'vm',
    "name" VARCHAR(128) NOT NULL,
    "environment" VARCHAR(16),
    "criticality" INTEGER,
    "os" VARCHAR(128),
    "os_version" VARCHAR(64),
    "os_last_update" DATE,
    "supervision" VARCHAR(128),
    "supervised" BOOLEAN NOT NULL DEFAULT false,
    "cyberwatch" BOOLEAN NOT NULL DEFAULT false,
    "ninja_one" BOOLEAN NOT NULL DEFAULT false,
    "ip_address" VARCHAR(64),
    "netmask" VARCHAR(64),
    "vlan" VARCHAR(32),
    "host_server" VARCHAR(128),
    "hypervisor" VARCHAR(64),
    "vcpu" INTEGER,
    "ram_go" DOUBLE PRECISION,
    "hdd1_go" DOUBLE PRECISION,
    "hdd2_go" DOUBLE PRECISION,
    "hdd3_go" DOUBLE PRECISION,
    "manufacturer_model" VARCHAR(128),
    "serial_number" VARCHAR(128),
    "service_tag" VARCHAR(64),
    "purchase_date" DATE,
    "warranty_end" DATE,
    "maintenance_contract" VARCHAR(128),
    "supplier_id" INTEGER,
    "location" VARCHAR(128),
    "management_url" VARCHAR(256),
    "ports" INTEGER,
    "protocols" VARCHAR(128),
    "access" TEXT,
    "capacity_to" DOUBLE PRECISION,
    "used_to" DOUBLE PRECISION,
    "raid" VARCHAR(64),
    "role_principal" VARCHAR(128),
    "business_software" TEXT,
    "user_services" TEXT,
    "usage" TEXT,
    "pra_pca" VARCHAR(128),
    "backup1" VARCHAR(128),
    "backup1_freq" VARCHAR(64),
    "backup2" VARCHAR(128),
    "backup2_freq" VARCHAR(64),
    "observations" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "kind" VARCHAR(32) DEFAULT 'provider',
    "contact_name" VARCHAR(128),
    "phone" VARCHAR(64),
    "support_phone" VARCHAR(64),
    "email" VARCHAR(128),
    "support_url" VARCHAR(256),
    "support_email" VARCHAR(128),
    "customer_ref" VARCHAR(128),
    "hours" VARCHAR(128),
    "hours2" VARCHAR(128),
    "address" VARCHAR(256),
    "postal_code" VARCHAR(16),
    "city" VARCHAR(128),
    "website" VARCHAR(256),
    "commercial_contact" VARCHAR(128),
    "commercial_phone" VARCHAR(64),
    "commercial_email" VARCHAR(128),
    "commercial_contact2" VARCHAR(128),
    "commercial_phone2" VARCHAR(64),
    "commercial_email2" VARCHAR(128),
    "admin_contact" VARCHAR(128),
    "admin_phone" VARCHAR(64),
    "admin_email" VARCHAR(128),
    "dpo_contact" VARCHAR(128),
    "dpo_phone" VARCHAR(64),
    "dpo_email" VARCHAR(128),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_equipment" (
    "contract_id" INTEGER NOT NULL,
    "equipment_id" INTEGER NOT NULL,

    CONSTRAINT "contract_equipment_pkey" PRIMARY KEY ("contract_id","equipment_id")
);

-- CreateTable
CREATE TABLE "contract_software" (
    "contract_id" INTEGER NOT NULL,
    "software_id" INTEGER NOT NULL,

    CONSTRAINT "contract_software_pkey" PRIMARY KEY ("contract_id","software_id")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "kind" VARCHAR(32),
    "kind_id" INTEGER,
    "supplier_id" INTEGER,
    "nature" VARCHAR(16),
    "reference" VARCHAR(128),
    "supplier_reference" VARCHAR(128),
    "cost_yearly" DOUBLE PRECISION,
    "cost_max_yearly" DOUBLE PRECISION,
    "cost_total" DOUBLE PRECISION,
    "start_date" DATE,
    "end_date" DATE,
    "firm_years" INTEGER,
    "renewals" INTEGER,
    "renewal_years" INTEGER,
    "notice_days" INTEGER DEFAULT 0,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "budget_code" VARCHAR(32),
    "order_signed_on" DATE,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_history" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "comment" TEXT,
    "performed_by" VARCHAR(64),
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation" (
    "id" SERIAL NOT NULL,
    "software_id" INTEGER NOT NULL,
    "subject" VARCHAR(256) NOT NULL,
    "date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote" (
    "id" SERIAL NOT NULL,
    "consultation_id" INTEGER NOT NULL,
    "supplier_id" INTEGER,
    "supplier_name" VARCHAR(128),
    "amount" DOUBLE PRECISION,
    "date" DATE,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referential" (
    "id" SERIAL NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "label" VARCHAR(64) NOT NULL,
    "position" INTEGER DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "scope" VARCHAR(16),

    CONSTRAINT "referential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_service" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "contact_name" VARCHAR(128),
    "contact_email" VARCHAR(120),
    "contact_phone" VARCHAR(64),
    "position" INTEGER DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "software_service" (
    "software_id" INTEGER NOT NULL,
    "user_service_id" INTEGER NOT NULL,

    CONSTRAINT "software_service_pkey" PRIMARY KEY ("software_id","user_service_id")
);

-- CreateTable
CREATE TABLE "software_equipment" (
    "software_id" INTEGER NOT NULL,
    "equipment_id" INTEGER NOT NULL,

    CONSTRAINT "software_equipment_pkey" PRIMARY KEY ("software_id","equipment_id")
);

-- CreateTable
CREATE TABLE "software_link" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER NOT NULL,
    "target_id" INTEGER NOT NULL,
    "description" VARCHAR(256),
    "bidirectional" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "software_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "software_share" (
    "id" SERIAL NOT NULL,
    "software_id" INTEGER NOT NULL,
    "label" VARCHAR(128),
    "path" VARCHAR(512) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "software_share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "software" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "supplier_id" INTEGER,
    "version" VARCHAR(64),
    "hosting" VARCHAR(16) NOT NULL DEFAULT 'on_premise',
    "is_docker" BOOLEAN NOT NULL DEFAULT false,
    "internal_dev" BOOLEAN NOT NULL DEFAULT false,
    "no_server" BOOLEAN NOT NULL DEFAULT false,
    "lifecycle" VARCHAR(16) NOT NULL DEFAULT 'production',
    "source_type" VARCHAR(16) DEFAULT 'proprietaire',
    "technology_id" INTEGER,
    "auth_mode" VARCHAR(16),
    "auth_strong" BOOLEAN NOT NULL DEFAULT false,
    "users_count" INTEGER,
    "users_max" INTEGER,
    "service_date" DATE,
    "tech_responsible" VARCHAR(128),
    "tech_responsible_email" VARCHAR(120),
    "no_contract_note" VARCHAR(256),
    "gdpr_personal_data" BOOLEAN NOT NULL DEFAULT false,
    "gdpr_categories" VARCHAR(256),
    "gdpr_registry_ref" VARCHAR(64),
    "gdpr_location" VARCHAR(16) DEFAULT 'inconnue',
    "url" VARCHAR(256),
    "criticality" INTEGER,
    "responsible" VARCHAR(128),
    "responsible_email" VARCHAR(120),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "software_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" SERIAL NOT NULL,
    "software_id" INTEGER,
    "supplier_id" INTEGER,
    "contract_id" INTEGER,
    "quote_id" INTEGER,
    "certificate_id" INTEGER,
    "equipment_id" INTEGER,
    "category_id" INTEGER,
    "filename" VARCHAR(256) NOT NULL,
    "mime" VARCHAR(128),
    "size" INTEGER,
    "doc_date" DATE,
    "uploaded_by" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_content" (
    "document_id" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "document_content_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "scheduler_run" (
    "id" SERIAL NOT NULL,
    "job_id" VARCHAR(64),
    "status" VARCHAR(20),
    "message" TEXT,
    "run_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduler_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_map" (
    "kind" VARCHAR(32) NOT NULL,
    "remote_id" INTEGER NOT NULL,
    "local_id" INTEGER NOT NULL,

    CONSTRAINT "import_map_pkey" PRIMARY KEY ("kind","remote_id")
);

-- CreateTable
CREATE TABLE "action_log" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(64),
    "action" VARCHAR(64) NOT NULL,
    "category" VARCHAR(64),
    "detail" TEXT,
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_throttle" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "ip" VARCHAR(64) NOT NULL DEFAULT '',
    "failed_count" INTEGER DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_throttle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_log" (
    "id" SERIAL NOT NULL,
    "alert_type" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(64),
    "entity_id" INTEGER,
    "entity_name" VARCHAR(128),
    "message" TEXT,
    "recipients" VARCHAR(512),
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(20) DEFAULT 'sent',

    CONSTRAINT "alert_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_snooze" (
    "id" SERIAL NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "snoozed_until" DATE NOT NULL,
    "reason" TEXT,
    "created_by" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_snooze_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_ics_token_key" ON "user"("ics_token");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "auth_account_user_id_idx" ON "auth_account"("user_id");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "two_factor_user_id_idx" ON "two_factor"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_key_key" ON "rate_limits"("key");

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- CreateIndex
CREATE INDEX "account_software_id_idx" ON "account"("software_id");

-- CreateIndex
CREATE INDEX "account_equipment_id_idx" ON "account"("equipment_id");

-- CreateIndex
CREATE INDEX "account_supplier_id_idx" ON "account"("supplier_id");

-- CreateIndex
CREATE INDEX "account_history_account_id_idx" ON "account_history"("account_id");

-- CreateIndex
CREATE INDEX "certificate_domain_id_idx" ON "certificate"("domain_id");

-- CreateIndex
CREATE INDEX "certificate_equipment_id_idx" ON "certificate"("equipment_id");

-- CreateIndex
CREATE INDEX "certificate_supplier_id_idx" ON "certificate"("supplier_id");

-- CreateIndex
CREATE INDEX "certificate_service_id_idx" ON "certificate"("service_id");

-- CreateIndex
CREATE INDEX "certificate_usage_id_idx" ON "certificate"("usage_id");

-- CreateIndex
CREATE INDEX "certificate_support_id_idx" ON "certificate"("support_id");

-- CreateIndex
CREATE INDEX "certificate_history_certificate_id_idx" ON "certificate_history"("certificate_id");

-- CreateIndex
CREATE INDEX "backup_equipment_id_idx" ON "backup"("equipment_id");

-- CreateIndex
CREATE INDEX "backup_check_backup_id_idx" ON "backup_check"("backup_id");

-- CreateIndex
CREATE INDEX "backup_check_check_date_idx" ON "backup_check"("check_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_backup_check_date" ON "backup_check"("backup_id", "check_date");

-- CreateIndex
CREATE INDEX "backup_history_backup_id_idx" ON "backup_history"("backup_id");

-- CreateIndex
CREATE INDEX "test_task_software_id_idx" ON "test_task"("software_id");

-- CreateIndex
CREATE INDEX "test_history_test_id_idx" ON "test_history"("test_id");

-- CreateIndex
CREATE INDEX "domain_registrar_id_idx" ON "domain"("registrar_id");

-- CreateIndex
CREATE INDEX "domain_history_domain_id_idx" ON "domain_history"("domain_id");

-- CreateIndex
CREATE INDEX "ct_log_entry_domain_id_idx" ON "ct_log_entry"("domain_id");

-- CreateIndex
CREATE INDEX "ct_log_entry_crtsh_id_idx" ON "ct_log_entry"("crtsh_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ctlog_domain_crtsh" ON "ct_log_entry"("domain_id", "crtsh_id");

-- CreateIndex
CREATE INDEX "access_review_software_id_idx" ON "access_review"("software_id");

-- CreateIndex
CREATE INDEX "review_history_review_id_idx" ON "review_history"("review_id");

-- CreateIndex
CREATE INDEX "system_update_equipment_id_idx" ON "system_update"("equipment_id");

-- CreateIndex
CREATE INDEX "system_update_software_id_idx" ON "system_update"("software_id");

-- CreateIndex
CREATE INDEX "update_history_update_id_idx" ON "update_history"("update_id");

-- CreateIndex
CREATE INDEX "equipment_supplier_id_idx" ON "equipment"("supplier_id");

-- CreateIndex
CREATE INDEX "contract_kind_id_idx" ON "contract"("kind_id");

-- CreateIndex
CREATE INDEX "contract_supplier_id_idx" ON "contract"("supplier_id");

-- CreateIndex
CREATE INDEX "contract_history_contract_id_idx" ON "contract_history"("contract_id");

-- CreateIndex
CREATE INDEX "consultation_software_id_idx" ON "consultation"("software_id");

-- CreateIndex
CREATE INDEX "quote_consultation_id_idx" ON "quote"("consultation_id");

-- CreateIndex
CREATE INDEX "quote_supplier_id_idx" ON "quote"("supplier_id");

-- CreateIndex
CREATE INDEX "referential_kind_idx" ON "referential"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "uq_referential_kind_label" ON "referential"("kind", "label");

-- CreateIndex
CREATE UNIQUE INDEX "user_service_name_key" ON "user_service"("name");

-- CreateIndex
CREATE INDEX "software_link_source_id_idx" ON "software_link"("source_id");

-- CreateIndex
CREATE INDEX "software_link_target_id_idx" ON "software_link"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_link_source_target" ON "software_link"("source_id", "target_id");

-- CreateIndex
CREATE INDEX "software_share_software_id_idx" ON "software_share"("software_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_share_software_path" ON "software_share"("software_id", "path");

-- CreateIndex
CREATE INDEX "software_supplier_id_idx" ON "software"("supplier_id");

-- CreateIndex
CREATE INDEX "software_technology_id_idx" ON "software"("technology_id");

-- CreateIndex
CREATE INDEX "document_software_id_idx" ON "document"("software_id");

-- CreateIndex
CREATE INDEX "document_supplier_id_idx" ON "document"("supplier_id");

-- CreateIndex
CREATE INDEX "document_contract_id_idx" ON "document"("contract_id");

-- CreateIndex
CREATE INDEX "document_quote_id_idx" ON "document"("quote_id");

-- CreateIndex
CREATE INDEX "document_certificate_id_idx" ON "document"("certificate_id");

-- CreateIndex
CREATE INDEX "document_equipment_id_idx" ON "document"("equipment_id");

-- CreateIndex
CREATE INDEX "document_category_id_idx" ON "document"("category_id");

-- CreateIndex
CREATE INDEX "document_doc_date_idx" ON "document"("doc_date");

-- CreateIndex
CREATE INDEX "action_log_performed_at_idx" ON "action_log"("performed_at");

-- CreateIndex
CREATE INDEX "login_throttle_username_idx" ON "login_throttle"("username");

-- CreateIndex
CREATE INDEX "login_throttle_ip_idx" ON "login_throttle"("ip");

-- CreateIndex
CREATE UNIQUE INDEX "uq_throttle_user_ip" ON "login_throttle"("username", "ip");

-- CreateIndex
CREATE INDEX "alert_log_sent_at_idx" ON "alert_log"("sent_at");

-- CreateIndex
CREATE INDEX "ix_alert_log_entity_sent" ON "alert_log"("entity_type", "entity_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_snooze_entity" ON "alert_snooze"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_history" ADD CONSTRAINT "account_history_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "user_service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_usage_id_fkey" FOREIGN KEY ("usage_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_support_id_fkey" FOREIGN KEY ("support_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_history" ADD CONSTRAINT "certificate_history_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup" ADD CONSTRAINT "backup_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_check" ADD CONSTRAINT "backup_check_backup_id_fkey" FOREIGN KEY ("backup_id") REFERENCES "backup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_history" ADD CONSTRAINT "backup_history_backup_id_fkey" FOREIGN KEY ("backup_id") REFERENCES "backup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_task" ADD CONSTRAINT "test_task_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_history" ADD CONSTRAINT "test_history_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "test_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain" ADD CONSTRAINT "domain_registrar_id_fkey" FOREIGN KEY ("registrar_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_history" ADD CONSTRAINT "domain_history_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ct_log_entry" ADD CONSTRAINT "ct_log_entry_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_review" ADD CONSTRAINT "access_review_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_history" ADD CONSTRAINT "review_history_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "access_review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_update" ADD CONSTRAINT "system_update_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_update" ADD CONSTRAINT "system_update_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "update_history" ADD CONSTRAINT "update_history_update_id_fkey" FOREIGN KEY ("update_id") REFERENCES "system_update"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_equipment" ADD CONSTRAINT "contract_equipment_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_equipment" ADD CONSTRAINT "contract_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_software" ADD CONSTRAINT "contract_software_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_software" ADD CONSTRAINT "contract_software_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_kind_id_fkey" FOREIGN KEY ("kind_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_history" ADD CONSTRAINT "contract_history_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_service" ADD CONSTRAINT "software_service_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_service" ADD CONSTRAINT "software_service_user_service_id_fkey" FOREIGN KEY ("user_service_id") REFERENCES "user_service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_equipment" ADD CONSTRAINT "software_equipment_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_equipment" ADD CONSTRAINT "software_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_link" ADD CONSTRAINT "software_link_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_link" ADD CONSTRAINT "software_link_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_share" ADD CONSTRAINT "software_share_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software" ADD CONSTRAINT "software_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software" ADD CONSTRAINT "software_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_content" ADD CONSTRAINT "document_content_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

