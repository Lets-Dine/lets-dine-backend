import { createZodDto } from "nestjs-zod";
import { fetchProfitLossSchema } from "../../interfaces/http/validations/fetch-profit-loss.validation";

export class FetchProfitLossDto extends createZodDto(fetchProfitLossSchema) {}
