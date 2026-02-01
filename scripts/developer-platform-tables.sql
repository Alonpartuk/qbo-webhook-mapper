-- ============================================================
-- Developer Platform Tables for QBO Webhook Mapper
-- Target: Google BigQuery
-- Project: octup-testing
-- Dataset: qbo_webhook_mapper
-- ============================================================

-- ============================================================
-- TABLE 1: api_keys
-- Stores API keys with SHA256 hashes for secure authentication
-- ============================================================
CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.api_keys` (
  key_id STRING NOT NULL,
  organization_id STRING,              -- NULL for global admin keys
  key_hash STRING NOT NULL,            -- SHA256 hash of full key
  key_prefix STRING NOT NULL,          -- Last 4 chars for display ("...1234")
  name STRING NOT NULL,
  key_type STRING NOT NULL,            -- 'tenant' | 'global_admin'
  permissions STRING,                  -- JSON: endpoints, rate_limit_tier
  is_active BOOL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL,
  created_by STRING,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by STRING,
  grace_period_ends_at TIMESTAMP       -- For key rotation (old key still valid until this time)
)
OPTIONS(
  description = "API keys for Developer Platform authentication with SHA256 hashed storage"
);

-- ============================================================
-- TABLE 2: api_usage_logs
-- Stores API request logs for analytics and monitoring
-- Partitioned by timestamp for efficient querying
-- ============================================================
CREATE TABLE IF NOT EXISTS `octup-testing.qbo_webhook_mapper.api_usage_logs` (
  log_id STRING NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  organization_id STRING,
  api_key_id STRING,
  endpoint STRING NOT NULL,
  method STRING NOT NULL,
  query_params STRING,                 -- JSON
  status_code INT64 NOT NULL,
  response_time_ms INT64 NOT NULL,
  request_size_bytes INT64,
  response_size_bytes INT64,
  error_code STRING,
  user_agent STRING,
  ip_address STRING
)
PARTITION BY DATE(timestamp)
CLUSTER BY organization_id, api_key_id
OPTIONS(
  description = "API usage logs for monitoring and analytics - partitioned daily"
);

-- ============================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================

-- Insert a sample global admin key (hash of 'qbo_live_test_global_admin_key_12345678')
-- In production, generate proper keys through the API
-- INSERT INTO `octup-testing.qbo_webhook_mapper.api_keys`
-- (key_id, organization_id, key_hash, key_prefix, name, key_type, permissions, is_active, created_at)
-- VALUES (
--   'key-global-001',
--   NULL,
--   'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
--   '5678',
--   'Global Admin Key',
--   'global_admin',
--   '{"endpoints":["*"],"rate_limit_tier":"unlimited"}',
--   TRUE,
--   CURRENT_TIMESTAMP()
-- );

-- ============================================================
-- USEFUL QUERIES
-- ============================================================

-- Get all active API keys for an organization
-- SELECT key_id, name, key_prefix, key_type, created_at, last_used_at
-- FROM `octup-testing.qbo_webhook_mapper.api_keys`
-- WHERE organization_id = 'your-org-id' AND is_active = TRUE;

-- Get API usage statistics by endpoint
-- SELECT
--   endpoint,
--   COUNT(*) as request_count,
--   AVG(response_time_ms) as avg_response_time,
--   COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
-- FROM `octup-testing.qbo_webhook_mapper.api_usage_logs`
-- WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
-- GROUP BY endpoint
-- ORDER BY request_count DESC;

-- Get rate limiting data (requests per key in last minute)
-- SELECT
--   api_key_id,
--   COUNT(*) as requests_last_minute
-- FROM `octup-testing.qbo_webhook_mapper.api_usage_logs`
-- WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 MINUTE)
-- GROUP BY api_key_id;
