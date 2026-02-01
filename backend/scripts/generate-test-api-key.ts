/**
 * Generate Test API Key Script
 *
 * Creates a test API key for the default organization.
 * Run with: npx ts-node scripts/generate-test-api-key.ts
 */

import { generateApiKey } from '../src/services/apiKeyService';
import { DEFAULT_ORGANIZATION_ID } from '../src/types';

async function main() {
  console.log('🔑 Generating Test API Key...\n');

  try {
    const result = await generateApiKey({
      organization_id: DEFAULT_ORGANIZATION_ID,
      name: 'Test API Key',
      key_type: 'tenant',
      permissions: {
        endpoints: ['proxy:read', 'proxy:write', 'webhooks:*'],
        rate_limit_tier: 'standard',
      },
      created_by: 'script',
    });

    console.log('✅ API Key Generated Successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('  🔐 API KEY (save this - shown only once!):');
    console.log('');
    console.log(`     ${result.key}`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('  Key ID:', result.key_id);
    console.log('  Name:', result.name);
    console.log('  Type:', result.key_type);
    console.log('  Organization:', result.organization_id);
    console.log('  Prefix:', `...${result.key_prefix}`);
    console.log('');
    console.log('📋 Test command:');
    console.log('');
    console.log(`curl -X GET "http://localhost:3002/api/v1/org/default/proxy/data?type=customers" \\`);
    console.log(`  -H "X-API-Key: ${result.key}"`);
    console.log('');

  } catch (error) {
    console.error('❌ Failed to generate API key:', error);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
