import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const envFile = fs.existsSync('.dev.vars') ? '.dev.vars' : '.env';
console.log(`Reading secrets from ${envFile}...`);
const env = dotenv.parse(fs.readFileSync(envFile));

const secretKeys = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'GEMINI_API_KEY',
  'CLOUDINARY_API_SECRET',
  'BREVO_API_KEY',
  'PETROS_VERIFIER_API_KEY',
];

for (const key of secretKeys) {
  const val = env[key];
  if (val) {
    try {
      console.log(`🔒 Uploading secret: ${key}...`);
      execSync(`npx.cmd wrangler secret put ${key}`, {
        input: val,
        encoding: 'utf-8',
        stdio: ['pipe', 'inherit', 'inherit'],
      });
    } catch (err) {
      console.error(`❌ Failed to upload secret ${key}:`, err.message);
    }
  }
}

console.log('✨ Secret upload process finished.');
