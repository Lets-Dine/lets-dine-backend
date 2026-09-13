# Project bootstrap templates

Two full skeletons, mirroring holista-backend's own root/tooling conventions, for starting a brand-new backend project. **Never pick one for the user — always ask monolith vs. microservices monorepo first** (see `SKILL.md`, "Bootstrapping a brand-new project").

## Placeholders

| Placeholder | Meaning | Example |
|---|---|---|
| `{project-name}` | root package name / repo name | `claims-portal` |
| `{scope}` | npm workspace scope used by shared packages (microservice only) | `@claims-portal` |
| `{service-name}` | folder + package name of the first service (microservice only) | `core-api` |

## monolith/

Copy the entire contents of `monolith/` into the new project's root, renaming `biome.json.template` to `biome.json`. Single `package.json`, single NestJS app under `src/`, Prisma + Postgres (+ optional Redis) via `compose.yml`. No Turborepo, no cross-service pub/sub — see `monolith/SHARED_KERNEL.md` for the shared exception/response code to create next.

Prisma models go one-per-file under `prisma/models/` (delete `prisma/models/README.md` once the first model file exists) — `schema.prisma` itself only ever holds `generator`/`datasource`. `compose.yml` also runs the app itself (service `app`), built from `Dockerfile.local`, with the repo bind-mounted for live reload; see the SKILL.md "Running the app in Docker" section for the debug/watch details.

## microservice/

Mirrors holista-backend's own top-level layout:

- `root/*` → copy into the new project's root (package.json, turbo.json, compose.yml, Dockerfile.local, .dockerignore, .env.example). Rename `biome.json.template` to `biome.json`.
- `packages/core/*` → the shared `{scope}/core` package (exceptions, utils, interfaces — grows over time).
- `packages/database/*` → the shared `{scope}/db` package wrapping Prisma. Models go one-per-file under `packages/database/prisma/models/` (delete that folder's `README.md` once the first model file exists) — `schema.prisma` only ever holds `generator`/`datasource`.
- `apps/{service-name}/*` → the first service; rename the `{service-name}` folder to whatever the user picked. `compose.yml`'s `{service-name}` service block builds and runs this app in Docker (bind-mounted for live reload) — duplicate that block per additional service, per its own comment.

See `microservice/SHARED_KERNEL.md` for the shared exception/response/pub-sub code to create in `packages/core` before scaffolding the first feature.
