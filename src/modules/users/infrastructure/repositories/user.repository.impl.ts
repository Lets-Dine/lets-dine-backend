import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IUser, IUserCredentials } from "../../domain/interfaces/user.interface";
import { IUserCreate, IUserUpdate, UserFetchOptions, UserRepository } from "../../domain/repositories/user.repository";

@Injectable()
class UserRepositoryImpl implements UserRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findById(id: string, options?: UserFetchOptions): Promise<IUser | null> {
    const prisma = options?.tx ?? this.prisma;
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? this.toUser(user) : null;
  }

  async findByEmail(email: string, options?: UserFetchOptions): Promise<IUserCredentials | null> {
    const prisma = options?.tx ?? this.prisma;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return user ? { ...this.toUser(user), pinHash: user.pinHash } : null;
  }

  async create(data: IUserCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IUser> {
    const prisma = options?.tx ?? this.prisma;
    const user = await prisma.user.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
        createdBy: options?.actorId,
        updatedBy: options?.actorId,
      },
    });
    return this.toUser(user);
  }

  async update(id: string, data: IUserUpdate, transaction?: PrismaTransaction): Promise<IUser> {
    const prisma = transaction ?? this.prisma;
    const user = await prisma.user.update({
      where: { id },
      data: { ...data, ...(data.email && { email: data.email.toLowerCase() }) },
    });
    return this.toUser(user);
  }

  private toUser(user: { id: string; email: string; name: string; isActive: boolean; createdAt: Date; updatedAt: Date }): IUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export default UserRepositoryImpl;
