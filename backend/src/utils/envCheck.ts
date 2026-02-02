/**
 * Production Environment Check Utility
 *
 * Logs warnings (does not crash) if critical environment variables
 * are using default/insecure values in production mode.
 */

interface EnvCheckResult {
  variable: string;
  status: 'ok' | 'warning' | 'critical';
  message: string;
}

/**
 * Check if a value looks like a placeholder/default
 */
function isPlaceholderValue(value: string | undefined, placeholders: string[]): boolean {
  if (!value) return true;
  const lowerValue = value.toLowerCase();
  return placeholders.some(p => lowerValue.includes(p.toLowerCase()));
}

/**
 * Run all production environment checks
 * Returns array of check results and logs warnings
 */
export function checkProductionEnv(): EnvCheckResult[] {
  const results: EnvCheckResult[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Check JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  const jwtPlaceholders = ['dev-only', 'secret', 'changeme', 'your-secret', 'placeholder'];

  if (!jwtSecret) {
    results.push({
      variable: 'JWT_SECRET',
      status: isProduction ? 'critical' : 'warning',
      message: 'JWT_SECRET is not set. Using insecure default.',
    });
  } else if (isPlaceholderValue(jwtSecret, jwtPlaceholders)) {
    results.push({
      variable: 'JWT_SECRET',
      status: isProduction ? 'critical' : 'warning',
      message: 'JWT_SECRET appears to be a placeholder/default value.',
    });
  } else if (jwtSecret.length < 32) {
    results.push({
      variable: 'JWT_SECRET',
      status: 'warning',
      message: 'JWT_SECRET is shorter than recommended (32+ characters).',
    });
  } else {
    results.push({
      variable: 'JWT_SECRET',
      status: 'ok',
      message: 'JWT_SECRET is properly configured.',
    });
  }

  // Check FRONTEND_URL
  const frontendUrl = process.env.FRONTEND_URL;
  const localhostPatterns = ['localhost', '127.0.0.1', '0.0.0.0'];

  if (!frontendUrl) {
    results.push({
      variable: 'FRONTEND_URL',
      status: isProduction ? 'warning' : 'ok',
      message: isProduction
        ? 'FRONTEND_URL is not set. CORS may not work correctly.'
        : 'FRONTEND_URL not set (acceptable in development).',
    });
  } else if (isProduction && localhostPatterns.some(p => frontendUrl.includes(p))) {
    results.push({
      variable: 'FRONTEND_URL',
      status: 'warning',
      message: 'FRONTEND_URL points to localhost in production.',
    });
  } else {
    results.push({
      variable: 'FRONTEND_URL',
      status: 'ok',
      message: 'FRONTEND_URL is properly configured.',
    });
  }

  // Check QBO credentials
  const qboClientId = process.env.QBO_CLIENT_ID;
  const qboClientSecret = process.env.QBO_CLIENT_SECRET;

  if (!qboClientId || !qboClientSecret) {
    results.push({
      variable: 'QBO_CREDENTIALS',
      status: isProduction ? 'critical' : 'warning',
      message: 'QBO_CLIENT_ID or QBO_CLIENT_SECRET is not set.',
    });
  } else {
    results.push({
      variable: 'QBO_CREDENTIALS',
      status: 'ok',
      message: 'QuickBooks credentials are configured.',
    });
  }

  // Check BigQuery configuration
  const bqProject = process.env.GCP_PROJECT_ID || process.env.BIGQUERY_PROJECT_ID;
  const bqDataset = process.env.BIGQUERY_DATASET;

  if (isProduction && (!bqProject || !bqDataset)) {
    results.push({
      variable: 'BIGQUERY_CONFIG',
      status: 'warning',
      message: 'BigQuery project or dataset not configured.',
    });
  }

  return results;
}

/**
 * Log environment check warnings to console
 * Call this during server startup
 */
export function logEnvWarnings(): void {
  const results = checkProductionEnv();
  const isProduction = process.env.NODE_ENV === 'production';

  const warnings = results.filter(r => r.status === 'warning');
  const criticals = results.filter(r => r.status === 'critical');

  if (criticals.length > 0) {
    console.error('\n========================================');
    console.error('CRITICAL CONFIGURATION ISSUES:');
    console.error('========================================');
    criticals.forEach(r => {
      console.error(`  [${r.variable}] ${r.message}`);
    });
    console.error('========================================\n');
  }

  if (warnings.length > 0) {
    console.warn('\n----------------------------------------');
    console.warn('Environment Configuration Warnings:');
    console.warn('----------------------------------------');
    warnings.forEach(r => {
      console.warn(`  [${r.variable}] ${r.message}`);
    });
    console.warn('----------------------------------------\n');
  }

  if (isProduction && (warnings.length > 0 || criticals.length > 0)) {
    console.warn('Review your environment configuration before going live.');
  }
}

export default { checkProductionEnv, logEnvWarnings };
