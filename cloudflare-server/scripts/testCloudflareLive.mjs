import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CF_BASE = 'https://deresegn-cloudflare-server.asmamawpetros.workers.dev/api';
const ORIGIN = 'https://tamagncheck.online';

const EMAIL = 'mistrasmamaw@gmail.com';
const PASSWORD = '12345678';

async function testLive() {
  console.log('--- 1. Testing Auth / Sign-in on Cloudflare Server ---');
  const authRes = await fetch(`${CF_BASE}/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  const setCookie = authRes.headers.getSetCookie?.() || [];
  const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  console.log('Sign in status:', authRes.status);
  if (!authRes.ok) {
    const txt = await authRes.text();
    console.error('Sign in failed:', txt);
    return;
  }
  console.log('Signed in successfully.');

  console.log('\n--- 2. Testing Telebirr Reference Verification ---');
  const telebirrRes = await fetch(`${CF_BASE}/check/reference`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      Origin: ORIGIN,
    },
    body: JSON.stringify({
      method: 'telebirr',
      transactionCode: 'DET8FJGUJ4',
    }),
  });
  const telebirrJson = await telebirrRes.json();
  console.log('Telebirr reference status:', telebirrRes.status);
  console.log('Telebirr success:', telebirrJson.success);
  console.log('Telebirr message:', telebirrJson.message);
  if (telebirrJson.data?.check) {
    console.log('Telebirr check details:', {
      method: telebirrJson.data.check.method,
      txCode: telebirrJson.data.check.transactionCode,
      amount: telebirrJson.data.check.amount,
      sender: telebirrJson.data.check.senderName,
      receiver: telebirrJson.data.check.receiverName,
      status: telebirrJson.data.check.status,
    });
  } else {
    console.log('Telebirr full response:', telebirrJson);
  }

  console.log('\n--- 3. Testing Dashen Screenshot Verification ---');
  const dashenImgPath = path.join(__dirname, '../../server/training/receipt-samples/dashen-success-paid.png');
  const dashenBuf = fs.readFileSync(dashenImgPath);
  const dashenBlob = new Blob([dashenBuf], { type: 'image/png' });
  const dashenForm = new FormData();
  dashenForm.append('screenshot', dashenBlob, 'dashen-success.png');
  dashenForm.append('method', 'dashen');
  dashenForm.append('withDetails', 'false');

  const dashenRes = await fetch(`${CF_BASE}/check`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: ORIGIN,
    },
    body: dashenForm,
  });
  const dashenText = await dashenRes.text();
  let dashenJson = null;
  try {
    dashenJson = JSON.parse(dashenText);
  } catch {
    console.error('Dashen response is NOT JSON! Status:', dashenRes.status, 'Body:', dashenText.slice(0, 500));
  }
  console.log('Dashen screenshot status:', dashenRes.status);
  if (dashenJson) {
    console.log('Dashen success:', dashenJson.success);
    console.log('Dashen message:', dashenJson.message);
  }
  if (dashenJson.data?.check) {
    console.log('Dashen check details:', {
      method: dashenJson.data.check.method,
      txCode: dashenJson.data.check.transactionCode,
      amount: dashenJson.data.check.amount,
      sender: dashenJson.data.check.senderName,
      receiver: dashenJson.data.check.receiverName,
      status: dashenJson.data.check.status,
    });
  } else {
    console.log('Dashen full response:', dashenJson);
  }

  console.log('\n--- 3b. Testing Dashen Mobile JPEG Screenshot Verification ---');
  const dashenJpgPath = path.join(__dirname, '../../deresegn-mobile-app/assets/receipts/dashen.jpg');
  if (fs.existsSync(dashenJpgPath)) {
    const dashenJpgBuf = fs.readFileSync(dashenJpgPath);
    const dashenJpgBlob = new Blob([dashenJpgBuf], { type: 'image/jpeg' });
    const dashenJpgForm = new FormData();
    dashenJpgForm.append('screenshot', dashenJpgBlob, 'dashen-mobile.jpg');
    dashenJpgForm.append('method', 'dashen');
    dashenJpgForm.append('withDetails', 'false');

    const dashenJpgRes = await fetch(`${CF_BASE}/check`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
      },
      body: dashenJpgForm,
    });
    const dashenJpgText = await dashenJpgRes.text();
    let dashenJpgJson = null;
    try {
      dashenJpgJson = JSON.parse(dashenJpgText);
    } catch {
      console.error('Dashen JPG response is NOT JSON! Status:', dashenJpgRes.status, 'Body:', dashenJpgText.slice(0, 500));
    }
    console.log('Dashen JPG screenshot status:', dashenJpgRes.status);
    if (dashenJpgJson) {
      console.log('Dashen JPG success:', dashenJpgJson.success);
      console.log('Dashen JPG message:', dashenJpgJson.message);
    }
    if (dashenJpgJson?.data?.check) {
      console.log('Dashen JPG check details:', {
        txCode: dashenJpgJson.data.check.transactionCode,
        amount: dashenJpgJson.data.check.amount,
        sender: dashenJpgJson.data.check.senderName,
        receiver: dashenJpgJson.data.check.receiverName,
      });
    }
  }

  console.log('\n--- 4. Testing CBE Screenshot Verification ---');
  const cbeImgPath = path.join(__dirname, '../../server/training/receipt-samples/cbe-success-card.png');
  const cbeBuf = fs.readFileSync(cbeImgPath);
  const cbeBlob = new Blob([cbeBuf], { type: 'image/png' });
  const cbeForm = new FormData();
  cbeForm.append('screenshot', cbeBlob, 'cbe-success.png');
  cbeForm.append('method', 'cbe');
  cbeForm.append('withDetails', 'false');

  const cbeRes = await fetch(`${CF_BASE}/check`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: ORIGIN,
    },
    body: cbeForm,
  });
  const cbeText = await cbeRes.text();
  let cbeJson = null;
  try { cbeJson = JSON.parse(cbeText); } catch {
    console.error('CBE response is NOT JSON! Status:', cbeRes.status, 'Body:', cbeText.slice(0, 500));
  }
  console.log('CBE screenshot status:', cbeRes.status);
  if (cbeJson) {
    console.log('CBE success:', cbeJson.success);
    console.log('CBE message:', cbeJson.message);
  }
  if (cbeJson?.data?.check) {
    console.log('CBE check details:', {
      method: cbeJson.data.check.method,
      txCode: cbeJson.data.check.transactionCode,
      amount: cbeJson.data.check.amount,
      sender: cbeJson.data.check.senderName,
      receiver: cbeJson.data.check.receiverName,
    });
  }

  console.log('\n--- 5. Testing BOA Screenshot Verification ---');
  const boaImgPath = path.join(__dirname, '../../server/training/receipt-samples/boa-receipt.png');
  const boaBuf = fs.readFileSync(boaImgPath);
  const boaBlob = new Blob([boaBuf], { type: 'image/png' });
  const boaForm = new FormData();
  boaForm.append('screenshot', boaBlob, 'boa-receipt.png');
  boaForm.append('method', 'boa');
  boaForm.append('withDetails', 'false');

  const boaRes = await fetch(`${CF_BASE}/check`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: ORIGIN,
    },
    body: boaForm,
  });
  const boaText = await boaRes.text();
  let boaJson = null;
  try { boaJson = JSON.parse(boaText); } catch {
    console.error('BOA response is NOT JSON! Status:', boaRes.status, 'Body:', boaText.slice(0, 500));
  }
  console.log('BOA screenshot status:', boaRes.status);
  if (boaJson) {
    console.log('BOA success:', boaJson.success);
    console.log('BOA message:', boaJson.message);
  }
  if (boaJson?.data?.check) {
    console.log('BOA check details:', {
      method: boaJson.data.check.method,
      txCode: boaJson.data.check.transactionCode,
      amount: boaJson.data.check.amount,
      sender: boaJson.data.check.senderName,
      receiver: boaJson.data.check.receiverName,
    });
  }
}

testLive().catch(console.error);
