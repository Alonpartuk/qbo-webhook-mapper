-- ============================================================
-- Production Setup Script for QBO Webhook Mapper
-- Target: Google BigQuery
-- Project: octup-testing
-- Dataset: qbo_webhook_mapper
--
-- IMPORTANT: BigQuery does NOT support DEFAULT values!
-- All defaults must be handled in application code.
-- ============================================================

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Organizations Table
CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.organizations` (
  organization_id STRING NOT NULL,
  name STRING NOT NULL,
  slug STRING NOT NULL,
  plan_tier STRING,                        -- Default 'free' in app code
  is_active BOOL NOT NULL,                 -- Default TRUE in app code
  connection_link_enabled BOOL NOT NULL,   -- Default TRUE in app code
  settings STRING,                         -- JSON
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP,
  created_by STRING
);

-- Admin Users Table
CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.admin_users` (
  user_id STRING NOT NULL,
  email STRING NOT NULL,
  name STRING,
  password_hash STRING NOT NULL,
  must_change_password BOOL NOT NULL,      -- Default TRUE in app code
  role STRING NOT NULL,                    -- Default 'admin' in app code
  is_active BOOL NOT NULL,                 -- Default TRUE in app code
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL
);

-- Global Mapping Templates Table
CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.global_mapping_templates` (
  template_id STRING NOT NULL,
  name STRING NOT NULL,
  source_type STRING NOT NULL,
  description STRING,
  version INT64 NOT NULL,                  -- Default 1 in app code
  is_active BOOL NOT NULL,                 -- Default TRUE in app code
  field_mappings STRING NOT NULL,          -- JSON
  static_values STRING,                    -- JSON
  priority INT64 NOT NULL,                 -- Default 100 in app code
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP,
  created_by STRING
);

-- Client Mapping Overrides Table
CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.client_mapping_overrides` (
  override_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  source_id STRING,
  template_id STRING,
  name STRING NOT NULL,
  description STRING,
  field_mappings STRING NOT NULL,          -- JSON
  static_values STRING,                    -- JSON
  priority INT64 NOT NULL,                 -- Default 50 in app code
  is_active BOOL NOT NULL,                 -- Default TRUE in app code
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP
);

-- ============================================================
-- MULTI-TENANT DATA TABLES (V2)
-- ============================================================

-- Webhook Sources (Multi-tenant)
CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.webhook_sources_v2` (
  source_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  name STRING NOT NULL,
  description STRING,
  source_type STRING NOT NULL,             -- Default 'custom' in app code
  api_key STRING NOT NULL,
  webhook_url STRING,
  is_active BOOL NOT NULL,                 -- Default TRUE in app code
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP,
  created_by STRING
);

-- Webhook Payloads (Partitioned)
CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.webhook_payloads_v2` (
  payload_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  source_id STRING NOT NULL,
  raw_payload STRING NOT NULL,
  payload_hash STRING,
  headers STRING,
  received_at TIMESTAMP NOT NULL,
  processed BOOL NOT NULL,                 -- Default FALSE in app code
  processed_at TIMESTAMP,
  invoice_id STRING
)
PARTITION BY DATE(received_at)
CLUSTER BY organization_id, source_id;

-- Mapping Configurations (Multi-tenant)
CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.mapping_configurations_v2` (
  mapping_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  source_id STRING NOT NULL,
  inherits_from_template_id STRING,
  name STRING NOT NULL,
  description STRING,
  version INT64 NOT NULL,                  -- Default 1 in app code
  is_active BOOL NOT NULL,                 -- Default TRUE in app code
  field_mappings STRING NOT NULL,          -- JSON
  static_values STRING,                    -- JSON
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP
)
PARTITION BY DATE(created_at)
CLUSTER BY organization_id, source_id;

-- OAuth Tokens (Multi-tenant)
CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.oauth_tokens_v2` (
  token_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  realm_id STRING NOT NULL,
  access_token STRING NOT NULL,
  refresh_token STRING NOT NULL,
  access_token_expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  token_type STRING,                       -- Default 'Bearer' in app code
  scope STRING,
  qbo_company_name STRING,
  connection_name STRING,
  last_sync_at TIMESTAMP,
  sync_status STRING,                      -- Default 'active' in app code
  is_active BOOL NOT NULL,                 -- Default TRUE in app code
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP
);

