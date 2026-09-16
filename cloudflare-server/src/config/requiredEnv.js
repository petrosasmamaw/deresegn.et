const REQUIRED = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'GEMINI_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const PLACEHOLDER_SECRETS = new Set([
  'change-me-to-a-long-random-secret',
  'generate-a-long-random-secret-here',
  'your-gemini-api-key',
  'your-cloudinary-api-key',
  'your-cloudinary-api-secret',
  'your-cloud-name',
  'deresegn-dev-api-key-encryption',
]);

export function assertRequiredEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const authSecret = process.env.BETTER_AUTH_SECRET?.trim() || '';
  if (authSecret.length < 32 || PLACEHOLDER_SECRETS.has(authSecret)) {
    throw new Error('BETTER_AUTH_SECRET must be a real random value (32+ characters) in production.');
  }

  const enc = process.env.API_KEY_ENCRYPTION_SECRET?.trim() || authSecret;
  if (enc.length < 32 || PLACEHOLDER_SECRETS.has(enc)) {
    throw new Error(
      'Set API_KEY_ENCRYPTION_SECRET (32+ chars recommended) for encrypting recoverable API keys.',
    );
  }

  const softWeak = REQUIRED.filter(
    (key) => key !== 'BETTER_AUTH_SECRET' && PLACEHOLDER_SECRETS.has(process.env[key]?.trim()),
  );
  if (softWeak.length) {
    console.warn(`⚠️  Placeholder values detected: ${softWeak.join(', ')}`);
  }
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} in .env`);
  }
  return value;
}
