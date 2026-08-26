/**
 * Registration bonus smoke test (local / staging DB).
 * Usage: node scripts/testRegistrationBonus.mjs
 */
import dotenv from 'dotenv'
import crypto from 'crypto'
import { auth } from '../auth.mjs'
import { getUserBalance } from '../src/services/checkService.js'
import {
  ensureRegistrationBonus,
  getRegistrationBonusSettings,
  setSetting,
  hasRegistrationBonus,
} from '../src/services/balanceLedgerService.js'
import { getUserByEmail } from '../src/services/userService.js'

dotenv.config()

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function signupTestUser() {
  const email = `bonus_test_${Date.now()}_${crypto.randomBytes(3).toString('hex')}@example.com`
  const password = 'TestPass123!'
  const name = 'Bonus Test User'

  const result = await auth.api.signUpEmail({
    body: { email, password, name },
  })
  if (result?.error) {
    throw new Error(`Sign-up failed: ${result.error.message}`)
  }

  const user = await getUserByEmail(email)
  assert(user?.id, 'User not found after sign-up')
  return user
}

async function testEnabledBonus() {
  await setSetting('registration_bonus_enabled', 'true')
  await setSetting('registration_bonus_amount', '20')

  const user = await signupTestUser()
  const balance = await getUserBalance(user.id)
  const hasBonus = await hasRegistrationBonus(user.id)

  assert(hasBonus, 'Ledger should record registration_bonus')
  assert(balance === 20, `Expected balance 20, got ${balance}`)
  console.log('✅ Enabled + amount 20 → balance 20')
}

async function testDisabledBonus() {
  await setSetting('registration_bonus_enabled', 'false')
  await setSetting('registration_bonus_amount', '20')

  const user = await signupTestUser()
  const balance = await getUserBalance(user.id)
  const hasBonus = await hasRegistrationBonus(user.id)

  assert(!hasBonus, 'No bonus ledger when disabled')
  assert(balance === 0, `Expected balance 0 when disabled, got ${balance}`)
  console.log('✅ Disabled → balance 0')
}

async function testCustomAmount() {
  await setSetting('registration_bonus_enabled', 'true')
  await setSetting('registration_bonus_amount', '30')

  const user = await signupTestUser()
  const balance = await getUserBalance(user.id)

  assert(balance === 30, `Expected balance 30, got ${balance}`)
  console.log('✅ Enabled + amount 30 → balance 30')
}

async function main() {
  const settings = await getRegistrationBonusSettings()
  console.log('Starting registration bonus tests. Current settings:', settings)

  await testEnabledBonus()
  await testDisabledBonus()
  await testCustomAmount()

  // Restore defaults
  await setSetting('registration_bonus_enabled', 'true')
  await setSetting('registration_bonus_amount', '20')
  console.log('✅ All registration bonus tests passed')
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
