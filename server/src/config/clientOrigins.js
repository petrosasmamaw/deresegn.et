import os from 'os';

const isProduction = process.env.NODE_ENV === 'production';

/** Live site only — used on Render / deployed API. */
const PRODUCTION_ORIGINS = [
  'https://tamagncheck.online',
  'https://www.tamagncheck.online',
];

/** Local Vite only — never trusted by the deployed server. */
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

function getLocalLanOrigins() {
  const ports = ['5173', '8081', '5000', '3000', '19000', '19006'];
  const origins = [];
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
          for (const port of ports) {
            origins.push(`http://${net.address}:${port}`);
          }
          origins.push(`http://${net.address}`);
        }
      }
    }
  } catch {
    // ignore
  }
  for (const port of ports) {
    origins.push(`http://10.0.2.2:${port}`);
  }
  origins.push('http://10.0.2.2');
  return origins;
}

function normalizeOrigin(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url.trim());
    return u.origin;
  } catch {
    return url.trim().replace(/\/+$/, '') || null;
  }
}

function originsFromEnvValue(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function isLocalDevOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '10.0.2.2' ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname)
    );
  } catch {
    return /localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\./i.test(origin);
  }
}

/**
 * Origins allowed for CORS and Better Auth.
 * Deployed (production): only your domain (+ CLIENT_URL), never localhost.
 * Local (development): localhost Vite + LAN IP + any CLIENT_URL.
 */
export function getTrustedOrigins() {
  const defaults = isProduction
    ? PRODUCTION_ORIGINS
    : [...DEV_ORIGINS, ...getLocalLanOrigins(), ...PRODUCTION_ORIGINS];

  const fromEnv = [
    ...originsFromEnvValue(process.env.CLIENT_URL),
    ...originsFromEnvValue(process.env.CLIENT_URLS),
  ]
    .map(normalizeOrigin)
    .filter(Boolean)
    // Hard block: production must never trust a browser on someone's PC
    .filter((origin) => !(isProduction && isLocalDevOrigin(origin)));

  return [...new Set([...defaults, ...fromEnv])];
}

export function isTrustedOrigin(origin) {
  if (!origin) return true; // non-browser / same-origin tools (curl, health checks)
  const norm = normalizeOrigin(origin);
  if (getTrustedOrigins().includes(norm)) return true;
  if (!isProduction && isLocalDevOrigin(norm)) return true;
  return false;
}

export function getPrimaryClientOrigin() {
  const list = getTrustedOrigins().filter((o) => !isLocalDevOrigin(o));
  return list[0] || getTrustedOrigins()[0] || null;
}

