# lets-dine-backend

The API behind the Restaurant Dining Experience Platform described in
`../myfood/my_food_blueprint.md` — the diner side (QR → menu → cart → order →
review) and the restaurant dashboard (the pass, the menu, tables, reviews,
analytics), in one NestJS service.

A **modular monolith**, per the blueprint's §42: one process, one database,
domain modules under `src/modules/` that could be pulled apart into services
later without rewriting them. Scaffolded from the `backend-architecture` skill's
Clean Architecture conventions.

```bash
cp .env.example .env          # already present; ports are 3100/5442/6389
docker compose up -d db       # Postgres 17 on 5442
npm install
npm run db:migrate            # creates the lets_dine schema
npm run db:seed               # review-tag vocabulary + a demo restaurant
npm run dev                   # http://localhost:3100/api/v1 · docs at /api/v1/docs
bash scripts/smoke.sh         # end-to-end walk through the whole product loop
```

Published host ports are deliberately off the usual 3000/5432/6379 so this can
run beside another backend stack on the same machine.

Demo sign-ins after seeding (PIN `4821`): `owner@lets-dine.test`,
`manager@lets-dine.test`, `staff@lets-dine.test` — one per role.

## Layout

```
src/
  common/           shared kernel: exceptions + filter, buildHttpResponse,
                    pagination, guards/decorators, PrismaService, middleware
  modules/
    auth/           staff sign-in (email + PIN → JWT), GET /auth/me
    users/          staff accounts and restaurant membership (§50 roles)
    restaurants/    restaurant profile, fee configuration, onboarding
    tables/         tables and their QR tokens (§16, §29)
    menu-categories/menu sections (§13)
    dishes/         dishes, availability, archiving, stats and badges (§12, §49)
    menus/          the composed public menu behind a QR scan
    dining-sessions/anonymous table sessions (§21, §22)
    orders/         cart → order, the pass, status transitions (§17–§20, §37)
    reviews/        purchase-verified dish reviews (§10, §11)
    analytics/      orders, revenue, dish performance, feedback (§31)
    audit-logs/     who changed what (§51)
prisma/
  schema.prisma     generator + datasource only
  models/           one model per file, all in the lets_dine schema
```

Each module follows the same four layers, and dependencies only ever point
inwards:

```
interfaces/http  →  application  →  domain  ←  infrastructure
  controller     →   use case     →  abstract repository  ←  Prisma impl
```

Controllers are thin (parse, call exactly one use case, wrap in
`buildHttpResponse`). Use cases hold the business rules. Repositories are
abstract classes in `domain/`, bound to their Prisma implementation in the
module's `@Module({...})`.

## API shape

Everything lives under `/api/v1`, split the way §35 asks for:

| Prefix | Who | Auth |
| --- | --- | --- |
| `/public/*` | diners, before they have a session | none |
| `/orders`, `/reviews` | diners, mid-meal | `x-session-token` header |
| `/restaurant/*` | staff dashboard | `Authorization: Bearer <jwt>` + role permission |
| `/platform/*` | operator onboarding | `x-platform-key` header |

Success responses are `{ data, message: { key, message } }`. Errors are
`{ data: null, statusCode, timestamp, error: { key, message, details } }`, shaped
by `DomainExceptionFilter`. Every list endpoint answers `{ rows, count }` and
takes `offset`/`limit`/`sortBy`/`sortOrder`/`returnData`/`returnCount`.

### Diner

| Method | Path |
| --- | --- |
| `POST` | `/public/sessions` — scan the QR: `{ restaurantSlug, tableToken }` |
| `GET` | `/public/sessions/current` |
| `GET` | `/public/restaurants/:slug` |
| `GET` | `/public/restaurants/:slug/menu` |
| `GET` | `/public/dishes/:id` |
| `GET` | `/public/dishes/:dishId/reviews` |
| `GET` | `/public/review-tags` |
| `POST` | `/orders` (send `Idempotency-Key`) |
| `GET` | `/orders`, `/orders/:id` |
| `POST` | `/reviews` |

### Restaurant

