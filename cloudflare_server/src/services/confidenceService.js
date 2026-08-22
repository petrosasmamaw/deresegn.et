const TIER_LABELS = {
  verified: 'Verified',
  likely_valid: 'Likely Valid',
  suspicious: 'Suspicious',
  rejected: 'Rejected',
};

export function computeConfidenceTier(validation, verifyMode = 'screenshot') {
  if (!validation?.passed) return 'rejected';

  if (verifyMode === 'reference' || verifyMode === 'sms') {
    return 'likely_valid';
  }

  const qrFields = validation.qrFields || {};
  const hasOfficialApi = Boolean(
    qrFields.telebirrApiSource
    || qrFields.boaApiSource
    || qrFields.cbeApiSource
    || validation.officialSource === 'official_api',
  );
  const hasQrProof = Boolean(validation.txCode || qrFields.transactionCode);

  if (hasOfficialApi && hasQrProof) return 'verified';
  if (hasQrProof) return 'verified';

  if (validation.warnings?.length) return 'suspicious';
  return 'likely_valid';
}

export function getConfidenceLabel(tier) {
  return TIER_LABELS[tier] || tier;
}

export function getConfidenceDescription(tier, verifyMode) {
  if (tier === 'verified') {
    return 'Matched against official bank record with QR proof';
  }
  if (tier === 'likely_valid') {
    if (verifyMode === 'sms') return 'SMS parsed and matched official receipt link';
    if (verifyMode === 'reference') return 'Verified directly from official bank record';
    return 'Receipt fields matched available proof';
  }
  if (tier === 'suspicious') {
    return 'Passed with warnings — review notes before trusting';
  }
  return 'Verification failed';
}
