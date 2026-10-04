import { createZodDto } from "nestjs-zod";
import { fetchPlatformTenantsSchema } from "../../interfaces/http/validations/fetch-platform-tenants.validation";

export class FetchPlatformTenantsDto extends createZodDto(fetchPlatformTenantsSchema) {}
