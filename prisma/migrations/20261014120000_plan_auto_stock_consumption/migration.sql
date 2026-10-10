-- Automatic stock consumption becomes a plan feature. Every existing plan keeps it, so no restaurant
-- loses what it already has; the platform console switches it off per plan from here.
UPDATE "plans" SET "features" = "features" || '{"autoStockConsumption": true}'::jsonb
WHERE NOT ("features" ? 'autoStockConsumption');
