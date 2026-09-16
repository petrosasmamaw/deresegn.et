-- Update balances table to support decimal Birr amounts instead of integer units
ALTER TABLE "balances" ALTER COLUMN "amount" SET DATA TYPE numeric(10, 2) USING amount::numeric(10, 2);
ALTER TABLE "balances" ALTER COLUMN "amount" SET DEFAULT '0'::numeric;
