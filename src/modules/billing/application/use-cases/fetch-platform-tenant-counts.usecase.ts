import { Injectable } from "@nestjs/common";
import { ITenantViewCounts } from "../../domain/interfaces/billing.interface";
import { TenantRepository } from "../../domain/repositories/tenant.repository";

/** How many restaurants sit in each listing view — the counts on the filter pills, independent of the page being shown. */
@Injectable()
export class FetchPlatformTenantCountsUsecase {
  constructor(private readonly tenantRepository: TenantRepository) {}

  execute(): Promise<ITenantViewCounts> {
    return this.tenantRepository.countByView();
  }
}
