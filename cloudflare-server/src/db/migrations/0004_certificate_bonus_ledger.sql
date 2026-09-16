ALTER TABLE "receipt_checks" ADD COLUMN IF NOT EXISTS "share_token" varchar(64);
ALTER TABLE "receipt_checks" ADD COLUMN IF NOT EXISTS "confidence_tier" varchar(20) DEFAULT 'verified';
ALTER TABLE "receipt_checks" ADD COLUMN IF NOT EXISTS "verify_mode" varchar(20);
ALTER TABLE "receipt_checks" ADD COLUMN IF NOT EXISTS "is_recheck" boolean DEFAULT false NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "receipt_checks_share_token_unique" ON "receipt_checks" ("share_token");

CREATE TABLE IF NOT EXISTS "balance_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "type" varchar(30) NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "balance_after" numeric(10, 2) NOT NULL,
  "reference_type" varchar(30),
  "reference_id" integer,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "balance_transactions_user_id_idx" ON "balance_transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "balance_transactions_type_idx" ON "balance_transactions" ("type");

CREATE TABLE IF NOT EXISTS "system_settings" (
  "key" varchar(50) PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

INSERT INTO "system_settings" ("key", "value", "updated_at")
VALUES ('registration_bonus_amount', '20', now())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "system_settings" ("key", "value", "updated_at")
VALUES ('registration_bonus_enabled', 'true', now())
ON CONFLICT ("key") DO NOTHING;
