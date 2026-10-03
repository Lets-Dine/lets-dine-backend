-- Existing non-owner members predate branches and have no assignment, which would lock them out
-- at sign-in. Pin each to their restaurant's default branch. OWNERs reach every branch and need no rows.
INSERT INTO "branch_members" ("id", "member_id", "branch_id", "created_at")
SELECT gen_random_uuid(), m."id", b."id", now()
FROM "restaurant_members" m
JOIN "branches" b ON b."restaurant_id" = m."restaurant_id" AND b."is_default"
WHERE m."role" <> 'OWNER'
ON CONFLICT ("member_id", "branch_id") DO NOTHING;
