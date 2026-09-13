---
name: backend-architecture
description: Enforces Holista's NestJS Clean Architecture conventions when writing backend code — module layout (application/domain/infrastructure/interfaces), naming (kebab-case files, Dto/Impl/I-prefix suffixes), dependency flow (Controller → Use Case → Service → Repository → Prisma), Zod validation + DTO pattern, module registration, error handling, and buildHttpResponse API responses. Works for both a microservices monorepo (holista-backend style, apps/<service>/src/app/modules/) and a single-service monolith (src/modules/) — detects which shape the target repo is and adjusts module paths, shared-code imports, and cross-module event wiring accordingly. Use whenever creating or modifying a module, feature, use case, controller, DTO, repository, service, or entity in a NestJS + Prisma + Zod backend. Always scaffold new features from this skill's templates instead of improvising file layout or naming.
---

# Backend Architecture Skill

Enforces the Clean Architecture conventions used across Holista's NestJS microservices monorepo. Apply this whenever you add or touch backend code — a new feature, a fix inside an existing use case, a new endpoint — so the result is indistinguishable from code already in the repo.

## Stack assumptions

NestJS, Node.js >=22, TypeScript, PostgreSQL via Prisma, Zod validation (`nestjs-zod`), Biome for lint/format. The Clean Architecture layering and naming rules below apply identically whether the target project is a microservices monorepo (like holista-backend) or a single-service monolith — only the module's root path, the shared-code import, and the cross-module communication mechanism differ. Detect which shape you're in before scaffolding.

## Detect the project shape first

| Signal | Shape | Module root | Shared code import |
|---|---|---|---|
| `turbo.json` + `apps/*` + `packages/*` (workspaces) | Microservice monorepo | `apps/{app-name}/src/app/modules/{feature-name}/` | Workspace package, e.g. `@holista/core/*` — grep `package.json` `dependencies`/`workspaces` for the actual name |
| Single `package.json` at root, `nest-cli.json`, no `apps/` dir | Monolith | `src/modules/{feature-name}/` (or wherever existing modules already live — check first) | Local folder, e.g. `src/common/*` or `src/shared/*` — grep the repo for where `exceptions`/`decorators`/`utils` currently live rather than assuming |

Never guess the shared-code import path — `grep`/`Explore` the target repo for an existing `NotFoundException` or similar to find the real path, then reuse it. The `@holista/core/*` paths in this skill's examples and templates are the holista-backend convention; substitute the equivalent for whatever repo you're in.

## Module layout

Every feature lives under a module folder (root path per the table above) with exactly this shape:

```
module-name/
├── application/
│   ├── dto/                  # DTOs extending createZodDto
│   ├── use-cases/            # One class per use case; business logic orchestration
│   │   └── __tests__/        # Unit tests (*.test.ts, not *.spec.ts)
│   └── *.service.ts          # Reusable service operations (optional)
├── domain/
│   ├── constants/             # Error/success message constants
│   ├── entity/                 # Domain entities (business rules live here, not in use cases)
│   ├── interfaces/
│   ├── repositories/          # Abstract repository classes (no prefix, e.g. FeatureRepository)
│   └── utils/
├── infrastructure/
│   └── repositories/          # Prisma implementations (Impl suffix, e.g. FeatureRepositoryImpl)
├── interfaces/
│   └── http/
│       ├── *.controller.ts
│       └── validations/       # Zod schemas
└── module-name.module.ts
```

## Dependency flow — never break this

```
Controller → Use Case → Service(s) → Repository → Prisma
```

- **Controllers** are HTTP-only and thin: parse `@Body`/`@Param`/`@Query`, call exactly one use case, wrap the result in `buildHttpResponse`. No business logic.
- **Use Cases** orchestrate one or more services/repositories and hold business rules. One class per use case, always with a single public `execute(...)` method.
- **Services** are reusable building blocks shared by multiple use cases. Services never call use cases.
- **Repositories** are abstract classes in `domain/repositories/`; the Prisma-backed implementation lives in `infrastructure/repositories/`. Use cases depend on the abstract class, never the impl.
- Services are optional — simple use cases may call the repository directly.
- Do not import DTO classes/types into the repository layer — define separate interfaces in `domain/repositories/*.ts` (see `IFeatureCreate`, `FeatureFetchOptions` pattern below).

