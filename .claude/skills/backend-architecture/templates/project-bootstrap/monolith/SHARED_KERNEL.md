# Shared kernel to create next

Create these under `src/common/` before scaffolding the first feature — the rest of this skill's conventions (error handling, `buildHttpResponse`, module registration) depend on them existing. This mirrors holista-backend's `@holista/core` exceptions/utils pattern, scaled down to a single project.

## `src/common/exceptions/domain-exception.ts`

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

## One file per exception type (`src/common/exceptions/*.ts`)

Each follows the same shape — `not-found-exception.ts`, `conflict-exception.ts`, `bad-request-exception.ts`, `forbidden-exception.ts`:

```typescript
import { DomainException, IDomainException } from "./domain-exception";

export class NotFoundException extends DomainException {
  constructor(exception: IDomainException) {
    super(exception.message, exception);
    Object.setPrototypeOf(this, NotFoundException.prototype);
  }
}
```

Barrel export in `src/common/exceptions/index.ts`:

```typescript
export * from "./domain-exception";
export * from "./not-found-exception";
export * from "./conflict-exception";
export * from "./bad-request-exception";
export * from "./forbidden-exception";
```

## `src/common/exceptions/filters/domain-exception.filter.ts`

Maps each exception subclass to its HTTP status and shapes the error body — wired into `AppModule` as `APP_FILTER`:

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import {
  BadRequestException,
  ConflictException,
  DomainException,
  ForbiddenException,
  NotFoundException,
} from "../";

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

## `src/common/interfaces/http-response.interface.ts`

```typescript
export interface IHttpResponse<T = unknown> {
  data: T;
  message?: { key: string; message: string };
}
```

## `src/common/utils/build-http-response.ts`

```typescript
import { IHttpResponse } from "../interfaces/http-response.interface";

export function buildHttpResponse<T>(data: T, message: { key: string; message: string }): IHttpResponse<T> {
  return { data, message };
}
```

## `src/common/utils/startup-banner.ts`

Printed once at the end of `bootstrap()` in `main.ts` — a bordered terminal banner with the app name, local URL, and Swagger docs URL, so it's obvious at a glance (especially with several services' logs interleaved in Docker) that the app is up and where to find it:

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

No new dependency — hand-rolled ANSI, kept dependency-free on purpose. `main.ts` calls it right after `app.listen(port)`, alongside mounting Swagger (`@nestjs/swagger`, add it to `dependencies`) at `/{api-prefix}/docs` — see the template's own `src/main.ts` for the exact wiring.

## `src/common/middleware/request-logger.middleware.ts`

Logs every request as `METHOD path status - Nms`, toggled by `LOG_HTTP_REQUESTS` (default on, set to `"false"` to silence). Wired into `AppModule.configure()`:

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

```typescript
// app.module.ts — add alongside the existing providers/imports
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    if (process.env.LOG_HTTP_REQUESTS !== "false") {
      consumer.apply(RequestLoggerMiddleware).forRoutes("*");
    }
  }
}
```

## `src/common/prisma.service.ts`

Every repository impl injects this instead of instantiating `PrismaClient` directly. Query logging is toggled by `LOG_PRISMA_QUERIES` (default on, `"false"` silences it) — the matching toggle to `LOG_HTTP_REQUESTS` above:

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

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

Add both env vars to `.env`/`.env.example`: `LOG_HTTP_REQUESTS=true` and `LOG_PRISMA_QUERIES=true`.

## `prisma/schema.prisma` + `prisma/models/*.prisma`

Already scaffolded by the template — `schema.prisma` holds only `generator`/`datasource` (with `schemas = ["public", "{project-name}"]`), and models live one-per-file under `prisma/models/` with `@@schema("{project-name}")` on every model and enum. See the SKILL.md Database section before adding the first real model — don't add `model`/`enum` blocks to `schema.prisma` itself, and don't leave them on the default `public` schema.

Auth (`AuthGuard`, `AuthUser` decorator, `AuthEntity`) is deliberately not templated here — it's the most project-specific piece (session vs. JWT vs. SSO). Add it under `src/common/auth/` once the project's auth strategy is decided, matching this same one-concept-per-file style.
