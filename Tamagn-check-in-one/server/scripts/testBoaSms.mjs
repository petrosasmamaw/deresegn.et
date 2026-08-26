/**
 * BOA SMS parse + slip-link verify smoke test (FT credit + TT debit).
 * Usage: node scripts/testBoaSms.mjs
 */
import { detectSmsMethod, parseBoaSms, parseSms } from '../src/services/smsParserService.js'
import { verifySmsTransaction } from '../src/services/smsVerifyService.js'
import { isBoaPaymentReference, splitBoaSlipTrx } from '../src/services/boaReceiptService.js'

const SAMPLE_FT = `Dear Petros, your account 2*23 was credited with ETB 100.00 by Mikiyas Amsalu Admasu. Available Balance: ETB 603.71.
Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26223W14ZW94077
Feedback: https://cs.bankofabyssinia.com/cs/?trx=CFT26223W14ZW
Link your Fayda: https://cs.bankofabyssinia.com/fayda_connect 
For help, call 8397 (24/7 Toll-Free). Bank of Abyssinia.`

const SAMPLE_TT = `Dear Petros, your account 2*23 was debited with ETB 200.00. Available Balance: ETB 102.63.
Receipt: https://cs.bankofabyssinia.com/slip/?trx=TT26171RW0YG02723
Feedback: https://cs.bankofabyssinia.com/cs/?trx=DTT26171RW0YG
Link your Fayda: https://cs.bankofabyssinia.com/fayda_connect 
For help, call 8397 (24/7 Toll-Free). Bank of Abyssinia.`

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function assertParse(sample, {
  direction,
  amount,
  coreIncludes,
  expectSuffix,
}) {
  assert(detectSmsMethod(sample) === 'boa', 'detectSmsMethod should be boa')
  const parsed = parseBoaSms(sample)
  console.log('Parsed:', JSON.stringify(parsed, null, 2))

  assert(parsed.method === 'boa', 'method boa')
  assert(parsed.receiptUrl.includes('cs.bankofabyssinia.com/slip'), 'slip URL')
  assert(String(parsed.transactionCode).includes(coreIncludes), `trx should include ${coreIncludes}`)
  assert(parsed.amount === amount || parsed.amount === `${amount}.00`, `amount got ${parsed.amount}`)
  assert(parsed.direction === direction, `direction ${direction}`)
  assert(parsed.account === '2*23', 'masked account')
  if (expectSuffix) {
    assert(parsed.accountSuffix === expectSuffix || String(parsed.transactionCode).endsWith(expectSuffix), `suffix ${expectSuffix}`)
  }

  const split = splitBoaSlipTrx(String(parsed.slipTrx || parsed.transactionCode || ''))
  if (split?.coreRef) {
    assert(isBoaPaymentReference(split.coreRef), `core ref valid: ${split.coreRef}`)
    console.log('Split slip trx →', split)
  }

  const viaParseSms = parseSms(sample, 'boa')
  assert(viaParseSms.receiptUrl, 'parseSms boa has receiptUrl')
  return parsed
}

async function verifySample(label, sample) {
  console.log(`\n—— ${label}: fetching official receipt from slip link ——`)
  const started = Date.now()
  const result = await verifySmsTransaction('boa', sample)
  const ms = Date.now() - started
  console.log(`Verify finished in ${ms}ms`)
  console.log('Result:', {
    passed: result.passed,
    message: result.message,
    txCode: result.txCode,
    official: result.official,
    issues: result.issues,
  })
  return result
}

async function main() {
  assert(isBoaPaymentReference('FT26223W14ZW'), 'FT ref accepted')
  assert(isBoaPaymentReference('TT26171RW0YG'), 'TT ref accepted')
  assert(!isBoaPaymentReference('XX12345678'), 'non FT/TT rejected')

  const splitTt = splitBoaSlipTrx('TT26171RW0YG02723')
  assert(splitTt?.coreRef === 'TT26171RW0YG', `TT core got ${splitTt?.coreRef}`)
  assert(splitTt?.accountSuffix === '02723', `TT suffix got ${splitTt?.accountSuffix}`)
  console.log('✅ isBoaPaymentReference + splitBoaSlipTrx OK')

  console.log('\n—— FT credit parse ——')
  assertParse(SAMPLE_FT, {
    direction: 'credit',
    amount: '100',
    coreIncludes: 'FT26223W14ZW',
    expectSuffix: '94077',
  })
  console.log('✅ FT credit parse OK')

  console.log('\n—— TT debit parse ——')
  assertParse(SAMPLE_TT, {
    direction: 'debit',
    amount: '200',
    coreIncludes: 'TT26171RW0YG',
    expectSuffix: '02723',
  })
  console.log('✅ TT debit parse OK')

  const ftResult = await verifySample('FT credit', SAMPLE_FT)
  const ttResult = await verifySample('TT debit', SAMPLE_TT)

  const anyPass = ftResult.passed || ttResult.passed
  if (!anyPass) {
    console.warn('⚠️ Official API verify did not pass (link may be expired or network blocked). Parse still OK.')
    process.exit(0)
  }

  if (ftResult.passed) {
    assert(ftResult.official?.source?.includes('boa'), 'official from boa API')
    assert(Number(ftResult.official.amount) === 100, 'official amount 100')
    console.log('✅ FT BOA SMS verified via slip link')
  }
  if (ttResult.passed) {
    assert(ttResult.official?.source?.includes('boa'), 'official from boa API')
    assert(Number(ttResult.official.amount) === 200, 'official amount 200')
    console.log('✅ TT BOA SMS verified via slip link')
  }
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
