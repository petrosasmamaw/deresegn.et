import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const API = 'http://localhost:5000/api';
const AUTH = 'http://localhost:5000/api/auth';

function requireE2eEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} in server/.env`);
  }
  return value;
}

const EMAIL = requireE2eEnv('E2E_EMAIL');
const PASSWORD = requireE2eEnv('E2E_PASSWORD');
const IMAGE = process.argv[2]
  || path.join(__dirname, '../training/receipt-samples/dashen-success-paid.png');

async function signIn() {
  const res = await fetch(`${AUTH}/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sign-in failed (${res.status}): ${body}`);
  }
  return cookie;
}

async function verifyReceipt(cookie) {
  const buffer = fs.readFileSync(IMAGE);
  const blob = new Blob([buffer], { type: 'image/png' });
  const form = new FormData();
  form.append('screenshot', blob, 'dashen-success.png');
  form.append('method', 'dashen');
  form.append('withDetails', 'false');

  const res = await fetch(`${API}/check`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: 'http://localhost:5173',
    },
    body: form,
  });
  const json = await res.json();
  return { status: res.status, json };
}

console.log('Image:', IMAGE, `(${fs.statSync(IMAGE).size} bytes)`);
const cookie = await signIn();
console.log('Signed in as', EMAIL);
const { status, json } = await verifyReceipt(cookie);
console.log('Status:', status);
console.log(JSON.stringify(json, null, 2));
process.exit(status >= 200 && status < 300 && json.success ? 0 : 1);
