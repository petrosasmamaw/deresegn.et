import dns from 'dns/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const disposableDomainsRaw = require('disposable-email-domains');

const disposableDomains = Array.isArray(disposableDomainsRaw)
  ? disposableDomainsRaw
  : (disposableDomainsRaw?.default || []);

const EXTRA_DISPOSABLE_DOMAINS = [
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'tempmailo.com',
  'dispostable.com',
  'fakemailgenerator.com',
  'generator.email',
  'emailondeck.com',
  'yopmail.com',
  'yopmail.net',
  'yopmail.fr',
  'sharklasers.com',
  'guerrillamailblock.com',
  'guerrillamail.net',
  'guerrillamail.biz',
  'guerrillamail.org',
  'grr.la',
  'getairmail.com',
  'throwawaymail.com',
  'mohmal.com',
  'mytemp.email',
  'crazymailing.com',
  'nada.ltd',
  'inboxkitten.com',
  'burnermail.io',
  'minutemailbox.com',
];

const disposableSet = new Set([
  ...disposableDomains.map((d) => String(d).toLowerCase().trim()),
  ...EXTRA_DISPOSABLE_DOMAINS,
]);

// Fast-path known trusted email providers to eliminate DNS lookups (0ms latency)
const TRUSTED_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.fr',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'yandex.com',
  'yandex.ru',
  'aol.com',
]);

// In-memory cache for MX lookups: domain -> { isValid: boolean, expiresAt: number }
const mxCache = new Map();
const MX_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const DNS_TIMEOUT_MS = 3000;

/**
 * Extract clean lowercase domain from an email address
 */
export function extractEmailDomain(email) {
  if (!email || typeof email !== 'string') return null;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const domain = parts[1].trim();
  // Basic domain pattern validation (e.g. example.com)
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain)) {
    return null;
  }
  return domain;
}

/**
 * Check if the email uses a known disposable/temporary inbox domain
 */
export function isDisposableEmail(email) {
  const domain = extractEmailDomain(email);
  if (!domain) return false;

  if (disposableSet.has(domain)) return true;

  // Check subdomains (e.g. sub.mailinator.com)
  const parts = domain.split('.');
  if (parts.length > 2) {
    const parentDomain = parts.slice(-2).join('.');
    if (disposableSet.has(parentDomain)) return true;
  }

  return false;
}

/**
 * Check if the email domain has valid DNS MX records with caching and timeout
 */
export async function isRealEmailDomain(email) {
  const domain = extractEmailDomain(email);
  if (!domain) return false;

  // Fast-path known trusted providers
  if (TRUSTED_DOMAINS.has(domain)) {
    return true;
  }

  // Check cache
  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.isValid;
  }

  try {
    const lookupPromise = dns.resolveMx(domain);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('DNS lookup timeout')), DNS_TIMEOUT_MS);
    });

    const records = await Promise.race([lookupPromise, timeoutPromise]);
    const isValid = Array.isArray(records) && records.length > 0 && records.some((r) => r && r.exchange);

    mxCache.set(domain, { isValid, expiresAt: Date.now() + MX_CACHE_TTL_MS });
    return isValid;
  } catch {
    // If domain has no MX records or DNS resolution fails
    mxCache.set(domain, { isValid: false, expiresAt: Date.now() + MX_CACHE_TTL_MS });
    return false;
  }
}

/**
 * Comprehensive email validation for registration
 * Returns { valid: true } or { valid: false, message: string }
 */
export async function validateEmailForRegistration(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Please enter a valid email address.' };
  }

  const domain = extractEmailDomain(email);
  if (!domain) {
    return { valid: false, message: 'Please enter a valid email format (e.g. name@example.com).' };
  }

  if (isDisposableEmail(email)) {
    return {
      valid: false,
      message: 'Disposable or temporary email addresses are not allowed. Please use a permanent email.',
    };
  }

  const hasMx = await isRealEmailDomain(email);
  if (!hasMx) {
    return {
      valid: false,
      message: 'The email domain does not appear to exist or cannot receive emails. Please check your spelling.',
    };
  }

  return { valid: true };
}
