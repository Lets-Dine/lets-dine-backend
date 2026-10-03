import { Module } from "@nestjs/common";
import { ListCustomersUsecase } from "./application/use-cases/list-customers.usecase";
import { CustomerRepository } from "./domain/repositories/customer.repository";
import CustomerRepositoryImpl from "./infrastructure/repositories/customer.repository.impl";
import { CustomerController } from "./interfaces/http/customer.controller";

@Module({
  controllers: [CustomerController],
  providers: [ListCustomersUsecase, CustomerRepositoryImpl, { provide: CustomerRepository, useExisting: CustomerRepositoryImpl }],
  exports: [{ provide: CustomerRepository, useExisting: CustomerRepositoryImpl }],
})
export class CustomersModule {}
