# Template placeholders

Replace every placeholder consistently when scaffolding from these templates. Example values assume a new "appointment" feature inside a "care-pathway"-style app.

| Placeholder | Meaning | Example |
|---|---|---|
| `{Feature}` | PascalCase singular entity/feature name | `Appointment` |
| `{feature}` | camelCase entity/feature name | `appointment` |
| `{feature-name}` | kebab-case, used in file names and module folder | `appointment` |
| `{FEATURE}` | SCREAMING_SNAKE, used as an error-key prefix | `APPOINTMENT` |
| `{Action}` | PascalCase verb for a specific use case | `Create`, `Update`, `Delete`, `Fetch` |
| `{action}` | kebab-case verb for file names | `create`, `update`, `delete`, `fetch` |
| `{app-name}` | the app/service directory this module lives in | `care-pathway` |

Files are named `{action}-{feature-name}.*` (e.g. `create-appointment.usecase.ts`). Not every feature needs every template — a read-only feature has no `create`/`update` use case, an entity is only worth adding if it carries behavior beyond plain data.

## Before copying: adjust for project shape

These templates are written against holista-backend's own conventions (`@holista/core/*` imports, NATS pub/sub, `apps/{app-name}/...` module root). Before using them in a different repo:

1. **Module root** — microservice monorepo: `apps/{app-name}/src/app/modules/{feature-name}/`; monolith: `src/modules/{feature-name}/` (or wherever this repo's existing modules already live).
2. **Shared imports** — every `@holista/core/*` import (exceptions, decorators, `buildHttpResponse`, interfaces) must be swapped for wherever the target repo actually keeps this code. Grep the repo for an existing exception class or `buildHttpResponse`-equivalent first; don't assume a path.
3. **Cross-module events** — the use-case template publishes via `IPubSub`/`PUB_SUB_SERVICE` (NATS), which only makes sense across services. In a monolith, replace that with a direct call to the dependent use case/service, or `EventEmitter2.emit(...)` from `@nestjs/event-emitter` if you genuinely need decoupled listeners.
4. **Module registration** — import the new feature module into the correct root: the owning service's `AppModule` in a microservice, or the single root `AppModule` in a monolith.
