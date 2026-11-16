import { Injectable } from "@nestjs/common";
import { StaffRole } from "@prisma/client";
import { AuthEntity } from "../../../../common/interfaces";
import { PaymentApprovalService } from "../payment-approval.service";

export interface IPaymentApprover {
  memberId: string;
  name: string;
  role: StaffRole;
  avatarUrl: string | null;
}

/** Who a cashier can ask to approve a discount or a changed bill: names and faces only, nothing about their account. */
@Injectable()
export class ListPaymentApproversUsecase {
  constructor(private readonly approvalService: PaymentApprovalService) {}

  async execute(authEntity: AuthEntity): Promise<IPaymentApprover[]> {
    const approvers = await this.approvalService.listApprovers(authEntity);
    return approvers.map(({ id, name, role, avatarUrl }) => ({ memberId: id, name, role, avatarUrl }));
  }
}
