import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'path'
import { pathToFileURL } from 'url'
import balanceRoutes from './routes/balanceRoutes.js'
import checkRoutes from './routes/checkRoutes.js'
import appAuthRoutes from './routes/appAuthRoutes.js'
import errorHandler from './middleware/errorHandler.js'
import { testConnection } from './db/index.js'

dotenv.config()

const app = express()

// CORS configuration for better-auth
const clientOrigin = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');

app.use(cors({
  origin: [clientOrigin, 'http://localhost:5173'],
  credentials: true,
}))

app.use(express.json())
app.use(cookieParser())

// Mount Better Auth handler (dynamic import)
async function mountAuthHandler() {
  try {
    const authModuleUrl = pathToFileURL(path.join(process.cwd(), './auth.mjs')).href
    const mod = await import(authModuleUrl)

    app.get('/api/auth/get-session', async (req, res) => {
      try {
        const session = await mod.auth.api.getSession({
          headers: new Headers(req.headers),
        })
        res.json(session || null)
      } catch (error) {
        res.status(500).json({ error: 'Failed to get session' })
      }
    })

    if (mod?.nodeHandler) {
      app.use('/api/auth', mod.nodeHandler)
      console.log('✅ Mounted Better Auth handler at /api/auth')
    }
  } catch (err) {
    console.error('❌ Failed to mount auth handler', err)
  }
}

mountAuthHandler()

// Mount API routes
app.use('/api/balance', balanceRoutes)
app.use('/api/check', checkRoutes)
app.use('/api/users', appAuthRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// Error handler must be last
app.use(errorHandler)

const PORT = process.env.PORT || 5000

// Test DB connection and start server
async function start() {
  const connected = await testConnection()
  if (!connected) {
    console.error('⚠️  Warning: Database connection test failed, but starting server anyway')
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`)
    console.log(`📡 API available at http://localhost:${PORT}/api`)
  })
}

start().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
