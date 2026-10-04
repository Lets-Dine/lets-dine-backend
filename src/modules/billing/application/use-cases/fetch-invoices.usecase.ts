import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IInvoice } from "../../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { FetchInvoicesQuery } from "../../interfaces/http/validations/fetch-invoices.validation";

/** The owner's own invoices — scoped by the token's restaurant, never by anything in the request. */
@Injectable()
export class FetchInvoicesUsecase {
  constructor(private readonly invoiceRepository: InvoiceRepository) {}

  execute(query: FetchInvoicesQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IInvoice>> {
    return this.invoiceRepository.fetchAll({ restaurantId: authEntity.restaurantId }, query);
  }
}