| Method | Path | Permission |
| --- | --- | --- |
| `POST` | `/auth/staff/sign-in` | — |
| `GET` | `/auth/me` | authenticated |
| `GET`/`PATCH` | `/restaurant/profile` | `settings:view` / `settings:edit` |
| `GET`/`POST`/`PATCH` | `/restaurant/staff` | `settings:view` / `settings:edit` |
| `GET`/`POST`/`PATCH` | `/restaurant/tables`, `POST /restaurant/tables/:id/qr` | `tables:view` / `tables:edit` |
| `GET`/`POST`/`PATCH`/`DELETE` | `/restaurant/categories` (+ `PATCH /reorder`) | `menu:view` / `menu:edit` |
| `GET`/`POST`/`PATCH` | `/restaurant/dishes` (+ `/reorder`, `/:id/archive`, `/:id/restore`) | `menu:view` / `menu:edit` / `menu:price` |
| `GET` | `/restaurant/orders`, `/restaurant/orders/:id` | `orders:view` |
| `PATCH` | `/restaurant/orders/:id/status` | `orders:advance` |
| `POST` | `/restaurant/orders/:id/cancel` | `orders:cancel` |
| `GET` | `/restaurant/reviews` | `reviews:view` |
| `GET` | `/restaurant/analytics` | `analytics:view` |
| `GET` | `/restaurant/audit-logs` | `audit:view` |

Permission strings and role grants are the same three roles the dashboard uses
(`src/common/auth/permissions.ts`).

### Platform

`POST /platform/restaurants` creates a restaurant, its first OWNER account and
the membership in one transaction; `GET /platform/restaurants` lists them. Both
require `x-platform-key` to match `PLATFORM_ADMIN_KEY` — unset the env var and
the endpoints answer 401 to everyone (§4.4: don't overbuild platform admin).

## Rules the API owns, not the client

- **Money is integer minor units** everywhere (§34). Totals are recomputed from
  dish rows and the restaurant's own `serviceChargeRate`/`taxRate` at checkout;
  a client-sent price or total is never read (`orders/domain/utils/money.util.ts`).
- **Order creation is one transaction and idempotent** — retrying with the same
  `Idempotency-Key` returns the first order rather than a second one (§36, §37).
- **The pass moves one way** — `PENDING → ACCEPTED → PREPARING → READY →
  COMPLETED`, cancellable only before `READY` (`orders/domain/entity/order.entity.ts`).
- **Reviews are purchase-verified** — the order must be this session's, complete,
  contain the dish, and not already carry a rating for it (§10, §11).
- **Restaurant scope comes from the token**, never from the request body (§36).
- **Dishes are archived, not deleted**, and a category is deletable only while
  empty (§28).
- **A table's QR can be rotated**, which retires every code already printed (§53).

## Dish stats

`DishStatsRepository` computes §12's numbers for many dishes in one pass —
rating averages and distribution, would-order-again share, units sold in the
trailing 30 days and the 30 before that, and top tags. `DishStatsService` turns
those into the §49 badges (`popular`, `loved`, `trending`, `gem`, `value`,
`pick`) using the Bayesian prior in `dishes/domain/constants/merchandising.ts`,
so five stars from two people never outranks 4.6 from three hundred.

## Development

```bash
npm test          # jest, *.test.ts colocated in __tests__/
npm run lint      # biome ci
npm run build
npm run db:studio
```

Logging is on by default and independently switchable: `LOG_HTTP_REQUESTS=false`
silences the per-request line, `LOG_PRISMA_QUERIES=false` the per-query one.

Running everything in Docker (`docker compose up`) bind-mounts the repo for live
reload and publishes the debugger on `9229`. After installing a new dependency
on the host, recreate the anonymous `node_modules` volume or the container keeps
the stale one: `docker compose up --build --force-recreate -V app`.

## Known gaps

- Real-time order updates are polling only (§38 MVP). No WebSocket or event bus
  yet — in one process the dependent call is a direct call.
- Payments are out of scope for the MVP (§40): an order records what is owed, not
  how it was paid.
- Image upload has no endpoint; `imageUrl` takes a URL you host elsewhere.
- Analytics sums line revenue in memory (see the comment in
  `analytics.repository.impl.ts`) — fine at MVP volume, swap for a SQL rollup later.
- Order references (`#1001`) are allocated by counting a restaurant's orders
  inside the transaction; two truly simultaneous placements can collide and one
  retries. Move to a per-restaurant sequence if that ever bites.