## Naming

| Type | Convention | Example |
|---|---|---|
| Files | kebab-case | `create-feature.usecase.ts` |
| Classes | PascalCase | `CreateFeatureUsecase` |
| Interfaces | `I` prefix | `IFeature` |
| Abstract repos | No prefix | `FeatureRepository` |
| Repo impls | `Impl` suffix | `FeatureRepositoryImpl` |
| DTOs | `Dto` suffix | `CreateFeatureDto` |
| Zod schemas | camelCase + `Schema` | `createFeatureSchema` |
| Constants | SCREAMING_SNAKE | `FEATURE_ERROR_MESSAGES` |
| Events | dot.notation | `feature.created` |

### Exports
- Use Cases and Repository Implementations: `export default`
- Services, Controllers, DTOs, abstract Repositories: named exports

## Validation + DTO pattern

Zod schema in `interfaces/http/validations/`, DTO class in `application/dto/` wraps it with `createZodDto`:

```typescript
// interfaces/http/validations/create-feature.validation.ts
export const createFeatureSchema = z.object({ name: z.string().min(1) });

// application/dto/create-feature.dto.ts
export class CreateFeatureDto extends createZodDto(createFeatureSchema) {}
```

## Error handling

- Define error constants as `{ key, message }` objects grouped by concern in `domain/constants/messages/error-message.ts`, e.g. `FEATURE_ERROR_MESSAGES.NOT_FOUND = { key: "FEATURE_NOT_FOUND", message: "Feature not found" }`.
- Throw exceptions from `@holista/core/exceptions` (`NotFoundException`, `ConflictException`, `BadRequestException`, `ForbiddenException`), passing the constant directly: `throw new NotFoundException(FEATURE_ERROR_MESSAGES.NOT_FOUND)`.
- Never throw raw `Error` or return `null`/`undefined` to signal a business failure — throw the typed exception.

## API responses

Every controller method returns `buildHttpResponse(data, { key, message })`, producing `{ data, message, success: true }`. Success messages live in `domain/constants/messages/success-message.ts`, mirroring the error-message shape.

## Pagination

Every list endpoint uses one shared convention from `@holista/core` — never invent a different envelope (`items`/`total`/`page`, etc.).

- **Query schema** — spread `paginationSchema` (`@holista/core/dto`) into the fetch validation schema:
  ```typescript
  export const fetchFeatureSchema = z.object({
    ...paginationSchema,
    keyword: z.string().optional(),
  });
  ```
  This adds `offset`, `limit`, `sortBy`, `sortOrder` (all optional — no pagination is applied if `limit` is omitted/zero), plus `returnData`/`returnCount` (booleans, default `true`).
- **Repository** — turn the query into a Prisma clause with `buildPaginationQuery<T>()` (`@holista/core/helpers`), which returns `{ skip, take, orderBy }`. Run `findMany` and `count` in `Promise.all` and return a `PaginatedResponse<T>` — **`{ rows: T[], count: number }`**, never `{ data, total, limit, offset }`:
  ```typescript
  async findAll(query: FetchFeatureQuery): Promise<PaginatedResponse<IFeature>> {
    const paginationQuery = buildPaginationQuery<keyof IFeature>(query);
    const [data, count] = await Promise.all([
      this.prisma.features.findMany({ where, ...paginationQuery }),
      this.prisma.features.count({ where }),
    ]);
    return { rows: data as IFeature[], count: count ?? 0 };
  }
  ```
