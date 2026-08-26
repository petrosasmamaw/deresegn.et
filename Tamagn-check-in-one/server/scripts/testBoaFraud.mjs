import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { verifyBoaReceipt } from '../src/services/boaReceiptService.js';
import { validateReceiptSubmission } from '../src/services/receiptValidationService.js';

async function verifyBoa(buffer) {
  const boa = await verifyBoaReceipt({ buffer, mime: 'image/png' });
  return validateReceiptSubmission({
    method: 'boa',
    form: {},
    extracted: boa.extracted,
    qrData: boa.qrData,
    qrFields: boa.qrFields,
    geminiUsed: boa.geminiUsed,
    withDetails: false,
    boaResolve: boa.boaResolve,
  });
}

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ASSETS = 'C:/Users/For you/.cursor/projects/c-Users-For-you-OneDrive-Desktop-folders-website-NEXT-JS-PROJECTS-deresegn/assets';

const samples = [
  {
    label: 'original',
    file: `${ASSETS}/c__Users_For_you_AppData_Roaming_Cursor_User_workspaceStorage_174c1b88899283e5070214efdbbbb86f_images_boa-76bcd65f-732a-4d3b-822d-2fa03fd33246.png`,
  },
  {
    label: 'edited',
    file: `${ASSETS}/c__Users_For_you_AppData_Roaming_Cursor_User_workspaceStorage_174c1b88899283e5070214efdbbbb86f_images_F-57331778-afa0-42ec-9619-d44bb910902c.png`,
  },
  {
    label: 'training-sample',
    file: path.join(__dirname, '../training/receipt-samples/boa-receipt.png'),
  },
];

for (const s of samples) {
  if (!fs.existsSync(s.file)) {
    console.log('missing', s.label, s.file);
    continue;
  }
  const buffer = fs.readFileSync(s.file);
  const t0 = Date.now();
  const result = await verifyBoa(buffer);
  console.log('\n===', s.label, '===', Date.now() - t0, 'ms');
  console.log('passed:', result.passed);
  console.log('extracted tx:', result.extracted?.transactionCode, 'amt:', result.extracted?.amount);
  console.log('qr tx:', result.qrFields?.transactionCode, 'qr amt:', result.qrFields?.amount, 'boaApi:', result.qrFields?.boaApiSource);
  console.log('errors:', result.errors);
  console.log('cropped:', result.screenshotCropped);
}
