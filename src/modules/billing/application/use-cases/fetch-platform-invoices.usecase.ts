import { Injectable } from "@nestjs/common";
import { PaginatedResponse } from "../../../../common/interfaces";
import { IInvoice } from "../../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { FetchPlatformInvoicesQuery } from "../../interfaces/http/validations/fetch-platform-invoices.validation";

/** Every restaurant's invoices, for the operator working through what is open. */
@Injectable()
export class FetchPlatformInvoicesUsecase {
  constructor(private readonly invoiceRepository: InvoiceRepository) {}

  execute(query: FetchPlatformInvoicesQuery): Promise<PaginatedResponse<IInvoice>> {
    const { restaurantId, status, ...pagination } = query;
    return this.invoiceRepository.fetchAll({ restaurantId, status }, pagination);
  }
}
