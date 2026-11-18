-- A diner now picks delivery or pick-up when placing the order, so the visit itself no longer carries it.
ALTER TABLE "dining_sessions" DROP COLUMN "pickup";
