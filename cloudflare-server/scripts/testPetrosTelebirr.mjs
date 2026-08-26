import 'dotenv/config';
import { fetchTelebirrViaPetros, isPetrosVerifierConfigured } from '../src/services/petrosVerifierService.js';
import { fetchTelebirrReceipt } from '../src/services/telebirrReceiptService.js';

const invoice = process.argv[2] || 'DET8FJGUJ4';

async function main() {
  console.log('Petros configured:', isPetrosVerifierConfigured());
  console.log('Invoice:', invoice);

  const t0 = Date.now();
  const viaPetros = await fetchTelebirrViaPetros(invoice);
  console.log('viaPetros', Date.now() - t0, 'ms', viaPetros);

  const t1 = Date.now();
  const viaReceipt = await fetchTelebirrReceipt(invoice);
  console.log('viaReceipt', Date.now() - t1, 'ms', viaReceipt);

  if (!viaPetros?.transactionCode || !viaReceipt?.transactionCode) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
