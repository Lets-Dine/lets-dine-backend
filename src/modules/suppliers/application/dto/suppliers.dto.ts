import { createZodDto } from "nestjs-zod";
import { createSupplierSchema } from "../../interfaces/http/validations/create-supplier.validation";
import { fetchSupplierPageSchema } from "../../interfaces/http/validations/fetch-supplier-page.validation";
import { logIssueSchema } from "../../interfaces/http/validations/log-issue.validation";
import { recordPaymentSchema } from "../../interfaces/http/validations/record-payment.validation";
import { updateSupplierSchema } from "../../interfaces/http/validations/update-supplier.validation";

export class CreateSupplierDto extends createZodDto(createSupplierSchema) {}
export class UpdateSupplierDto extends createZodDto(updateSupplierSchema) {}
export class RecordPaymentDto extends createZodDto(recordPaymentSchema) {}
export class LogIssueDto extends createZodDto(logIssueSchema) {}
export class FetchSupplierPageDto extends createZodDto(fetchSupplierPageSchema) {}
