import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { can } from "../../../common/auth";
import { ForbiddenException } from "../../../common/exceptions";
import { AuthEntity } from "../../../common/interfaces";
import { AuditLogService } from "../../audit-logs/application/audit-log.service";
import { IStaffMember } from "../../users/domain/interfaces/restaurant-member.interface";
import { RestaurantMemberRepository } from "../../users/domain/repositories/restaurant-member.repository";
import { UserRepository } from "../../users/domain/repositories/user.repository";
import { verifyPin } from "../../users/domain/utils/pin.util";
import { PAYMENT_ERROR_MESSAGES } from "../domain/constants";

/** One person at the till gets five goes in a window; one approver can be tried ten times, so a single cashier cannot lock a manager out alone. */
const MAX_PER_REQUESTER = 5;
const MAX_PER_APPROVER = 10;
const WINDOW_MS = 15 * 60_000;

/**
 * Approval attempts, counted in memory by the approver being tried and by the person trying.
 * An attempt is counted the moment it starts and given back only if it succeeds, so a burst of parallel guesses is counted as
 * it arrives and not after each one has finished the slow PIN check.
 * ponytail: per instance, and lost on restart — which multiplies the guesses by the number of instances. Move to a shared
 * store (or count the `payment_override_denied` audit rows) if the API ever runs as more than one.
 */
@Injectable()
export class ApprovalAttemptLimiter {
  private readonly byApprover = new Map<string, number[]>();
  private readonly byRequester = new Map<string, number[]>();

  private recent(book: Map<string, number[]>, id: string, now: number): number[] {
    const kept = (book.get(id) ?? []).filter(at => now - at < WINDOW_MS);
    if (kept.length === 0) book.delete(id);
    else book.set(id, kept);
    return kept;
  }

  /** Counts an attempt, unless one of the two has used up their goes. */
  reserve(approverId: string, requesterId: string, now = Date.now()): boolean {
    if (this.recent(this.byApprover, approverId, now).length >= MAX_PER_APPROVER) return false;
    if (this.recent(this.byRequester, requesterId, now).length >= MAX_PER_REQUESTER) return false;
    this.byApprover.set(approverId, [...this.recent(this.byApprover, approverId, now), now]);
    this.byRequester.set(requesterId, [...this.recent(this.byRequester, requesterId, now), now]);
    return true;
  }

  /** A good PIN hands its attempt back. */
  release(approverId: string, requesterId: string): void {
    this.byApprover.get(approverId)?.pop();
    this.byRequester.get(requesterId)?.pop();
  }

  isLocked(approverId: string, requesterId: string, now = Date.now()): boolean {
    return this.recent(this.byApprover, approverId, now).length >= MAX_PER_APPROVER || this.recent(this.byRequester, requesterId, now).length >= MAX_PER_REQUESTER;
  }
}

export interface IApprovalInput {
  memberId: string;
  pin: string;
}

/**
 * A manager vouching, with their approval PIN (not their sign-in one), for something the person at the till may not do alone: a discount, or a bill
 * that is not what was ordered. The PIN rides in the same request as the payment, so there is no approval to steal or
 * replay: it is checked, used and gone in one call.
 */
@Injectable()
export class PaymentApprovalService {
  constructor(
    private readonly restaurantMemberRepository: RestaurantMemberRepository,
    private readonly userRepository: UserRepository,
    private readonly auditLogService: AuditLogService,
    private readonly limiter: ApprovalAttemptLimiter
  ) {}

  /** Anyone at this branch whose role may discount: who a cashier can ask. Owners reach every branch. */
  async listApprovers(authEntity: AuthEntity): Promise<IStaffMember[]> {
    const { rows } = await this.restaurantMemberRepository.fetchAll({ restaurantId: authEntity.restaurantId, isActive: true });
    // Somebody who has not set an approval PIN cannot approve anything, so they are not offered.
    return rows.filter(member => member.hasApprovalPin && this.canApproveHere(member, authEntity));
  }

  /**
   * Returns the approving member, or refuses. Every refusal reads the same (a wrong PIN, somebody who cannot approve, and
   * somebody who does not exist are not told apart) except a lockout, which has to say why nothing works.
   */
  async verify(input: IApprovalInput, authEntity: AuthEntity): Promise<IStaffMember> {
    // Counted before anything slow runs, so a burst of parallel guesses cannot all slip past the count.
    if (!this.limiter.reserve(input.memberId, authEntity.sub)) throw new ForbiddenException(PAYMENT_ERROR_MESSAGES.APPROVAL_LOCKED);

    const member = await this.restaurantMemberRepository.findById(input.memberId);
    const eligible = member && member.restaurantId === authEntity.restaurantId && this.canApproveHere(member, authEntity);
    // The approval PIN lives on the account, found through the membership's email. It is not the sign-in PIN, and with none set there
    // is nothing to match.
    const user = eligible ? await this.userRepository.findByEmail(member.email) : null;
    const pinOk = Boolean(user?.isActive && user.approvalPinHash) && (await verifyPin(input.pin, user!.approvalPinHash!));

    if (!eligible || !pinOk) {
      // Outside any payment transaction on purpose: a refused attempt must leave its mark even though the payment is refused.
      await this.auditLogService.record(
        { action: AuditAction.payment_override_denied, subject: member?.name ?? "Unknown approver", detail: "A manager approval was refused" },
        authEntity
      );
      throw new ForbiddenException(PAYMENT_ERROR_MESSAGES.APPROVAL_INVALID);
    }
    this.limiter.release(input.memberId, authEntity.sub);
    return member;
  }

  private canApproveHere(member: IStaffMember, authEntity: AuthEntity): boolean {
    if (!member.isActive || !can(member.role, "payments:discount")) return false;
    return member.role === "OWNER" || member.branchIds.includes(authEntity.branchId);
  }
}
