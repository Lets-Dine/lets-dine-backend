import { PrismaTransaction } from "../../../../common/prisma";
import { IDiningSession } from "../interfaces/dining-session.interface";

export interface IDiningSessionCreate {
  restaurantId: string;
  tableId: string;
  anonymousSessionToken: string;
  expiresAt: Date;
}

export type IDiningSessionUpdate = Partial<Pick<IDiningSession, "expiresAt" | "endedAt">>;

export interface DiningSessionFetchOptions {
  tx?: PrismaTransaction;
}

export abstract class DiningSessionRepository {
  abstract findById(id: string, options?: DiningSessionFetchOptions): Promise<IDiningSession | null>;
  abstract findByToken(token: string, options?: DiningSessionFetchOptions): Promise<IDiningSession | null>;
  abstract create(data: IDiningSessionCreate, options?: { tx?: PrismaTransaction }): Promise<IDiningSession>;
  abstract update(id: string, data: IDiningSessionUpdate, transaction?: PrismaTransaction): Promise<IDiningSession>;
}
