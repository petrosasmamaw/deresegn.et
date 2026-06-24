import dotenv from "dotenv";
import { betterAuth } from "better-auth";
import { toNodeHandler } from "better-auth/node";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./src/config/drizzle.js";
import * as schema from "./src/db/schema.js";
import { ensureRegistrationBonus } from "./src/services/balanceLedgerService.js";
import { getTrustedOrigins } from "./src/config/clientOrigins.js";
import { validateAuthEnv } from "./src/config/validateAuthEnv.js";
import { resolveAuthBaseUrl, usesVercelProxyAuth } from "./src/config/authBaseUrl.js";

dotenv.config();
validateAuthEnv();

const authBaseURL = resolveAuthBaseUrl();
const isProduction = process.env.NODE_ENV === "production";
const cookieSameSite = isProduction && !usesVercelProxyAuth() ? "none" : "lax";

if (!process.env.BETTER_AUTH_SECRET) {
  console.warn("BETTER_AUTH_SECRET is not set. Set it in server/.env");
}

console.log("🔐 Loading Better Auth (drizzle adapter)");

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: authBaseURL,
  trustedOrigins: getTrustedOrigins(),
  useSecureCookies: isProduction,
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction,
      sameSite: cookieSameSite,
    },
  },
  defaultCookieAttributes: {
    httpOnly: true,
    secure: isProduction,
    sameSite: cookieSameSite,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "client",
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    requireEmailVerification: false,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Defer until after Better Auth commits the new user row.
          setImmediate(async () => {
            try {
              await ensureRegistrationBonus(user.id);
            } catch (err) {
              console.error("Registration bonus failed for new user:", user.id, err.message);
            }
          });
        },
      },
    },
  },
});

console.log("✅ Better Auth initialized");

export const nodeHandler = toNodeHandler(auth);
