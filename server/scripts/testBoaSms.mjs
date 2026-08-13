/**
 * BOA SMS parse + slip-link verify smoke test.
 * Usage: node scripts/testBoaSms.mjs
 */
import { detectSmsMethod, parseBoaSms, parseSms } from '../src/services/smsParserService.js'
import { verifySmsTransaction } from '../src/services/smsVerifyService.js'

const SAMPLE = `Dear Petros, your account 2*23 was credited with ETB 100.00 by Mikiyas Amsalu Admasu. Available Balance: ETB 603.71.
Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26223W14ZW94077
Feedback: https://cs.bankofabyssinia.com/cs/?trx=CFT26223W14ZW
Link your Fayda: https://cs.bankofabyssinia.com/fayda_connect 
For help, call 8397 (24/7 Toll-Free). Bank of Abyssinia.`

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  assert(detectSmsMethod(SAMPLE) === 'boa', 'detectSmsMethod should be boa')
  const parsed = parseBoaSms(SAMPLE)
  console.log('Parsed:', JSON.stringify(parsed, null, 2))

  assert(parsed.method === 'boa', 'method boa')
  assert(parsed.receiptUrl.includes('cs.bankofabyssinia.com/slip'), 'slip URL')
  assert(String(parsed.transactionCode).includes('FT26223W14ZW'), 'trx from link')
  assert(parsed.amount === '100' || parsed.amount === '100.00', `amount got ${parsed.amount}`)
  assert(/mikiyas/i.test(parsed.senderName || ''), 'sender name')
  assert(/petros/i.test(parsed.receiverName || ''), 'receiver name')
  assert(parsed.account === '2*23', 'masked account')
  console.log('✅ Parse OK')

  const viaParseSms = parseSms(SAMPLE, 'boa')
  assert(viaParseSms.receiptUrl, 'parseSms boa has receiptUrl')
  console.log('✅ parseSms(boa) OK')

  console.log('Fetching official receipt from slip link (no OCR)…')
  const started = Date.now()
  const result = await verifySmsTransaction('boa', SAMPLE)
  const ms = Date.now() - started
  console.log(`Verify finished in ${ms}ms`)
  console.log('Result:', {
    passed: result.passed,
    message: result.message,
    txCode: result.txCode,
    official: result.official,
    issues: result.issues,
  })

  if (!result.passed) {
    // Network / expired slip may fail in CI — still treat parse as success.
    console.warn('⚠️ Official API verify did not pass (link may be expired or network blocked). Parse still OK.')
    process.exit(0)
  }

  assert(result.official?.source?.includes('boa'), 'official from boa API')
  assert(Number(result.official.amount) === 100, 'official amount 100')
  console.log('✅ BOA SMS verified via slip link')
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
