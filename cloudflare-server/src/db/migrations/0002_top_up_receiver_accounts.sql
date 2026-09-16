CREATE TABLE IF NOT EXISTS "top_up_receiver_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "method" varchar(20) NOT NULL UNIQUE,
  "receiver_name" text NOT NULL,
  "receiver_account" text NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

INSERT INTO "top_up_receiver_accounts" ("method", "receiver_name", "receiver_account")
VALUES
  ('telebirr', 'seifeslaisie asmamaw', '0989886956'),
  ('cbe', 'petiros asmamaw abebe', '1000333687112')
ON CONFLICT ("method") DO NOTHING;
