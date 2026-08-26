import dotenv from 'dotenv'
import { app } from './app.js'
import { testConnection, closePool } from './db/index.js'
import { ensureTopUpReceiverDefaults } from './services/topUpAccountService.js'
import { ensureUserPaymentAccountsTable } from './services/userPaymentAccountService.js'
import { ensureApiKeysTable } from './services/apiKeyService.js'
import { ensureRegistrationBonusUniqueIndex } from './services/balanceLedgerService.js'
import { assertRequiredEnv } from './config/requiredEnv.js'
import { startBankConnectivityMonitor } from './services/bankConnectivityProbe.js'
import { logger } from './config/logger.js'

dotenv.config()

const PORT = process.env.PORT || 5000

async function start() {
  if (process.env.NODE_ENV === 'production') {
    assertRequiredEnv()
  }

  const connected = await testConnection()
  if (!connected) {
    console.error('⚠️  Warning: Database connection test failed, but starting server anyway')
  } else {
    try {
      await ensureTopUpReceiverDefaults()
      await ensureApiKeysTable()
      await ensureUserPaymentAccountsTable()
      await ensureRegistrationBonusUniqueIndex()
    } catch (err) {
      console.error('⚠️  Warning: Could not seed top-up receiver accounts:', err.message)
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`)
    console.log(`📡 API available at http://localhost:${PORT}/api`)
    console.log(`📱 Android emulator: http://10.0.2.2:${PORT}/api`)
    if (process.env.NODE_ENV === 'production') {
      startBankConnectivityMonitor()
    }
  })

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use.\n`)
      process.exit(1)
    }
    console.error('Server error:', err)
    process.exit(1)
  })

  setupGracefulShutdown(server)
}

function setupGracefulShutdown(server) {
  let shuttingDown = false
  const shutdown = (signal) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`Received ${signal} — shutting down gracefully`)

    const forceTimer = setTimeout(() => {
      logger.error('Shutdown timed out — forcing exit')
      process.exit(1)
    }, 10000)
    forceTimer.unref?.()

    server.close(async () => {
      await closePool()
      logger.info('Shutdown complete')
      clearTimeout(forceTimer)
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
