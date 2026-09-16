CREATE UNIQUE INDEX IF NOT EXISTS "balance_transactions_registration_bonus_uidx"
ON "balance_transactions" ("user_id")
WHERE "type" = 'registration_bonus';
