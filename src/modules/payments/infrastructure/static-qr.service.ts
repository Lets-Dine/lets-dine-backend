import { Injectable } from "@nestjs/common";
import { BadRequestException } from "../../../common/exceptions";
import { PrismaService } from "../../../common/prisma";

const NOT_CONFIGURED = { key: "STATIC_QR_NOT_CONFIGURED", message: "This restaurant hasn't set up a payment QR" };

export interface IStaticQr {
  /** The saved picture, even while the mode is off, so settings can still show it. */
  imageUrl: string | null;
  enabled: boolean;
}

/** The restaurant's uploaded payment QR. One picture, shown as-is at the till. */
@Injectable()
export class StaticQrService {
  constructor(private readonly prisma: PrismaService) {}

  async get(restaurantId: string): Promise<IStaticQr> {
    const row = await this.prisma.restaurantStaticQr.findUnique({ where: { restaurantId } });
    return { imageUrl: row?.imageUrl ?? null, enabled: row?.enabled ?? false };
  }

  /** Saving a picture turns the mode on. Replacing the picture keeps that. */
  async save(restaurantId: string, imageUrl: string): Promise<IStaticQr> {
    await this.prisma.restaurantStaticQr.upsert({
      where: { restaurantId },
      create: { restaurantId, imageUrl, enabled: true },
      update: { imageUrl, enabled: true },
    });
    return this.get(restaurantId);
  }

  async setEnabled(restaurantId: string, enabled: boolean): Promise<IStaticQr> {
    const { count } = await this.prisma.restaurantStaticQr.updateMany({ where: { restaurantId }, data: { enabled } });
    if (!count) throw new BadRequestException(NOT_CONFIGURED);
    return this.get(restaurantId);
  }
}
