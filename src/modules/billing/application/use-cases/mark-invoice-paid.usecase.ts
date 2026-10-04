import { Injectable } from "@nestjs/common";
import { IInvoice } from "../../domain/interfaces/billing.interface";
import { MarkInvoicePaidInput } from "../../interfaces/http/validations/mark-invoice-paid.validation";
import { InvoiceSettlementService } from "../invoice-settlement.service";

@Injectable()
export class MarkInvoicePaidUsecase {
  constructor(private readonly invoiceSettlementService: InvoiceSettlementService) {}

  execute(invoiceId: string, dto: MarkInvoicePaidInput): Promise<IInvoice> {
    return this.invoiceSettlementService.settle(invoiceId, { paymentMethod: dto.paymentMethod, paymentRef: dto.paymentRef });
  }
}
