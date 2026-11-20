import { Body, Controller, Get, Patch, Put, UseGuards } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { StaticQrService } from "../../infrastructure/static-qr.service";

const saveSchema = z.object({
  imageUrl: z
    .string()
    .trim()
    .url()
    .max(2000)
    .refine(url => url.startsWith("https://"), { message: "QR image must be an https URL" }),
});
const enabledSchema = z.object({ enabled: z.boolean() });

class SaveStaticQrDto extends createZodDto(saveSchema) {}
class SetStaticQrEnabledDto extends createZodDto(enabledSchema) {}

const READ = { key: "STATIC_QR", message: "Payment QR" };
const SAVED = { key: "STATIC_QR_SAVED", message: "Payment QR saved" };

@Controller("restaurant/static-qr")
@UseGuards(AuthGuard, AbilityGuard)
export class StaticQrController {
  constructor(private readonly staticQr: StaticQrService) {}

  /** Cashiers need the picture at the till; settings is who uploads it. */
  @Get()
  @CheckPolicies(checkPermissionRules([["payments:view"], ["settings:view"]]))
  async get(@AuthUser() auth: AuthEntity) {
    return buildHttpResponse(await this.staticQr.get(auth.restaurantId), READ);
  }

  @Put()
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async save(@Body() dto: SaveStaticQrDto, @AuthUser() auth: AuthEntity) {
    return buildHttpResponse(await this.staticQr.save(auth.restaurantId, dto.imageUrl), SAVED);
  }

  @Patch()
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async setEnabled(@Body() dto: SetStaticQrEnabledDto, @AuthUser() auth: AuthEntity) {
    return buildHttpResponse(await this.staticQr.setEnabled(auth.restaurantId, dto.enabled), SAVED);
  }
}
