import dotenv from "dotenv";
import { betterAuth } from "better-auth";
import { toNodeHandler } from "better-auth/node";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./src/config/drizzle.js";
import * as schema from "./src/db/schema.js";
import { ensureRegistrationBonus } from "./src/services/balanceLedgerService.js";
import { getTrustedOrigins } from "./src/config/clientOrigins.js";
import { validateAuthEnv } from "./src/config/validateAuthEnv.js";
import { resolveAuthBaseUrl, getAuthCookieAttributes } from "./src/config/authBaseUrl.js";
import { sendPasswordResetEmail } from "./src/services/emailService.js";
import { validateEmailForRegistration } from "./src/utils/emailValidator.js";
import { APIError } from "better-auth/api";

dotenv.config();
validateAuthEnv();

/**
 * Build the link the user clicks to choose a new password. Prefer the caller's
 * `redirectTo` (embedded by Better Auth in `url` as `callbackURL`) so web and
 * mobile land on the right reset page; fall back to env / CLIENT_URL.
 */
function buildPasswordResetUrl(url, token) {
  const fallbackBase =
    process.env.PASSWORD_RESET_URL ||
    `${(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "")}/reset-password`;
  try {
    const parsed = new URL(url);
    const cb = parsed.searchParams.get("callbackURL");
    const base = cb || fallbackBase;
    const target = new URL(base);
    target.searchParams.set("token", token);
    return target.toString();
  } catch {
    const sep = fallbackBase.includes("?") ? "&" : "?";
    return `${fallbackBase}${sep}token=${encodeURIComponent(token)}`;
  }
}

const authBaseURL = resolveAuthBaseUrl();
const isProduction = process.env.NODE_ENV === "production";
const cookieAttributes = getAuthCookieAttributes(isProduction);

if (!process.env.BETTER_AUTH_SECRET) {
  console.warn("BETTER_AUTH_SECRET is not set. Set it in server/.env");
}

console.log("🔐 Loading Better Auth (drizzle adapter)");
console.log(`   baseURL: ${authBaseURL}`);
console.log(`   cookie sameSite: ${cookieAttributes.sameSite}${cookieAttributes.partitioned ? " (partitioned)" : ""}`);

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: authBaseURL,
  trustedOrigins: getTrustedOrigins(),
  useSecureCookies: isProduction,
  rateLimit: {
    enabled: true,
    window: 60,
    max: 40,
    storage: "memory",
  },
  advanced: {
    defaultCookieAttributes: cookieAttributes,
  },
  defaultCookieAttributes: cookieAttributes,
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
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url, token }) => {
      const resetUrl = buildPasswordResetUrl(url, token);
      const result = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
      // Do not throw on delivery failure: the endpoint returns a generic
      // success either way (prevents email enumeration). Failures are logged
      // inside emailService so setup/config issues are visible in server logs.
      if (!result.ok) {
        console.error(
          `[auth] Password reset email not delivered to ${user.email}: ${result.error || "unknown error"}`,
        );
      }
    },
    onPasswordReset: async ({ user }) => {
      console.log(`🔑 Password reset completed for user=${user.id}`);
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (user?.email) {
            const validation = await validateEmailForRegistration(user.email);
            if (!validation.valid) {
              throw new APIError("BAD_REQUEST", {
                message: validation.message,
              });
            }
          }
          return { data: user };
        },
        after: async (user) => {
          try {
            const result = await ensureRegistrationBonus(user.id);
            if (result.granted) {
              console.log(`Registration bonus granted: user=${user.id} amount=${result.amount}`);
            }
          } catch (err) {
            console.error("Registration bonus failed for new user:", user.id, err.message);
          }
        },
      },
    },
  },
});

console.log("✅ Better Auth initialized");

export const nodeHandler = toNodeHandler(auth);
