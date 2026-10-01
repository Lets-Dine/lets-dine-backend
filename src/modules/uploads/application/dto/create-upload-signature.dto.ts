import { createZodDto } from "nestjs-zod";
import { createUploadSignatureSchema } from "../../interfaces/http/validations/create-upload-signature.validation";

export class CreateUploadSignatureDto extends createZodDto(createUploadSignatureSchema) {}
