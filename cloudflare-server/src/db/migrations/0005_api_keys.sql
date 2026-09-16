CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "name" text DEFAULT 'API Key' NOT NULL,
  "key_prefix" varchar(16) NOT NULL,
  "key_hash" text NOT NULL,
  "key_encrypted" text,
  "package_price" numeric(10, 2) NOT NULL,
  "capacity_amount" numeric(12, 2) NOT NULL,
  "used_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "last_used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);

CREATE INDEX IF NOT EXISTS "api_keys_user_id_idx" ON "api_keys" ("user_id");
CREATE INDEX IF NOT EXISTS "api_keys_status_idx" ON "api_keys" ("status");
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" ("key_hash");
