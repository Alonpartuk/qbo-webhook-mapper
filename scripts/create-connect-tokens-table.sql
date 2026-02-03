-- Connect Tokens Table
-- Stores secure, masked URLs for external QBO connection
-- Note: BigQuery doesn't support DEFAULT values - defaults are handled in application code

CREATE TABLE IF NOT EXISTS `qbo_webhook_mapper.connect_tokens` (
  token_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  token_hash STRING NOT NULL,           -- Unique hash for URL (e.g., "abc123xyz456")
  name STRING,                          -- Optional description (e.g., "Email to John")
  expires_at TIMESTAMP,                 -- Optional expiration
  max_uses INT64,                       -- Optional max usage count
  use_count INT64 NOT NULL,             -- Times used (default 0 set in code)
  is_active BOOL NOT NULL,              -- Active flag (default true set in code)
  created_at TIMESTAMP NOT NULL,
  created_by STRING,                    -- Admin user who created it
  last_used_at TIMESTAMP
);