- **`returnData` / `returnCount`** — let a caller that only needs one side (e.g. an infinite-scroll fetch that already has the total) skip the other query entirely. Guard each branch of the same `Promise.all`, using `-1` as the skipped-count sentinel:
  ```typescript
  const [data, count] = await Promise.all([
    query.returnData ? prisma.features.findMany({ where, ...paginationQuery }) : Promise.resolve([]),
    query.returnCount ? prisma.features.count({ where }) : Promise.resolve(-1),
  ]);
  ```
- **Controller/response** — the use case passes the `PaginatedResponse<T>` straight through to `buildHttpResponse` unchanged, giving `{ data: { rows, count }, message }` on the wire.

## Auth & authorization on endpoints

```typescript
@Post()
@UseGuards(AuthGuard, AbilityGuard)
@CheckPolicies(checkPermissionRules([["add:features"]]))
async createFeature(@Body() dto: CreateFeatureDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IFeature>> {
  const feature = await this.createFeatureUsecase.execute(dto, authEntity);
  return buildHttpResponse(feature, SUCCESS_MESSAGES.FEATURE_CREATED);
}
```

Use `AuthGuard` alone for endpoints that only need an authenticated user; add `AbilityGuard` + `CheckPolicies` when a specific permission is required.

## Transactions & events

- Multi-step writes go through the repository's `$transaction(fn)` method; pass the `tx` through to every repository call inside the callback.
- Publish domain events after the transaction commits — the mechanism depends on project shape:
  - **Microservice**: via the injected pub/sub, e.g. `@Inject("PUB_SUB_SERVICE") private readonly pubsubService: IPubSub`, then `this.pubsubService.publish("feature.created", { ... })`. Needed because other services can only react over the message bus.
  - **Monolith**: everything runs in one process, so prefer calling the dependent service/use case directly — it's simpler and type-checked. Only reach for an event bus (`@nestjs/event-emitter`'s `EventEmitter2.emit("feature.created", {...})`) when multiple, genuinely decoupled listeners need to react without the publisher knowing about them; don't add an event emitter as a default habit carried over from the microservices pattern.

## Module registration

```typescript
@Module({
  controllers: [FeatureController],
  providers: [
    FeatureService,
    CreateFeatureUsecase,
    FeatureRepositoryImpl,
    { provide: FeatureRepository, useExisting: FeatureRepositoryImpl },
  ],
  exports: [FeatureService, { provide: FeatureRepository, useExisting: FeatureRepositoryImpl }],
})
export class FeatureModule {}
```

- **Microservice**: this `FeatureModule` is imported into the specific service's own root module (e.g. `apps/{app-name}/src/app/app.module.ts`) — only the service(s) that own this bounded context.
- **Monolith**: this `FeatureModule` is imported into the single root `AppModule` alongside every other feature module.

## Testing

- Test files: `*.test.ts` (never `.spec.ts`), colocated under `application/use-cases/__tests__/`.
- Mock the abstract repository (`{ provide: FeatureRepository, useValue: {...jest.fn()} }`) and any injected pub/sub token — never hit Prisma in a use-case unit test.
- Structure: `describe(UsecaseName) > describe("execute") > it("should ...")`, with `// Arrange / Act / Assert` comments.
- Cover the happy path and every thrown exception branch.

## Database

