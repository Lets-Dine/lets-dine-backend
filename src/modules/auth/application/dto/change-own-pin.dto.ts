import { createZodDto } from "nestjs-zod";
import { changeOwnPinSchema } from "../../interfaces/http/validations/change-own-pin.validation";

export class ChangeOwnPinDto extends createZodDto(changeOwnPinSchema) {}
