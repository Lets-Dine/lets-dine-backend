import { Injectable } from "@nestjs/common";
import { PaginatedResponse } from "../../../../common/interfaces";
import { ITenantListItem } from "../../domain/interfaces/billing.interface";
import { TenantRepository } from "../../domain/repositories/tenant.repository";
import { FetchPlatformTenantsQuery } from "../../interfaces/http/validations/fetch-platform-tenants.validation";

/** The platform restaurant listing: every restaurant with its plan, status, usage and revenue, one page at a time. */
@Injectable()
export class FetchPlatformTenantsUsecase {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(query: FetchPlatformTenantsQuery): Promise<PaginatedResponse<ITenantListItem>> {
    const { view, planKey, keyword, ...pagination } = query;
    return this.tenantRepository.fetchAll({ view, planKey, keyword }, pagination);
  }
}
