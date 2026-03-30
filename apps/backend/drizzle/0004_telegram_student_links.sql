ALTER TABLE "users" ADD COLUMN "telegram_id" text;
CREATE UNIQUE INDEX "users_telegram_id_uq" ON "users" USING btree ("telegram_id");
