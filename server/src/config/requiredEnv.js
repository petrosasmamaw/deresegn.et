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
]);

export function assertRequiredEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const weak = REQUIRED.filter((key) => PLACEHOLDER_SECRETS.has(process.env[key]?.trim()));
  if (weak.length && process.env.NODE_ENV === 'production') {
    throw new Error(`Replace placeholder values in production: ${weak.join(', ')}`);
  }
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} in .env`);
  }
  return value;
}
