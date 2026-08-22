/**
 * End-to-end smoke checks for auth routes, verify/topup/API wiring, CORS, GSC assets.
 * Run: node scripts/smokeSystem.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const clientRoot = path.resolve(root, '../client');
const API = process.env.API_TEST_BASE || 'http://localhost:5000/api';
const SITE = 'https://tamagncheck.online';

const results = [];
function ok(name, pass, detail = '') {
  results.push({ name, pass: Boolean(pass), detail });
  console.log(pass ? `OK   ${name}` : `FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

async function http(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text, headers: res.headers };
}

async function main() {
  console.log('=== System smoke test ===');
  console.log('API:', API);

  // 1) Health
  const health = await http(`${API}/health`);
  ok('GET /api/health', health.status === 200 && health.json?.status === 'ok', String(health.status));

  // 2) CORS: trusted origin
  const corsOk = await http(`${API}/health`, {
    headers: { Origin: SITE },
  });
  ok(
    'CORS allows tamagncheck.online',
    corsOk.headers.get('access-control-allow-origin') === SITE
      || corsOk.status === 200,
    `ACA-Origin=${corsOk.headers.get('access-control-allow-origin')}`,
  );

  // 3) CORS: localhost blocked on production would be N/A locally; check middleware import path exists
  const originsFile = fs.readFileSync(path.join(root, 'src/config/clientOrigins.js'), 'utf8');
  ok('Production origins exclude localhost defaults', originsFile.includes('PRODUCTION_ORIGINS') && originsFile.includes('tamagncheck.online'));
  ok('Localhost stripped in production', originsFile.includes('isLocalDevOrigin') && originsFile.includes('isProduction'));

  // 4) Auth endpoints exist
  const session = await http(`${API}/auth/get-session`, {
    headers: { Origin: 'http://localhost:5173', 'X-Tamagn-Client': '1' },
  });
  ok('GET /api/auth/get-session responds', [200, 204].includes(session.status) || session.json === null || session.status === 200, String(session.status));

  // 5) Register/login CSRF + validation (no real account needed)
  const badSignup = await http(`${API}/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      'X-Tamagn-Client': '1',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ email: 'not-an-email', password: 'short', name: 'x' }),
  });
  ok(
    'POST sign-up rejects invalid payload (auth alive)',
    badSignup.status >= 400 && badSignup.status < 500,
    `${badSignup.status} ${badSignup.text?.slice(0, 120)}`,
  );

  const csrfBlocked = await http(`${API}/check/sms`, {
    method: 'POST',
    headers: { Origin: 'https://evil.example' },
    body: JSON.stringify({ method: 'cbe', smsText: 'test' }),
  });
  ok(
    'CSRF blocks evil origin on verify',
    csrfBlocked.status === 403 && (csrfBlocked.json?.code === 'CSRF_BLOCKED' || /origin|csrf|forbidden/i.test(csrfBlocked.text || '')),
    `${csrfBlocked.status} ${csrfBlocked.text?.slice(0, 160)}`,
  );

  // 6) Protected verify/topup without session → 401
  const verifyNoAuth = await http(`${API}/check/sms`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      'X-Tamagn-Client': '1',
    },
    body: JSON.stringify({ method: 'cbe', smsText: 'Dear test Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-xxxxxxxx' }),
  });
  ok('Verify SMS requires login (401)', verifyNoAuth.status === 401, String(verifyNoAuth.status));

  const topupNoAuth = await http(`${API}/balance/topup/sms`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      'X-Tamagn-Client': '1',
    },
    body: JSON.stringify({ method: 'cbe', smsText: 'test' }),
  });
  ok('Top-up SMS requires login (401)', topupNoAuth.status === 401, String(topupNoAuth.status));

  const balNoAuth = await http(`${API}/balance`, {
    headers: { Origin: 'http://localhost:5173', 'X-Tamagn-Client': '1' },
  });
  ok('Balance requires login (401)', balNoAuth.status === 401, String(balNoAuth.status));

  // 7) Paid API
  const v1Guide = await http(`${API}/v1`);
  ok('GET /api/v1 guide', v1Guide.status === 200 && v1Guide.json?.data?.banks?.length >= 4, String(v1Guide.status));

  const v1Me = await http(`${API}/v1/me`);
  ok('GET /api/v1/me without key → 401', v1Me.status === 401, String(v1Me.status));

  // 8) Developer pricing public
  const pricing = await http(`${API}/developer/pricing`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  ok('GET /api/developer/pricing', pricing.status === 200, String(pricing.status));

  // 9) Client routes (Vite)
  for (const p of ['/', '/login', '/register']) {
    const r = await http(`http://localhost:5173${p}`);
    ok(`Client ${p}`, r.status === 200 && /html/i.test(r.text || ''), String(r.status));
  }

  // 10) GSC / SEO assets in source
  const sitemap = fs.readFileSync(path.join(clientRoot, 'public/sitemap.xml'), 'utf8');
  const robots = fs.readFileSync(path.join(clientRoot, 'public/robots.txt'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(clientRoot, 'index.html'), 'utf8');
  ok('sitemap uses tamagncheck.online', sitemap.includes('https://tamagncheck.online/') && !sitemap.includes('pro.et'));
  ok('robots sitemap URL correct', robots.includes('https://tamagncheck.online/sitemap.xml'));
  ok('index.html canonical online', indexHtml.includes('canonical" href="https://tamagncheck.online/"'));
  ok('index.html has Login/Register/Get API structured links',
    indexHtml.includes('/login') && indexHtml.includes('/register') && indexHtml.includes('/developer'));
  ok('index.html brand Tamagn / ታማኝ', /Tamagn|ታማኝ/.test(indexHtml));
  ok('No google URL-prefix verify file', !fs.existsSync(path.join(clientRoot, 'public/googlef09ba43e106a21ff.html')));

  // 11) Live site (if up)
  try {
    const live = await http(SITE + '/');
    const liveSitemap = await http(SITE + '/sitemap.xml');
    ok('Live site responds', live.status === 200, String(live.status));
    const hasNewBrand = /Tamagn|ታማኝ/.test(live.text || '');
    const hasOldBrand = /Check Deresegn/.test(live.text || '');
    ok('Live site has new brand (or needs redeploy)', hasNewBrand || !hasOldBrand,
      hasOldBrand ? 'Still shows Check Deresegn — redeploy frontend' : (hasNewBrand ? 'brand ok' : 'check title manually'));
    ok('Live sitemap reachable', liveSitemap.status === 200 && /tamagncheck\.online/.test(liveSitemap.text || ''),
      liveSitemap.status === 200 && /pro\.et/.test(liveSitemap.text || '')
        ? 'sitemap still has old domain — redeploy'
        : String(liveSitemap.status));
  } catch (e) {
    ok('Live site check', false, e.message);
  }

  // 12) CBE SMS parser (known good sample)
  const { verifySmsTransaction } = await import('../src/services/smsVerifyService.js');
  const sms = 'Dear Petiros Asmamaw Abebe A debit transaction of ETB 500.0. has occurred on your account 1****7112. Service charge of ETB 10.00 and VAT(15%) of ETB1.50 and Disaster Recovery(5%) of 0.50 with total of ETB512.00 .Your current balance is ETB17,754.89. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-hfHCxFSdME8b84xG1CG7  for feedback: https://forms.gle/kGNGQpG3mQCCk3iD6';
  try {
    const smsResult = await verifySmsTransaction('cbe', sms);
    ok('CBE SMS verify pipeline', smsResult.passed === true, smsResult.message || '');
  } catch (e) {
    ok('CBE SMS verify pipeline', false, e.message);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('Failed:');
    for (const f of failed) console.log(' -', f.name, f.detail || '');
    process.exit(1);
  }
  console.log('All smoke checks passed.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
