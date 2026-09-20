import { Injectable } from "@nestjs/common";
import { PrismaService, PrismaTransaction } from "../../../../common/prisma";
import { IPaymentWithItems } from "../../domain/interfaces/payment.interface";
import { IPaymentCreate, PaymentRepository } from "../../domain/repositories/payment.repository";

@Injectable()
class PaymentRepositoryImpl implements PaymentRepository {
  constructor(private prisma: PrismaService) {}

  async $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async create(data: IPaymentCreate, options?: { tx?: PrismaTransaction }): Promise<IPaymentWithItems> {
    const prisma = options?.tx ?? this.prisma;
    const { items, ...payment } = data;
    return prisma.payment.create({
      data: { ...payment, items: { create: items } },
      include: { items: true },
    });
  }
}

export default PaymentRepositoryImpl;
