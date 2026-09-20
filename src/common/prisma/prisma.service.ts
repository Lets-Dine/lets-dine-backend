import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

const isQueryLoggingEnabled = process.env.LOG_PRISMA_QUERIES !== "false";

// Prisma requires a finite millisecond value for transaction timeouts, so "unlimited"
// is expressed as the largest value the query engine accepts (2^31-1 ms, ~24.8 days).
const UNLIMITED_MS = 2_147_483_647;
const transactionTimeoutMs = Number(process.env.PRISMA_TRANSACTION_TIMEOUT_MS ?? UNLIMITED_MS);
const transactionMaxWaitMs = Number(process.env.PRISMA_TRANSACTION_MAX_WAIT_MS ?? UNLIMITED_MS);

@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, "query"> implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("PrismaQuery");

  constructor() {
    super({
      ...(isQueryLoggingEnabled ? { log: [{ emit: "event", level: "query" }] as const } : {}),
      transactionOptions: { maxWait: transactionMaxWaitMs, timeout: transactionTimeoutMs },
    });
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
