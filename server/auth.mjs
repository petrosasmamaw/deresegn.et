import dotenv from "dotenv";
import { betterAuth } from "better-auth";
import { toNodeHandler } from "better-auth/node";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./src/config/drizzle.js";
import * as schema from "./src/db/schema.js";

dotenv.config();

const authBaseURL = process.env.BETTER_AUTH_URL || "http://localhost:5000/api/auth";
const clientOrigin = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");

if (!process.env.BETTER_AUTH_SECRET) {
  console.warn("BETTER_AUTH_SECRET is not set. Set it in server/.env");
}

console.log("🔐 Loading Better Auth (drizzle adapter)");

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: authBaseURL,
  trustedOrigins: [clientOrigin, "http://localhost:5173"],
  useSecureCookies: process.env.NODE_ENV === "production",
  defaultCookieAttributes: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
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
});

console.log("✅ Better Auth initialized");

export const nodeHandler = toNodeHandler(auth);
