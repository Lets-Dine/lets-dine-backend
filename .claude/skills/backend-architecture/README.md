# backend-architecture skill

Portable Claude Code skill that encodes this repo's Clean Architecture conventions (NestJS + Prisma + Zod microservices) so new projects can enforce the same standards.

## Install in another repo (project-scoped)

Copy the whole folder into the target repo:

```bash
cp -r /path/to/holista-backend/.claude/skills/backend-architecture <target-repo>/.claude/skills/
```

Claude Code auto-discovers skills under `.claude/skills/<name>/SKILL.md` — no further registration needed. Commit the folder so teammates get it too.

## Install for yourself, across every project (personal-scoped)

```bash
cp -r /path/to/holista-backend/.claude/skills/backend-architecture ~/.claude/skills/
```

This makes it available in every project you open, regardless of repo.

## Keeping it in sync

This copy lives in `holista-backend` itself (dogfooding — it's active for this repo too). If the architecture or conventions change here, update `SKILL.md`/`templates/` in this repo and re-copy to any other repo that installed it; there's no automatic sync between copies.
