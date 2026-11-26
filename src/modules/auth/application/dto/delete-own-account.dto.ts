import { createZodDto } from "nestjs-zod";
import { deleteOwnAccountSchema } from "../../interfaces/http/validations/delete-own-account.validation";

export class DeleteOwnAccountDto extends createZodDto(deleteOwnAccountSchema) {}
