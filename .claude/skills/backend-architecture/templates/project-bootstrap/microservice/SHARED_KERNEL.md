# Shared kernel to create next (`packages/core/src/`)

Create these before scaffolding the first feature in `apps/{service-name}` — the rest of this skill's conventions (error handling, `buildHttpResponse`, module registration, cross-service events) depend on them existing.

## `exceptions/domain-exception.ts`

```typescript
export interface IDomainException {
  key: string;
  message: string;
  detail?: any;
}

export class DomainException extends Error {
  constructor(
    message: string,
    public exception: IDomainException
  ) {
    super(message);
    Object.setPrototypeOf(this, DomainException.prototype);
  }
}
```

## One file per exception type (`exceptions/*.ts`)

`not-found-exception.ts`, `conflict-exception.ts`, `bad-request-exception.ts`, `forbidden-exception.ts`, each following:

```typescript
import { DomainException, IDomainException } from "./domain-exception";

export class NotFoundException extends DomainException {
  constructor(exception: IDomainException) {
    super(exception.message, exception);
    Object.setPrototypeOf(this, NotFoundException.prototype);
  }
}
```

## `exceptions/filters/domain-exception.filter.ts`

Maps each exception subclass to its HTTP status; wired into every service's `AppModule` as `APP_FILTER`:

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { BadRequestException, ConflictException, DomainException, ForbiddenException, NotFoundException } from "../";

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const statusCode = this.getStatusCode(exception);
    const response = host.switchToHttp().getResponse<Response>();

    return response.status(statusCode).json({
      data: null,
      statusCode,
      timestamp: new Date(),
      error: { message: exception.message, key: exception.exception.key, details: exception.exception.detail },
    });
  }

  private getStatusCode(exception: DomainException): number {
    if (exception instanceof ConflictException) return HttpStatus.CONFLICT;
    if (exception instanceof ForbiddenException) return HttpStatus.FORBIDDEN;
    if (exception instanceof NotFoundException) return HttpStatus.NOT_FOUND;
    if (exception instanceof BadRequestException) return HttpStatus.BAD_REQUEST;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
```

Barrel export everything (`domain-exception`, each exception type, `filters`) from `exceptions/index.ts`.

## `interfaces/http-response.ts`

```typescript
export interface IHttpResponse<T = unknown> {
  data: T;
  message?: { key: string; message: string };
}
```

## `utils/build-http-response.ts`

```typescript
import { IHttpResponse } from "../interfaces/http-response";

export function buildHttpResponse<T>(data: T, message: { key: string; message: string }): IHttpResponse<T> {
  return { data, message };
}
```

## `utils/startup-banner.ts`

Every service's `main.ts` calls this at the end of `bootstrap()` — a bordered terminal banner with the app name, local URL, and Swagger docs URL. Shared in `packages/core` (not duplicated per service) since every service needs the identical thing, just with its own name/port:

```typescript
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";

interface StartupBannerOptions {
  name: string;
  port: number;
  docsPath: string;
  apiPrefix: string;
}

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, "");
}

