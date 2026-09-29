import { Module } from "@nestjs/common";
import { CustomerRepository } from "./domain/repositories/customer.repository";
import CustomerRepositoryImpl from "./infrastructure/repositories/customer.repository.impl";

@Module({
  providers: [CustomerRepositoryImpl, { provide: CustomerRepository, useExisting: CustomerRepositoryImpl }],
  exports: [{ provide: CustomerRepository, useExisting: CustomerRepositoryImpl }],
})
export class CustomersModule {}
