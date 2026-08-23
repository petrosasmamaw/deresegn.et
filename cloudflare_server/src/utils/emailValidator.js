import dns from 'dns/promises';
import disposableDomains from 'disposable-email-domains/index.json' with { type: 'json' };
import { isWorkersRuntime } from '../config/runtime.js';

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
  ...(Array.isArray(disposableDomains) ? disposableDomains : []).map((d) => String(d).toLowerCase().trim()),
  ...EXTRA_DISPOSABLE_DOMAINS,
]);

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

const mxCache = new Map();
const MX_CACHE_TTL_MS = 60 * 60 * 1000;
const DNS_TIMEOUT_MS = 3000;

export function extractEmailDomain(email) {
  if (!email || typeof email !== 'string') return null;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const domain = parts[1].trim();
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain)) {
    return null;
  }
  return domain;
}

export function isDisposableEmail(email) {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  if (disposableSet.has(domain)) return true;
  const parts = domain.split('.');
  if (parts.length > 2) {
    const parentDomain = parts.slice(-2).join('.');
    if (disposableSet.has(parentDomain)) return true;
  }
  return false;
}

async function resolveMxViaDoh(domain) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`;
  const res = await fetch(url, {
    headers: { Accept: 'application/dns-json' },
    signal: AbortSignal.timeout(DNS_TIMEOUT_MS),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data?.Answer) && data.Answer.some((a) => a?.type === 15 || a?.data);
}

async function resolveMxViaNode(domain) {
  const records = await dns.resolveMx(domain);
  return Array.isArray(records) && records.length > 0 && records.some((r) => r && r.exchange);
}

export async function isRealEmailDomain(email) {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  if (TRUSTED_DOMAINS.has(domain)) return true;

  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.isValid;
  }

  try {
    const isValid = isWorkersRuntime()
      ? await resolveMxViaDoh(domain)
      : await resolveMxViaNode(domain);
    mxCache.set(domain, { isValid, expiresAt: Date.now() + MX_CACHE_TTL_MS });
    return isValid;
  } catch {
    mxCache.set(domain, { isValid: false, expiresAt: Date.now() + MX_CACHE_TTL_MS });
    return false;
  }
}

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