- Always include `createdAt`, `updatedAt`, `createdBy`, `updatedBy` on models that support it.
- Singular Prisma model names map to lowercase plural table names.
- **Every scalar field gets an explicit `@map("snake_case")`**, mirroring the
  table-level `@@map` convention already used on every model (e.g. `senderUserId Int?
  @map("sender_user_id")`, `createdAt DateTime @default(now()) @map("created_at")`).
  This is the established, near-universal convention across `packages/database/prisma/models/`
  — apply it to every new scalar field you add. Relation fields (the reverse/forward
  sides of `@relation`) never need `@map` since they aren't real columns. If you ever
  add a field to an existing model and notice a sibling scalar field there without
  `@map`, don't silently retrofit it on your own initiative or leave it inconsistent
  — ask the user whether to add the missing `@map` (cheap: it only renames that one
  column, doesn't require touching `@@map`/the table) before moving on.
- Repository methods accept an optional `transaction?: PrismaClient` (or `{ tx?: PrismaClient }` options object) as the last parameter so callers can compose transactions.
- **One model per file** — never add a `model` block into the root `schema.prisma`. `schema.prisma` holds only the `generator`/`datasource` blocks; every model (and any enum used by only that model) lives in its own file under `prisma/models/` (monolith) or `packages/database/prisma/models/` (microservice), named after the table in kebab-case (e.g. `agent-reviews.prisma`). This works because `package.json` sets `"prisma": { "schema": "./prisma" }`, which tells Prisma to merge every `.prisma` file under that folder — no extra preview feature flag needed on Prisma ^6.7+. When adding a new model, create its file under `prisma/models/` rather than appending to an existing one.
- **Never leave application tables/enums in the `public` Postgres schema** — give the project (monolith) or each bounded context (microservice) its own dedicated schema, mirroring holista-backend's real `datasource` block (`schemas = ["public", "member", "networks", ...]`, one entry per domain). Add `schemas = ["public", "<project-or-domain>"]` to the `datasource` block (`public` stays listed even if unused — Postgres extensions/defaults live there), then add `@@schema("<project-or-domain>")` to every model **and every enum** (enums are schema-scoped in Postgres too). `DATABASE_URL`'s `?schema=` query param should name that dedicated schema, not `public` — update it everywhere it's templated (`.env`, `.env.example`, and any `environment:` override in `compose.yml`).
  - **Migrating an already-scaffolded project onto a dedicated schema** (as opposed to setting this up at bootstrap time, before any migration exists): `prisma migrate dev` will refuse and demand a full destructive reset, because it reads moving every table to a new schema as "drop everything in the old location, create everything in the new one." Don't run that reset if there's real data. Instead hand-write the migration: `CREATE SCHEMA IF NOT EXISTS "<schema>";` followed by `ALTER TABLE "public"."<table>" SET SCHEMA "<schema>";` per table and `ALTER TYPE "public"."<Enum>" SET SCHEMA "<schema>";` per enum — this preserves all rows. Apply it with `prisma db execute --file <path> --schema prisma/schema.prisma`, then record it with `prisma migrate resolve --applied <migration-name>` (this does not execute the SQL, only marks it done).
  - After that, expect Prisma to have created a **second, empty `_prisma_migrations` table inside the new schema** (it tracks migrations in whatever schema `DATABASE_URL`'s `?schema=` now points at) — your pre-existing migration history is still sitting in `public._prisma_migrations`, so `prisma migrate status` will claim old migrations are unapplied even though their tables exist. Fix by consolidating into one table: `INSERT INTO "<schema>"._prisma_migrations SELECT * FROM public._prisma_migrations;` then `DROP TABLE public._prisma_migrations;`. Verify with `prisma migrate status` (should report "up to date") before moving on.
  - Finally, regenerate the Prisma client both on the host (`prisma generate`) and inside the running container (`docker compose exec app npx prisma generate`, then `docker compose restart app`) — the container's `node_modules` volume won't auto-refresh from a schema change alone.
- **Every request and every Prisma query gets logged to the console, toggleable independently.** A `RequestLoggerMiddleware` (in `src/common/middleware/` for a monolith, shared in `packages/core/src/middleware/` for a microservice) logs `METHOD path status - Nms` for every request, wired into each `AppModule.configure()`. `PrismaService` logs every query (`event.query`, params, duration) via Prisma's event-based `log: [{ emit: "event", level: "query" }]` client option and `this.$on("query", ...)`. Both read `process.env` directly at the top of their file (`LOG_HTTP_REQUESTS`, `LOG_PRISMA_QUERIES`), default to on, and are silenced by setting either to `"false"` — no code change needed to toggle. See `SHARED_KERNEL.md` for both files in full.

## Code style

- Biome: 2-space indent, 140 char line width, double quotes, always semicolons, ES5 trailing commas, arrow parens omitted for single params.
- Conventional Commits: `type(scope): description` — scope is the app name (e.g. `feat(iam): add role management`).

## Bootstrapping a brand-new project

Use this when asked to create/init/scaffold a whole new backend project (an empty or near-empty directory), as opposed to adding a feature to a project that already exists — that case is "Scaffolding a new feature" below.

1. **Ask first, always.** Before generating anything, ask the user whether the project should be a **monolith** (single NestJS service) or a **microservices monorepo** (Turborepo, multiple `apps/*` services sharing `packages/*`, holista-backend style). Never infer or default this silently — it determines nearly every file that follows and is expensive to reverse later. Use a direct question (e.g. via `AskUserQuestion`) with monolith and microservices monorepo as the two options.
2. Gather only what else is strictly needed and can't be inferred: the project/package name, and — for a microservices monorepo — the name of the first service to scaffold (e.g. `core-api`).
3. Copy the matching skeleton from `templates/project-bootstrap/monolith/` or `templates/project-bootstrap/microservice/` into the target directory:
   - Monolith: copy the folder's contents directly into the project root, renaming `biome.json.template` to `biome.json`.
   - Microservice: copy `root/*` into the project root (rename `biome.json.template` to `biome.json`), `packages/*` and `apps/{service-name}/*` into their respective folders, renaming `{service-name}` to the chosen service name.
   Replace every `{project-name}` / `{scope}` / `{service-name}` placeholder consistently (see that folder's own notes for any extra placeholders).
4. Follow the folder's `SHARED_KERNEL.md` to create the shared exception classes, `buildHttpResponse` util, `IHttpResponse` interface, `startup-banner` util, and (microservice only) the domain-exception-to-HTTP-status filter and pub/sub service — this is the minimum shared code the rest of this skill's conventions (error handling, API responses, module scaffolding, boot logging) depend on.
5. Run the install and confirm the app boots (`npm install`, then `npm run dev` / `turbo dev`) before treating the bootstrap as done.
6. **First push goes to a `scaffolding` branch, never straight to `main`.** If the repo has no remote yet, that's a separate, explicit step the user drives (adding a remote — e.g. `git remote add origin`, or providing a token — is not something to do unprompted). Once a remote exists: `git checkout -b scaffolding` from the initial commit, then `git push -u origin scaffolding`. `main` only gets the work later, once it's reviewed/merged — never push the initial bootstrap commit(s) directly to `main`.
7. Hand off to "Scaffolding a new feature" below for the first real feature module.

### Bootstrap logging & API docs

Every service's `main.ts` (already wired this way in both templates) does three things after creating the Nest app, in this order: sets a global prefix (`api`), mounts Swagger (`@nestjs/swagger`'s `SwaggerModule`) at `/api/docs` with a lazy `documentFactory`, then — right after `app.listen(port)` — calls the shared `printStartupBanner({ name, port, docsPath, apiPrefix })` util (see `SHARED_KERNEL.md`) to print a bordered terminal banner with the app name, local URL, and docs URL. `APP_NAME` env var overrides the default name. Never skip the banner call or the Swagger mount when scaffolding a new service — with several services' logs interleaved in Docker, the banner is what makes it obvious at a glance that a given service is up and where its docs live.

### Running the app in Docker

Both skeletons' `compose.yml` run the app itself in a container (not just `db`/`redis`/`nats`), built from `Dockerfile.local` and bind-mounting the repo (`./:/app`) so edits on the host are picked up live — mirrors holista-backend's own `compose.yml` + `Dockerfile.local`.

- Each app's `dev` script runs `nest start --debug 0.0.0.0:<port> --watch 'node --inspect-brk'` — auto-restarts on file change, debugger re-attaches on each restart. `dev:once` runs the same debug setup without `--watch`, for a single run that doesn't restart itself (useful when something else drives reloads, or for a stable target while attaching a debugger).
- `compose.yml` picks the script via `command: sh -c "npm run ${DEV_SCRIPT:-dev}"` — set `DEV_SCRIPT=dev:once` in the environment to switch a service to non-watch mode without editing the compose file.
- Attach a debugger (e.g. VS Code) to the published debug port (monolith: `9229`; microservice: one per service, e.g. `9001` for the first — give every new service its own so several can run at once).
- Microservice only: `Dockerfile.local` uses `turbo prune --scope=$APP --docker` so each service's image only builds what that service needs.

### Known pitfalls (already fixed in the templates — don't regress them)

- **`node_modules` bind-mount shadowing.** `volumes: [./:/app]` mounts the host repo over the container's `/app`, which includes the container's own `node_modules` — replacing the Linux/musl-built Prisma engine with the host's (e.g. `darwin-arm64`), causing `PrismaClientInitializationError: ... was generated for "darwin-arm64", but the actual deployment required "linux-musl-arm64-openssl-3.0.x"` at boot. Fix: add an anonymous volume `- /app/node_modules` after the bind mount, so Docker keeps the container's own `node_modules` instead of the host's for that one path. Both `compose.yml` templates already do this — never drop that line when adding or duplicating a service block.
- **A new/updated dependency doesn't show up after `docker compose up --build`.** The anonymous `/app/node_modules` volume from the pitfall above is carried over from the previous container by Compose even when the image is rebuilt — so `npm install <pkg>` on the host, followed by a plain `--build`, still runs against the stale pre-install `node_modules` inside the container. Renew the anonymous volume explicitly: `docker compose up --build --force-recreate -V <service>` (the `-V` / `--renew-anon-volumes` flag is what actually drops the old one).
- **`DATABASE_URL` resolving to `localhost` inside the container.** The root `.env`'s `DB_HOST=localhost` (correct for `npm run dev` on the host, hitting the published port) gets baked into a literal `DATABASE_URL` by Docker Compose's own `${...}` interpolation of `env_file` values — so the containerized app tries to reach Postgres at `localhost`, i.e. itself, and fails with `Can't reach database server`. Fix: give the app service its own `environment: DATABASE_URL: ...@db:5432/...` override pointing at the `db` service's *internal* port (not `${DB_PORT}`, which is only the host-published port) — `compose.yml`'s `environment:` block on the app service takes precedence over `env_file` and doesn't touch the host-oriented `.env`.

Treat the copied dependency versions as a reasonable starting point, not gospel — mirroring holista-backend's majors is a safe default, but if the user cares about being on the latest NestJS/Prisma/Biome, check current versions rather than pinning to what's in the template.

## Scaffolding a new feature

When asked to add a new feature/module (or a new use case inside an existing module):

1. Determine project shape (microservice monorepo vs monolith) per the detection table above, and find the real shared-code import path — don't assume `@holista/core`.
2. Read `templates/README.md` in this skill folder for the placeholder legend (`{Feature}`, `{feature}`, `{feature-name}`, `{FEATURE}`, `{app-name}`).
3. Copy the templates you need from `templates/` into the target module root (per the detection table), renaming files to kebab-case, replacing every placeholder consistently, and swapping any `@holista/core/*` import for the real shared-code path found in step 1.
4. Wire the new use case, controller, and repository binding into the module's `@Module({...})` decorator, and import the module into the correct root (per-service `AppModule` for a microservice, the single root `AppModule` for a monolith) — never leave a use case unregistered.
5. Add error/success message entries following the existing grouped-constant pattern rather than inline strings.
6. Write a `__tests__/*.usecase.test.ts` covering the happy path and every exception branch before considering the feature done.
7. If the target repo has `graphify-out/graph.json`, run `graphify update .` after scaffolding so the knowledge graph stays current.

Only use the templates as a starting skeleton — adapt field names, guards, and transaction shape to the actual entity being built rather than leaving placeholder logic in place.
