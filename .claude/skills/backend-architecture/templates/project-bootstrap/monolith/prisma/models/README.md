# Prisma models

One file per model, named after the table (kebab-case, e.g. `agent-reviews.prisma` for `model AgentReview` / `@@map("agent_reviews")`). An enum used by only one model lives in that model's file; a shared enum gets its own file.

Every model **and every enum** must include `@@schema("{project-name}")` — never leave one on the default `public` schema (see `schema.prisma`'s `datasource` block and the SKILL.md Database section).

Delete this README once the first real model file is added.
