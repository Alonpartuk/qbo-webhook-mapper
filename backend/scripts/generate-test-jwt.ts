/**
 * Generate Test Admin JWT
 *
 * Creates a valid admin JWT token for testing purposes.
 * Run with: npx tsx scripts/generate-test-jwt.ts
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

// Must match the JWT_SECRET used by the server (from .env or adminAuthService.ts)
const JWT_SECRET = process.env.JWT_SECRET || 'admin-jwt-secret-change-in-production';

async function main() {
  console.log('🔑 Generating Test Admin JWT...\n');

  // Property names must match what verifyJwt expects in adminAuthService.ts
  // User ID must match existing admin user in mock data service
  const payload = {
    userId: 'admin-001',  // Note: 'userId' not 'user_id' - matches mockDataService
    email: 'admin@example.com',
    role: 'super_admin',
    name: 'System Admin',
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'qbo-webhook-mapper',
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('  🔐 Admin JWT Token (valid for 24 hours):');
  console.log('');
  console.log(`  ${token}`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('  📋 To run production tests, use:');
  console.log('');
  console.log(`  export TEST_ADMIN_JWT="${token}"`);
  console.log('  npm run test:prod');
  console.log('');
  console.log('  Or in one command:');
  console.log('');
  console.log(`  TEST_ADMIN_JWT="${token}" npm run test:prod`);
  console.log('');
}

main().catch(console.error);
