/**
 * Config Validator - Run at the VERY FIRST line of index.ts
 *
 * Validates critical environment variables and logs clear errors
 * instead of cryptic crashes.
 */

import fs from 'fs';
import path from 'path';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate all critical environment variables and paths
 */
export function validateConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('[ConfigValidator] Starting environment validation...');

  // ==========================================================================
  // CRITICAL: Required for production
  // ==========================================================================

  // 1. Google Cloud Project (required for BigQuery)
  if (!process.env.GOOGLE_CLOUD_PROJECT && process.env.NODE_ENV === 'production') {
    // In Cloud Run, this is usually auto-set, but verify
    warnings.push('GOOGLE_CLOUD_PROJECT not set - will use default "octup-testing"');
  }

  // 2. BigQuery Dataset
  if (!process.env.BIGQUERY_DATASET && process.env.NODE_ENV === 'production') {
    warnings.push('BIGQUERY_DATASET not set - will use default "qbo_webhook_mapper"');
  }

  // 3. JWT Secret (critical for auth - check if auth service expects it)
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    warnings.push('JWT_SECRET not set - will use default (INSECURE in production!)');
  }

  // 4. Encryption Key
  if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
    warnings.push('ENCRYPTION_KEY not set - will use default (INSECURE in production!)');
  }

  // 5. USE_MOCK_DATA should be explicitly set in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.USE_MOCK_DATA === 'true') {
      errors.push('CRITICAL_ENV_MISSING: USE_MOCK_DATA=true in production! Set to "false" for BigQuery.');
    } else if (process.env.USE_MOCK_DATA !== 'false') {
      warnings.push('USE_MOCK_DATA not explicitly set to "false" - defaulting may cause issues');
    }
  }

  // ==========================================================================
  // PATH VALIDATION (Critical for static file serving)
  // ==========================================================================

  if (process.env.NODE_ENV === 'production') {
    const frontendPath = '/app/frontend/dist';

    console.log('[ConfigValidator] Checking frontend path:', frontendPath);

    if (!fs.existsSync(frontendPath)) {
      errors.push(`CRITICAL_PATH_MISSING: Frontend dist not found at ${frontendPath}`);
    } else {
      // Check for index.html
      const indexPath = path.join(frontendPath, 'index.html');
      if (!fs.existsSync(indexPath)) {
        errors.push(`CRITICAL_PATH_MISSING: index.html not found at ${indexPath}`);
      } else {
        console.log('[ConfigValidator] ✓ index.html found');
      }

      // Check for assets folder
      const assetsPath = path.join(frontendPath, 'assets');
      if (!fs.existsSync(assetsPath)) {
        errors.push(`CRITICAL_PATH_MISSING: assets folder not found at ${assetsPath}`);
      } else {
        const assetFiles = fs.readdirSync(assetsPath);
        console.log(`[ConfigValidator] ✓ assets folder found with ${assetFiles.length} files`);

        // List first few files for debugging
        assetFiles.slice(0, 5).forEach(f => {
          console.log(`[ConfigValidator]   - ${f}`);
        });
      }
    }
  }

  // ==========================================================================
  // QBO OAuth (warn if not set, not critical for startup)
  // ==========================================================================

  if (!process.env.QBO_CLIENT_ID) {
    warnings.push('QBO_CLIENT_ID not set - OAuth will not work');
  }
  if (!process.env.QBO_CLIENT_SECRET) {
    warnings.push('QBO_CLIENT_SECRET not set - OAuth will not work');
  }

  // ==========================================================================
  // Summary
  // ==========================================================================

  const isValid = errors.length === 0;

  if (errors.length > 0) {
    console.error('[ConfigValidator] ❌ CRITICAL ERRORS FOUND:');
    errors.forEach(e => console.error(`  - ${e}`));
  }

  if (warnings.length > 0) {
    console.warn('[ConfigValidator] ⚠️  WARNINGS:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  if (isValid) {
    console.log('[ConfigValidator] ✓ All critical checks passed');
  }

  return { isValid, errors, warnings };
}

/**
 * Validate and exit if critical errors found
 */
export function validateOrExit(): void {
  const result = validateConfig();

  if (!result.isValid) {
    console.error('[ConfigValidator] FATAL: Cannot start due to critical configuration errors');
    // In production, we might want to continue anyway to at least serve health checks
    // But log very clearly that things are broken
    if (process.env.NODE_ENV === 'production') {
      console.error('[ConfigValidator] Continuing startup despite errors (Cloud Run health checks need to work)');
    } else {
      process.exit(1);
    }
  }
}
