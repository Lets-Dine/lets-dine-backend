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
