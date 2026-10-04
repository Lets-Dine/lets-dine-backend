import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IUsage } from "../../domain/interfaces/billing.interface";
import { EntitlementService } from "../entitlement.service";

@Injectable()
export class FetchUsageUsecase {
  constructor(private readonly entitlementService: EntitlementService) {}

  execute(authEntity: AuthEntity): Promise<IUsage> {
    return this.entitlementService.getUsage(authEntity.restaurantId);
  }
}
