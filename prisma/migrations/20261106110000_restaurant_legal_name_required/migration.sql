UPDATE "restaurants" SET "legal_name" = "name" WHERE "legal_name" IS NULL OR btrim("legal_name") = '';

ALTER TABLE "restaurants" ALTER COLUMN "legal_name" SET NOT NULL;
