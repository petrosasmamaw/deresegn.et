import serverless from 'serverless-http'
import { app } from './app.js'

const handler = serverless(app)

export default {
  async fetch(request, env, ctx) {
    // Inject Cloudflare Worker environment variables/secrets into process.env
    if (env && typeof env === 'object') {
      for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'string') {
          process.env[key] = value
        }
      }
    }

    return handler(request, ctx)
  },
}
