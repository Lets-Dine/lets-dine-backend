import { Injectable, Logger } from "@nestjs/common";
import { StaffRole } from "@prisma/client";
import { can, StaffAccessPolicy } from "../../../common/auth";
import { PrismaService } from "../../../common/prisma";
import { PushMessage, PushService } from "./push.service";

const PUSH_CAP_MS = 4000;

type Permission = Parameters<typeof can>[1];

/**
 * Who hears about something, decided when it happens and not when the phone registered: a member removed since, a
 * role that no longer allows it, or a restaurant suspended since must all stop getting pushes at once.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly accessPolicy: StaffAccessPolicy
  ) {}

  /**
   * Every phone currently working in this branch whose owner may see `permission`. Callers wait for it (a serverless host can freeze
   * the function the moment the response goes out), so it is capped, and errors are logged, never thrown: a push must never fail or
   * noticeably slow the order or request that caused it.
   */
  async notifyBranch(target: { restaurantId: string; branchId: string }, permission: Permission, message: PushMessage): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const cap = new Promise<void>(resolve => {
      timer = setTimeout(() => {
        this.logger.warn("Push gave up waiting for Firebase");
        resolve();
      }, PUSH_CAP_MS);
    });
    try {
      await Promise.race([this.deliver(target, permission, message), cap]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async deliver(target: { restaurantId: string; branchId: string }, permission: Permission, message: PushMessage): Promise<void> {
    try {
      if (!this.push.enabled) return;
      const devices = await this.prisma.deviceToken.findMany({
        where: {
          restaurantId: target.restaurantId,
          branchId: target.branchId,
          // Still checked now, not only when the phone registered: a member taken off this branch since stops hearing about it
          // (an owner reaches every branch without being assigned to one).
          member: {
            isActive: true,
            user: { isActive: true },
            OR: [{ role: StaffRole.OWNER }, { branches: { some: { branchId: target.branchId } } }],
          },
        },
        select: { token: true, member: { select: { role: true } } },
      });
      const tokens = devices.filter(device => can(device.member.role, permission)).map(device => device.token);
      if (tokens.length === 0) return;
      // A suspended restaurant gets no live pass, so it gets no pushes either.
      await this.accessPolicy.assertCanAccess({ restaurantId: target.restaurantId, role: StaffRole.OWNER });
      const dead = await this.push.send(tokens, message);
      if (dead.length) await this.prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
    } catch (error) {
      this.logger.warn(`Push not sent: ${error instanceof Error ? error.message : error}`);
    }
  }

  /** The phone now belongs to this member in this branch, whoever had it before. */
  register(auth: { memberId: string; restaurantId: string; branchId: string }, token: string, platform: string): Promise<unknown> {
    const owner = { memberId: auth.memberId, restaurantId: auth.restaurantId, branchId: auth.branchId, platform };
    return this.prisma.deviceToken.upsert({ where: { token }, create: { token, ...owner }, update: owner });
  }

  /** Only the member's own phone: a token is a secret, but nobody should be able to unregister somebody else's by guessing. */
  unregister(auth: { memberId: string }, token: string): Promise<unknown> {
    return this.prisma.deviceToken.deleteMany({ where: { token, memberId: auth.memberId } });
  }

  /** Account deletion: every phone a membership ever registered. Pushes already stop for inactive members; this drops the stored tokens too. */
  removeAllForMembers(memberIds: string[]): Promise<unknown> {
    if (memberIds.length === 0) return Promise.resolve();
    return this.prisma.deviceToken.deleteMany({ where: { memberId: { in: memberIds } } });
  }
}
