import { Module } from "@nestjs/common";
import { GetCustomerUsecase } from "./application/use-cases/get-customer.usecase";
import { UpdateCustomerUsecase } from "./application/use-cases/update-customer.usecase";
import { ListCustomersUsecase } from "./application/use-cases/list-customers.usecase";
import { CustomerRepository } from "./domain/repositories/customer.repository";
import CustomerRepositoryImpl from "./infrastructure/repositories/customer.repository.impl";
import { CustomerController } from "./interfaces/http/customer.controller";

@Module({
  controllers: [CustomerController],
  providers: [ListCustomersUsecase, GetCustomerUsecase, UpdateCustomerUsecase, CustomerRepositoryImpl, { provide: CustomerRepository, useExisting: CustomerRepositoryImpl }],
  exports: [{ provide: CustomerRepository, useExisting: CustomerRepositoryImpl }],
})
export class CustomersModule {}
