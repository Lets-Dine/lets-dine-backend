import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { DELIVERY_ERROR_MESSAGES } from "../../domain/constants";
import { IStatementPage } from "../../domain/interfaces/delivery.interface";
import { CourierKind, DeliveryRepository, IStatementCursor } from "../../domain/repositories/delivery.repository";
import { StatementQuery } from "../../interfaces/http/validations/statement-query.validation";

/** `at|rank|id`, as `IStatementPage.nextCursor` hands it out. */
export function parseStatementCursor(raw: string): IStatementCursor | null {
  const [at, rank, id] = raw.split("|");
  const date = new Date(at ?? "");
  const position = Number(rank);
  if (Number.isNaN(date.getTime()) || (position !== 0 && position !== 1) || !id) return null;
  return { at: date, rank: position, id };
}

/** One page of a courier's transactions, newest first, each with the balance after it. */
@Injectable()
export class GetCourierStatementUsecase {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async execute(kind: CourierKind, id: string, query: StatementQuery, authEntity: AuthEntity): Promise<IStatementPage> {
    const cursor = query.cursor ? parseStatementCursor(query.cursor) : undefined;
    if (cursor === null) throw new BadRequestException(DELIVERY_ERROR_MESSAGES.INVALID_CURSOR);
    const page = await this.deliveryRepository.fetchStatement(
      { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId },
      kind,
      id,
      { limit: query.limit, cursor }
    );
    if (!page)
      throw new NotFoundException(kind === "PARTNER" ? DELIVERY_ERROR_MESSAGES.PARTNER_NOT_FOUND : DELIVERY_ERROR_MESSAGES.RIDER_NOT_FOUND);
    return page;
  }
}