export function printStartupBanner({ name, port, docsPath, apiPrefix }: StartupBannerOptions): void {
  const baseUrl = `http://localhost:${port}`;
  const lines = [
    `${BOLD}${name}${RESET}`,
    "",
    `${DIM}Local:${RESET}  ${CYAN}${baseUrl}/${apiPrefix}${RESET}`,
    `${DIM}Docs:${RESET}   ${CYAN}${baseUrl}${docsPath}${RESET}`,
  ];

  const width = Math.max(...lines.map((line) => stripAnsi(line).length)) + 4;
  const horizontal = "═".repeat(width);

  const rendered = lines.map((line) => {
    const padding = " ".repeat(width - stripAnsi(line).length - 2);
    return `${GREEN}║${RESET} ${line}${padding} ${GREEN}║${RESET}`;
  });

  console.log(
    ["", `${GREEN}╔${horizontal}╗${RESET}`, ...rendered, `${GREEN}╚${horizontal}╝${RESET}`, ""].join("\n"),
  );
}
```

No new dependency — hand-rolled ANSI, kept dependency-free on purpose. Barrel-export it from `utils/index.ts` alongside `build-http-response` (that barrel is what `package.json`'s `"./utils"` export points at). Each service's `main.ts` imports it as `{scope}/core/utils` and pairs it with mounting Swagger (`@nestjs/swagger`, add it to that service's `dependencies`) at `/{api-prefix}/docs` — see the template's own `apps/{service-name}/src/main.ts` for the exact wiring.

## Cross-service pub/sub (`interfaces/pub-sub.ts` + a NATS-backed implementation)

Microservices need this from day one — a use case in one service publishes, another service's module subscribes. Define the interface in `packages/core` and the NATS-backed implementation alongside it:

```typescript
// interfaces/pub-sub.ts
export interface IPubSub {
  publish(event: string, payload: unknown): void;
}
```

```typescript
// nats.service.ts — install the `nats` package first
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { connect, NatsConnection, StringCodec } from "nats";
import { IPubSub } from "./interfaces/pub-sub";

@Injectable()
export class NatsService implements IPubSub, OnModuleInit, OnModuleDestroy {
  private connection: NatsConnection;
  private readonly codec = StringCodec();

  async onModuleInit() {
    this.connection = await connect({ servers: process.env.NATS_URL ?? "nats://localhost:4222" });
  }

  async onModuleDestroy() {
    await this.connection?.drain();
  }

  publish(event: string, payload: unknown): void {
    this.connection.publish(event, this.codec.encode(JSON.stringify(payload)));
  }
}
```

Register it in each service that publishes or subscribes: `{ provide: "PUB_SUB_SERVICE", useExisting: NatsService }` — this is exactly the token `SKILL.md`'s use-case template expects.

## `middleware/request-logger.middleware.ts`

Logs every request as `METHOD path status - Nms`, toggled by `LOG_HTTP_REQUESTS` (default on, set to `"false"` to silence). Shared in `packages/core` since every service wires it identically:

```typescript
import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    res.on("finish", () => {
      this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`);
    });

    next();
  }
}
```

Barrel-export it from `middleware/index.ts` (that's what `package.json`'s `"./middleware"` export points at). Each service's `AppModule` imports it as `{scope}/core/middleware` and wires it in `configure()`:

```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    if (process.env.LOG_HTTP_REQUESTS !== "false") {
      consumer.apply(RequestLoggerMiddleware).forRoutes("*");
    }
  }
}
```

## `packages/database` — Prisma access

Each service injects a thin `PrismaService` wrapping the generated client (add this in `packages/database/src/prisma.service.ts`, exported alongside the generated client). Query logging is toggled by `LOG_PRISMA_QUERIES` (default on, `"false"` silences it) — the matching toggle to `LOG_HTTP_REQUESTS` above:

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "../generated/client";

const isQueryLoggingEnabled = process.env.LOG_PRISMA_QUERIES !== "false";

@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, "query"> implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("PrismaQuery");

  constructor() {
    super(isQueryLoggingEnabled ? { log: [{ emit: "event", level: "query" }] } : {});
  }

  async onModuleInit() {
    if (isQueryLoggingEnabled) {
      this.$on("query", event => {
        this.logger.debug(`${event.query} ${event.params} (+${event.duration}ms)`);
      });
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

Add both env vars to the root `.env`/`.env.example`: `LOG_HTTP_REQUESTS=true` and `LOG_PRISMA_QUERIES=true` — shared by every service since they're read directly from `process.env`.

Auth (`AuthGuard`, `AuthUser` decorator, `AuthEntity`) is deliberately not templated here — it's the most project-specific piece (session vs. JWT vs. SSO, and whether auth is centralized in a gateway service). Add it under `packages/core/src/decorators/` once the project's auth strategy is decided, matching this same one-concept-per-file style.
