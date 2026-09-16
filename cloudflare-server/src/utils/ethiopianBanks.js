/**
 * Ethiopian bank / institution names that often appear on Telebirr (and other)
 * screenshots as the "receiver" when money is sent to a bank account.
 *
 * These are NOT person names. Comparing them to an official person name must
 * never trigger a FRAUD_EDITED_RECEIPT / name-mismatch error.
 *
 * Pure + sync — safe to call on every verify (microseconds).
 */

const BANK_ALIAS_GROUPS = [
  ['commercial bank of ethiopia', 'cbe', 'c b e', 'comm bank of ethiopia', 'commercial bank'],
  ['bank of abyssinia', 'boa', 'abyssinia bank', 'abyssinia'],
  ['dashen bank', 'dashen', 'dashen super app'],
  ['awash bank', 'awash'],
  ['cooperative bank of oromia', 'coop bank of oromia', 'coop bank', 'cbo bank', 'cbo'],
  ['hibret bank', 'hibret', 'united bank', 'united bank of ethiopia'],
  ['nib international bank', 'nib bank', 'nib'],
  ['wegagen bank', 'wegagen'],
  ['bunna bank', 'buna bank', 'bunna', 'buna'],
  ['zemen bank', 'zemen'],
  ['abay bank', 'abay'],
  ['addis international bank', 'addis bank'],
  ['berhan bank', 'birhan bank', 'berhan', 'birhan'],
  ['debub global bank', 'debub bank', 'debub'],
  ['enat bank', 'enat'],
  ['gadaa bank', 'gada bank', 'gadaa', 'gada'],
  ['hijra bank', 'hijra'],
  ['lion international bank', 'lion bank', 'lion'],
  ['zamzam bank', 'zam zam bank', 'zamzam'],
  ['tsedey bank', 'tsedey'],
  ['siinqee bank', 'sinqee bank', 'siinqee'],
  ['amhara bank'],
  ['oromia bank', 'oromia international bank'],
  ['telebirr', 'ethio telecom', 'ethiotelecom', 'ethio tele'],
];

/** Precomputed for O(1)-ish lookups. */
const EXACT_ALIASES = new Set();
/** Longer phrases checked via includes (sorted longest-first). */
const PHRASE_ALIASES = [];

for (const group of BANK_ALIAS_GROUPS) {
  for (const alias of group) {
    const key = normalizeBankKey(alias);
    if (!key) continue;
    EXACT_ALIASES.add(key);
    if (key.length >= 4) PHRASE_ALIASES.push(key);
  }
}
PHRASE_ALIASES.sort((a, b) => b.length - a.length);

export function normalizeBankKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when the string is (or clearly contains) an Ethiopian bank / wallet brand,
 * not a personal name.
 */
export function isEthiopianBankName(value) {
  const key = normalizeBankKey(value);
  if (!key) return false;
  if (EXACT_ALIASES.has(key)) return true;

  // Whole-string bank phrase (e.g. "Commercial Bank of Ethiopia")
  for (const phrase of PHRASE_ALIASES) {
    if (phrase.length < 5) continue; // avoid short tokens like "cbe" as substring of names
    if (key === phrase || key.startsWith(`${phrase} `) || key.endsWith(` ${phrase}`) || key.includes(` ${phrase} `)) {
      return true;
    }
  }

  // Short exact tokens already covered by EXACT_ALIASES ("cbe", "boa", …)
  return false;
}

/**
 * Person-name fraud compares should ignore bank/institution labels.
 * Returns false when either side is a bank name (treat as "no conflict").
 */
export function personNamesConflict(a, b, namesMatchFn) {
  if (!a || !b) return false;
  if (isEthiopianBankName(a) || isEthiopianBankName(b)) return false;
  return !namesMatchFn(a, b);
}

export const ETHIOPIAN_BANK_ALIAS_COUNT = EXACT_ALIASES.size;
