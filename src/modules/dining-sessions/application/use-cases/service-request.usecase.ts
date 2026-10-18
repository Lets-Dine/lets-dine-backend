import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { FloorRepository } from "../../../floors/domain/repositories/floor.repository";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { DINING_SESSION_ERROR_MESSAGES } from "../../domain/constants";
import { IDiningSession, IServiceRequest } from "../../domain/interfaces/dining-session.interface";
import { DiningSessionRepository } from "../../domain/repositories/dining-session.repository";

export type ServiceRequestKind = "waiter" | "bill";
const FIELD = { waiter: "waiterCalledAt", bill: "billRequestedAt" } as const;

/**
 * A diner at a table or floor asking for a waiter or the bill. The flag lives on the session so a pass that
 * opens (or reconnects) later still finds it over HTTP; `service.requested` only tells open tabs sooner.
 * Re-asking just re-stamps it, so a nervous double-tap is harmless.
 */
@Injectable()
export class ServiceRequestUsecase {
  constructor(
    private readonly diningSessionRepository: DiningSessionRepository,
    private readonly diningTableRepository: DiningTableRepository,
    private readonly floorRepository: FloorRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  list(authEntity: AuthEntity): Promise<IServiceRequest[]> {
    return this.diningSessionRepository.findServiceRequests(authEntity.restaurantId, authEntity.branchId);
  }

  /** Diner side — the session already came through `DinerSessionGuard`. */
  async raise(session: IDiningSession, kind: ServiceRequestKind): Promise<IServiceRequest> {
    // A delivery or floor visit has no table to walk over to.
    if (!session.tableId) throw new BadRequestException(DINING_SESSION_ERROR_MESSAGES.SERVICE_NOT_AVAILABLE);
    return this.set(session, kind, new Date());
  }

  /** Staff side — "on my way" / "bill brought". Same branch check as every other staff action on a visit. */
  async clear(sessionId: string, kind: ServiceRequestKind, authEntity: AuthEntity): Promise<IServiceRequest> {
    const session = await this.diningSessionRepository.findById(sessionId);
    if (!session || session.endedAt || session.restaurantId !== authEntity.restaurantId || !isInActiveBranch(authEntity, session)) {
      throw new NotFoundException(DINING_SESSION_ERROR_MESSAGES.NOT_FOUND);
    }
    return this.set(session, kind, null);
  }

  private async set(session: IDiningSession, kind: ServiceRequestKind, at: Date | null): Promise<IServiceRequest> {
    const updated = await this.diningSessionRepository.update(session.id, { [FIELD[kind]]: at });
    const table = updated.tableId ? await this.diningTableRepository.findById(updated.tableId) : null;
    const floor = updated.floorId ? await this.floorRepository.findById(updated.floorId) : null;
    const request: IServiceRequest = {
      sessionId: updated.id,
      restaurantId: updated.restaurantId,
      branchId: updated.branchId,
      label: table?.name ?? floor?.name ?? "Table",
      waiterCalledAt: updated.waiterCalledAt,
      billRequestedAt: updated.billRequestedAt,
    };
    this.eventEmitter.emit("service.requested", request);
    return request;
  }
}
