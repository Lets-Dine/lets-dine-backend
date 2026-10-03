import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../common/prisma";
import type { PrismaTransaction } from "../../../../common/prisma";
import { ICustomer } from "../../domain/interfaces/customer.interface";
import { CustomerFetchOptions, CustomerRepository, ICustomerUpsert } from "../../domain/repositories/customer.repository";

interface CustomerRestaurantWithCustomer {
  restaurantId: string;
  defaultAddress: string | null;
  defaultNote: string | null;
  customer: { id: string; phone: string; name: string; createdAt: Date; updatedAt: Date };
}

function toCustomer(link: CustomerRestaurantWithCustomer): ICustomer {
  return {
    id: link.customer.id,
    restaurantId: link.restaurantId,
    phone: link.customer.phone,
    name: link.customer.name,
    defaultAddress: link.defaultAddress,
    defaultNote: link.defaultNote,
    createdAt: link.customer.createdAt,
    updatedAt: link.customer.updatedAt,
  };
}

@Injectable()
class CustomerRepositoryImpl implements CustomerRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, restaurantId: string, options?: CustomerFetchOptions): Promise<ICustomer | null> {
    const prisma = options?.tx ?? this.prisma;
    const link = await prisma.customerRestaurant.findUnique({
      where: { customerId_restaurantId: { customerId: id, restaurantId } },
      include: { customer: true },
    });
    return link ? toCustomer(link) : null;
  }

  async findByPhone(restaurantId: string, phone: string, options?: CustomerFetchOptions): Promise<ICustomer | null> {
    const prisma = options?.tx ?? this.prisma;
    const link = await prisma.customerRestaurant.findFirst({
      where: { restaurantId, customer: { phone } },
      include: { customer: true },
    });
    return link ? toCustomer(link) : null;
  }

  /**
   * Two writes — the global `Customer` row by phone, then this restaurant's
   * own `CustomerRestaurant` link — so this always runs as one transaction,
   * reusing the caller's if it gave one.
   */
  async upsert(data: ICustomerUpsert, options?: CustomerFetchOptions): Promise<ICustomer> {
    const run = async (tx: PrismaTransaction): Promise<ICustomer> => {
      const customer = await tx.customer.upsert({
        where: { phone: data.phone },
        update: { name: data.name },
        create: { phone: data.phone, name: data.name },
      });

      const link = await tx.customerRestaurant.upsert({
        where: { customerId_restaurantId: { customerId: customer.id, restaurantId: data.restaurantId } },
        update: { defaultAddress: data.defaultAddress, defaultNote: data.defaultNote },
        create: {
          customerId: customer.id,
          restaurantId: data.restaurantId,
          defaultAddress: data.defaultAddress,
          defaultNote: data.defaultNote,
        },
      });

      return toCustomer({ ...link, customer });
    };

    return options?.tx ? run(options.tx) : this.prisma.$transaction(run);
  }
}

export default CustomerRepositoryImpl;