-- Sync Logs (Partitioned)
CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.sync_logs_v2` (
  log_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  payload_id STRING NOT NULL,
  source_id STRING NOT NULL,
  mapping_id STRING,
  status STRING NOT NULL,
  qbo_invoice_id STRING,
  qbo_doc_number STRING,
  request_payload STRING,
  response_payload STRING,
  error_message STRING,
  error_code STRING,
  retry_count INT64 NOT NULL,              -- Default 0 in app code
  created_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP
)
PARTITION BY DATE(created_at)
CLUSTER BY organization_id, source_id, status;

-- ============================================================
-- API KEYS TABLE (Developer Platform)
-- ============================================================

CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.api_keys` (
  key_id STRING NOT NULL,
  organization_id STRING,                  -- NULL for global admin keys
  key_hash STRING NOT NULL,                -- SHA256 hash of full key
  key_prefix STRING NOT NULL,              -- Last 4 chars for display
  name STRING NOT NULL,
  key_type STRING NOT NULL,                -- 'tenant' | 'global_admin'
  permissions STRING,                      -- JSON
  is_active BOOL NOT NULL,                 -- Default TRUE in app code
  created_at TIMESTAMP NOT NULL,
  created_by STRING,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by STRING,
  grace_period_ends_at TIMESTAMP
);

-- ============================================================
-- API USAGE LOGS TABLE (Partitioned)
-- ============================================================

CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.api_usage_logs` (
  log_id STRING NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  organization_id STRING,
  api_key_id STRING,
  endpoint STRING NOT NULL,
  method STRING NOT NULL,
  query_params STRING,                     -- JSON
  status_code INT64 NOT NULL,
  response_time_ms INT64 NOT NULL,
  request_size_bytes INT64,
  response_size_bytes INT64,
  error_code STRING,
  user_agent STRING,
  ip_address STRING
)
PARTITION BY DATE(timestamp)
CLUSTER BY organization_id, api_key_id;

-- ============================================================
-- AUDIT LOGS TABLE (Partitioned)
-- ============================================================

CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.audit_logs` (
  log_id STRING NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  category STRING NOT NULL,
  action STRING NOT NULL,
  result STRING NOT NULL,
  actor_type STRING,
  actor_id STRING,
  actor_email STRING,
  actor_ip STRING,
  target_type STRING,
  target_id STRING,
  organization_id STRING,
  details STRING,                          -- JSON
  error_message STRING,
  user_agent STRING,
  request_path STRING,
  request_method STRING
)
PARTITION BY DATE(timestamp)
CLUSTER BY organization_id, category, action;

-- ============================================================
-- CONNECT TOKENS TABLE (Masked URLs)
-- ============================================================

CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.connect_tokens` (
  token_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  token_hash STRING NOT NULL,              -- Unique hash for URL (e.g., "abc123xyz456")
  name STRING,                             -- Optional description
  expires_at TIMESTAMP,                    -- Optional expiration
  max_uses INT64,                          -- Optional max usage count
  use_count INT64 NOT NULL,                -- Default 0 in app code
  is_active BOOL NOT NULL,                 -- Default TRUE in app code
  created_at TIMESTAMP NOT NULL,
  created_by STRING,
  last_used_at TIMESTAMP
);

-- ============================================================
-- SEED DEFAULT ORGANIZATION (Required for migration)
-- ============================================================

-- Use MERGE to insert default org only if it doesn't exist
MERGE `octup-testing.qbo_webhook_mapper.organizations` AS target
USING (
  SELECT
    'default-org-001' AS organization_id,
    'Default Organization' AS name,
    'default' AS slug,
    'enterprise' AS plan_tier,
    TRUE AS is_active,
    TRUE AS connection_link_enabled,
    CURRENT_TIMESTAMP() AS created_at
) AS source
ON target.organization_id = source.organization_id
WHEN NOT MATCHED THEN
  INSERT (organization_id, name, slug, plan_tier, is_active, connection_link_enabled, created_at)
  VALUES (source.organization_id, source.name, source.slug, source.plan_tier, source.is_active, source.connection_link_enabled, source.created_at);

-- ============================================================
-- USEFUL VERIFICATION QUERIES
-- ============================================================

-- Verify all tables exist
-- SELECT table_name
-- FROM `octup-testing.qbo_webhook_mapper.INFORMATION_SCHEMA.TABLES`
-- ORDER BY table_name;

-- Check organizations count
-- SELECT COUNT(*) as org_count FROM `octup-testing.qbo_webhook_mapper.organizations`;

-- Check connect tokens count
-- SELECT COUNT(*) as token_count FROM `octup-testing.qbo_webhook_mapper.connect_tokens`;
