import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../common/prisma";
import { ICustomer } from "../../domain/interfaces/customer.interface";
import { CustomerFetchOptions, CustomerRepository, ICustomerUpsert } from "../../domain/repositories/customer.repository";

@Injectable()
class CustomerRepositoryImpl implements CustomerRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, options?: CustomerFetchOptions): Promise<ICustomer | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.customer.findUnique({ where: { id } });
  }

  async findByPhone(restaurantId: string, phone: string, options?: CustomerFetchOptions): Promise<ICustomer | null> {
    const prisma = options?.tx ?? this.prisma;
    return prisma.customer.findUnique({ where: { restaurantId_phone: { restaurantId, phone } } });
  }

  async upsert(data: ICustomerUpsert, options?: CustomerFetchOptions): Promise<ICustomer> {
    const prisma = options?.tx ?? this.prisma;
    const { restaurantId, phone, ...rest } = data;
    return prisma.customer.upsert({
      where: { restaurantId_phone: { restaurantId, phone } },
      update: rest,
      create: { restaurantId, phone, ...rest },
    });
  }
}

export default CustomerRepositoryImpl;
