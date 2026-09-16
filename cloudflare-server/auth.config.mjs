import dotenv from 'dotenv'
import drizzle from './src/config/drizzle.js'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth/minimal'

dotenv.config()

const adapter = drizzleAdapter(drizzle, { provider: 'pg' })

const auth = betterAuth({
  database: adapter,
  plugins: [],
  rateLimit: { storage: 'database' }
})

export default auth
