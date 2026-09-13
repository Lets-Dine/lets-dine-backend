import { PrismaTransaction } from "../../../../common/prisma";
import { IUser, IUserCredentials } from "../interfaces/user.interface";

export interface IUserCreate {
  email: string;
  name: string;
  pinHash: string;
  isActive?: boolean;
}

export type IUserUpdate = Partial<Omit<IUserCreate, "email">> & { email?: string };

export interface UserFetchOptions {
  tx?: PrismaTransaction;
}

export abstract class UserRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findById(id: string, options?: UserFetchOptions): Promise<IUser | null>;
  abstract findByEmail(email: string, options?: UserFetchOptions): Promise<IUserCredentials | null>;
  abstract create(data: IUserCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IUser>;
  abstract update(id: string, data: IUserUpdate, transaction?: PrismaTransaction): Promise<IUser>;
}
