/**
 * Verification fee tiers (Birr). Pure, dependency-free module so the money math
 * can be unit-tested in isolation without pulling in DB/Cloudinary/AI imports.
 *
 * Tiers are the single source of truth for what a wallet verification costs:
 *   < 100      → 2
 *   100–999    → 5
 *   1,000–4,999→ 10
 *   5,000–9,999→ 15
 *   10,000+    → 20
 */
export const VERIFY_FEE_TIERS = [
  { maxExclusive: 100, cost: 2 },
  { maxExclusive: 1000, cost: 5 },
  { maxExclusive: 5000, cost: 10 },
  { maxExclusive: 10000, cost: 15 },
  { maxExclusive: null, cost: 20 },
];

/** Cost to verify a receipt of the given Birr amount. */
export function getCheckCostByAmount(amount) {
  const numAmount = parseFloat(amount) || 0;
  for (const tier of VERIFY_FEE_TIERS) {
    if (tier.maxExclusive === null || numAmount < tier.maxExclusive) {
      return tier.cost;
    }
  }
  return 20;
}
