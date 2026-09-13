import { Prisma } from "@prisma/client";

/** What every repository method accepts as an optional transaction handle. */
export type PrismaTransaction = Prisma.TransactionClient;
