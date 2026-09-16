CREATE TABLE IF NOT EXISTS "user_payment_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
  "method" varchar(20) NOT NULL,
  "account_name" text NOT NULL,
  "account_number" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_payment_accounts_user_method_idx"
  ON "user_payment_accounts" ("user_id", "method");
CREATE INDEX IF NOT EXISTS "user_payment_accounts_user_id_idx"
  ON "user_payment_accounts" ("user_id");
