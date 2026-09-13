import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IDiningSession } from "../../domain/interfaces/dining-session.interface";
import {
  DiningSessionFetchOptions,
  DiningSessionRepository,
  IDiningSessionCreate,
  IDiningSessionUpdate,
} from "../../domain/repositories/dining-session.repository";

@Injectable()
class DiningSessionRepositoryImpl implements DiningSessionRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, options?: DiningSessionFetchOptions): Promise<IDiningSession | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.diningSession.findUnique({ where: { id } });
  }

  async findByToken(token: string, options?: DiningSessionFetchOptions): Promise<IDiningSession | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.diningSession.findUnique({ where: { anonymousSessionToken: token } });
  }

  async create(data: IDiningSessionCreate, options?: { tx?: PrismaTransaction }): Promise<IDiningSession> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.diningSession.create({ data });
  }

  async update(id: string, data: IDiningSessionUpdate, transaction?: PrismaTransaction): Promise<IDiningSession> {
    const prisma = transaction ?? this.prisma;
    return prisma.diningSession.update({ where: { id }, data });
  }
}

export default DiningSessionRepositoryImpl;
