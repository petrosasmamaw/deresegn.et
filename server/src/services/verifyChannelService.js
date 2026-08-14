import { getSetting, setSetting } from './balanceLedgerService.js';

export const VERIFY_BANKS = ['telebirr', 'cbe', 'boa', 'dashen'];
export const VERIFY_MODES = ['screenshot', 'reference', 'sms'];
export const SMS_BANKS = new Set(['telebirr', 'cbe', 'boa']);

const SETTING_KEY = 'verify_channels';

function defaultBank(id) {
  return {
    enabled: true,
    screenshot: true,
    reference: true,
    sms: SMS_BANKS.has(id),
  };
}

export function defaultVerifyChannels() {
  return Object.fromEntries(VERIFY_BANKS.map((id) => [id, defaultBank(id)]));
}

function parseBool(value, fallback) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

export function normalizeVerifyChannels(raw) {
  const defaults = defaultVerifyChannels();
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return defaults;
    }
  }
  if (!parsed || typeof parsed !== 'object') return defaults;

  const next = { ...defaults };
  for (const id of VERIFY_BANKS) {
    const incoming = parsed[id] || {};
    const fallback = defaults[id];
    next[id] = {
      enabled: parseBool(incoming.enabled, fallback.enabled),
      screenshot: parseBool(incoming.screenshot, fallback.screenshot),
      reference: parseBool(incoming.reference, fallback.reference),
      sms: SMS_BANKS.has(id) ? parseBool(incoming.sms, fallback.sms) : false,
    };
  }
  return next;
}

export async function getVerifyChannels() {
  const raw = await getSetting(SETTING_KEY, null);
  return normalizeVerifyChannels(raw);
}

export async function setVerifyChannels(patch) {
  const current = await getVerifyChannels();
  const merged = normalizeVerifyChannels({ ...current, ...(patch || {}) });
  await setSetting(SETTING_KEY, JSON.stringify(merged));
  return merged;
}

export function isModeAvailable(method, mode, catalog) {
  const id = String(method || '').trim().toLowerCase();
  const bank = catalog?.[id];
  if (!bank?.enabled) return false;
  if (mode === 'sms' && !SMS_BANKS.has(id)) return false;
  if (!VERIFY_MODES.includes(mode)) return false;
  return Boolean(bank[mode]);
}

export function bankHasAnyMode(method, catalog) {
  return VERIFY_MODES.some((mode) => isModeAvailable(method, mode, catalog));
}

export async function isVerifyChannelEnabled(method, mode) {
  const catalog = await getVerifyChannels();
  return isModeAvailable(method, mode, catalog);
}

export function toClientCatalog(catalog) {
  return {
    banks: VERIFY_BANKS.map((id) => ({
      id,
      enabled: Boolean(catalog[id]?.enabled) && bankHasAnyMode(id, catalog),
      smsAvailable: SMS_BANKS.has(id),
      modes: {
        screenshot: isModeAvailable(id, 'screenshot', catalog),
        reference: isModeAvailable(id, 'reference', catalog),
        sms: isModeAvailable(id, 'sms', catalog),
      },
    })),
    catalog,
  };
}
