import { outboundFetch, BANK_FETCH_TIMEOUT_MS } from '../utils/outboundFetch.js';

const PROBES = [
  {
    name: 'telebirr',
    url: 'https://transactioninfo.ethiotelecom.et/receipt/DFC7TG1O11',
    expect: 'html',
  },
  {
    name: 'cbe_branch',
    url: 'https://apps.cbe.com.et:100/BranchReceipt/FT26176RMWVF&33687112',
    expect: 'pdf',
  },
  {
    name: 'dashen',
    url: 'https://receipt.dashensuperapp.com/receipt/110IPSS2616900WO',
    expect: 'pdf',
  },
  {
    name: 'boa',
    url: 'https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT26169X4SRS',
    expect: 'json',
  },
];

let cachedStatus = {
  checkedAt: 0,
  banks: [],
  allOk: null,
};

const CACHE_MS = 5 * 60 * 1000;

async function runProbe(probe) {
  const started = Date.now();
  try {
    const response = await outboundFetch(probe.url, {
      timeoutMs: Math.min(BANK_FETCH_TIMEOUT_MS, 22000),
      retries: 1,
      headers: probe.expect === 'html'
        ? { Accept: 'text/html,*/*', Referer: 'https://transactioninfo.ethiotelecom.et/' }
        : probe.expect === 'pdf'
          ? { Accept: 'application/pdf,*/*' }
          : { Accept: 'application/json,*/*' },
    });
    const ms = Date.now() - started;
    let ok = response.ok;
    let detail = `HTTP ${response.status}`;
    if (ok && probe.expect === 'pdf') {
      const head = Buffer.from(await response.arrayBuffer()).slice(0, 4).toString();
      ok = head === '%PDF';
      detail = ok ? 'PDF ok' : 'not PDF';
    }
    return { bank: probe.name, ok, ms, detail };
  } catch (err) {
    return { bank: probe.name, ok: false, ms: Date.now() - started, detail: err.message };
  }
}

/** Can bank APIs be reached from this server (Render)? */
export async function probeBankConnectivity() {
  const banks = await Promise.all(PROBES.map(runProbe));
  const allOk = banks.every((b) => b.ok);
  cachedStatus = { checkedAt: Date.now(), banks, allOk };
  return banks;
}

export function getBankConnectivityStatus() {
  return cachedStatus;
}

/** True when recent probe shows at least Telebirr + one other bank reachable. */
export async function isBankEgressHealthy(force = false) {
  const stale = Date.now() - cachedStatus.checkedAt > CACHE_MS;
  if (force || stale || cachedStatus.allOk == null) {
    await probeBankConnectivity();
  }
  return cachedStatus.allOk === true;
}

export function bankEgressFailureMessage() {
  return 'Bank verification servers could not reach Ethiopian bank APIs. Please retry in a minute. If this keeps happening, the server may need a network update.';
}

export function startBankConnectivityMonitor() {
  probeBankConnectivity()
    .then((banks) => {
      const failed = banks.filter((b) => !b.ok);
      if (failed.length) {
        console.warn('⚠️  Bank API probe — some banks unreachable from this server:');
        for (const f of failed) console.warn(`   ${f.bank}: ${f.detail}`);
      } else {
        console.log('✅ Bank API probe — Telebirr, CBE, Dashen, BOA reachable');
      }
    })
    .catch((err) => console.warn('⚠️  Bank API probe failed:', err.message));

  setInterval(() => {
    probeBankConnectivity().catch(() => {});
  }, CACHE_MS).unref?.();
}
