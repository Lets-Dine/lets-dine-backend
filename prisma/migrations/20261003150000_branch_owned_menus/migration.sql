-- Each branch now owns its menu: categories, dishes and add-ons belong to one branch (variants and
-- dish↔add-on links follow their dish). The shared-catalog override table is no longer needed.

ALTER TABLE "menu_categories" ADD COLUMN "branch_id" UUID;
ALTER TABLE "dishes" ADD COLUMN "branch_id" UUID;
ALTER TABLE "add_ons" ADD COLUMN "branch_id" UUID;

-- The menu that exists today becomes the default branch's menu. Where that branch had overridden a
-- dish's price or switched it off, the override is folded into the dish so nothing a diner saw changes.
UPDATE "dishes" d
SET "price" = COALESCE(bd."price_override", d."price"),
    "is_available" = d."is_available" AND bd."is_available"
FROM "branch_dishes" bd
JOIN "branches" b ON b."id" = bd."branch_id" AND b."is_default"
WHERE bd."dish_id" = d."id";

UPDATE "menu_categories" t SET "branch_id" = b."id" FROM "branches" b WHERE b."restaurant_id" = t."restaurant_id" AND b."is_default";
UPDATE "dishes" t SET "branch_id" = b."id" FROM "branches" b WHERE b."restaurant_id" = t."restaurant_id" AND b."is_default";
UPDATE "add_ons" t SET "branch_id" = b."id" FROM "branches" b WHERE b."restaurant_id" = t."restaurant_id" AND b."is_default";

ALTER TABLE "menu_categories" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "dishes" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "add_ons" ALTER COLUMN "branch_id" SET NOT NULL;

-- Names and slugs are unique within a branch's menu, not across the restaurant.
DROP INDEX "dishes_restaurant_id_slug_key";
DROP INDEX "menu_categories_restaurant_id_name_key";
CREATE UNIQUE INDEX "dishes_branch_id_slug_key" ON "dishes"("branch_id", "slug");
CREATE UNIQUE INDEX "menu_categories_branch_id_name_key" ON "menu_categories"("branch_id", "name");
CREATE INDEX "dishes_branch_id_category_id_idx" ON "dishes"("branch_id", "category_id");
CREATE INDEX "menu_categories_branch_id_idx" ON "menu_categories"("branch_id");
CREATE INDEX "add_ons_branch_id_idx" ON "add_ons"("branch_id");

ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "add_ons" ADD CONSTRAINT "add_ons_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "branch_dishes";
