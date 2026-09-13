# Prisma models

One file per model, named after the table (kebab-case, e.g. `agent-reviews.prisma` for `model AgentReview` / `@@map("agent_reviews")`). An enum used by only one model lives in that model's file; a shared enum gets its own file.

Every model **and every enum** must include `@@schema("{service-name}")` (or whichever service/bounded context owns it) — never leave one on the default `public` schema. Add the schema name to `schema.prisma`'s `datasource.schemas` array before using it (see the SKILL.md Database section).

Delete this README once the first real model file is added.
