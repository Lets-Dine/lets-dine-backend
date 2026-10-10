import { Body, Controller, Get, Patch, Put, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { SetFonepayEnabledDto } from "../../application/dto/set-fonepay-enabled.dto";
import { SaveFonepayConfigDto } from "../../application/dto/save-fonepay-config.dto";
import { FonepayService } from "../../infrastructure/fonepay/fonepay.service";

@Controller("restaurant/fonepay")
@UseGuards(AuthGuard, AbilityGuard)
export class FonepayController {
  constructor(private readonly fonepay: FonepayService) {}

  @Get()
  @CheckPolicies(checkPermissionRules([["settings:view"]]))
  async get(@AuthUser() auth: AuthEntity) {
    return buildHttpResponse(await this.fonepay.getConfigSummary(auth.restaurantId), {
      key: "FONEPAY_SETTINGS",
      message: "Fonepay settings",
    });
  }

  @Put()
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async save(@Body() dto: SaveFonepayConfigDto, @AuthUser() auth: AuthEntity) {
    await this.fonepay.saveConfig(auth.restaurantId, dto);
    return buildHttpResponse(await this.fonepay.getConfigSummary(auth.restaurantId), {
      key: "FONEPAY_SETTINGS_SAVED",
      message: "Fonepay settings saved",
    });
  }

  @Patch()
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async setEnabled(@Body() dto: SetFonepayEnabledDto, @AuthUser() auth: AuthEntity) {
    await this.fonepay.setEnabled(auth.restaurantId, dto.enabled);
    return buildHttpResponse(await this.fonepay.getConfigSummary(auth.restaurantId), {
      key: "FONEPAY_SETTINGS_SAVED",
      message: "Fonepay settings saved",
    });
  }
}
