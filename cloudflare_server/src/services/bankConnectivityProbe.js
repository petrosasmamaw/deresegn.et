import { outboundFetch, BANK_FETCH_TIMEOUT_MS } from '../utils/outboundFetch.js';
import { httpsGet, httpsGetText } from '../utils/httpsGet.js';

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
};

const CACHE_MS = 5 * 60 * 1000;

async function probeTelebirr(probe) {
  const started = Date.now();
  try {
    const res = await httpsGetText(probe.url, {
      timeoutMs: 45000,
      headers: {
        Accept: 'text/html,*/*',
        Referer: 'https://transactioninfo.ethiotelecom.et/',
      },
    });
    const ok = res.ok && res.text && !/receipt not found/i.test(res.text);
    return {
      bank: probe.name,
      ok,
      ms: Date.now() - started,
      detail: ok ? 'HTML ok' : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { bank: probe.name, ok: false, ms: Date.now() - started, detail: err.message };
  }
}

async function runProbe(probe) {
  if (probe.expect === 'html') return probeTelebirr(probe);

  const started = Date.now();
  try {
    if (probe.name === 'cbe_branch') {
      const res = await httpsGet(probe.url, {
        timeoutMs: Math.min(BANK_FETCH_TIMEOUT_MS, 25000),
        rejectUnauthorized: false,
        headers: { Accept: 'application/pdf,*/*' },
      });
      const ms = Date.now() - started;
      const head = res.body.slice(0, 4).toString();
      const ok = res.ok && head === '%PDF';
      return {
        bank: probe.name,
        ok,
        ms,
        detail: ok ? 'PDF ok' : (res.ok ? 'not PDF' : `HTTP ${res.status}`),
      };
    }

    const response = await outboundFetch(probe.url, {
      timeoutMs: Math.min(BANK_FETCH_TIMEOUT_MS, 25000),
      retries: 1,
      headers: probe.expect === 'pdf'
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
  cachedStatus = { checkedAt: Date.now(), banks };
  return banks;
}

export function getBankConnectivityStatus() {
  return cachedStatus;
}

/** Per-bank reachability from last probe (informational only — never blocks verify). */
export function isBankReachable(method) {
  const key = method === 'cbe' ? 'cbe_branch' : method;
  const hit = cachedStatus.banks.find((b) => b.bank === key);
  return hit?.ok !== false;
}

export function startBankConnectivityMonitor() {
  probeBankConnectivity()
    .then((banks) => {
      const failed = banks.filter((b) => !b.ok);
      if (failed.length) {
        console.warn('⚠️  Bank API probe — unreachable from this server:');
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
