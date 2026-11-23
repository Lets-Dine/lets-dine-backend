import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { AuthGuard, AuthUser } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { NotificationService } from "../../application/notification.service";

const registerDeviceSchema = z.object({
  token: z.string().trim().min(20).max(4096),
  platform: z.enum(["android", "ios"]),
});
const unregisterDeviceSchema = z.object({ token: z.string().trim().min(20).max(4096) });

class RegisterDeviceDto extends createZodDto(registerDeviceSchema) {}
class UnregisterDeviceDto extends createZodDto(unregisterDeviceSchema) {}

const DONE = { key: "DEVICE_SAVED", message: "Device saved" };

/** A staff phone telling us where to send pushes. Any signed-in member may register their own. */
@Controller("restaurant/devices")
export class DeviceController {
  constructor(private readonly notifications: NotificationService) {}

  @Post()
  @UseGuards(AuthGuard)
  async register(@Body() dto: RegisterDeviceDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<null>> {
    await this.notifications.register(authEntity, dto.token, dto.platform);
    return buildHttpResponse(null, DONE);
  }

  @Post("unregister")
  @UseGuards(AuthGuard)
  async unregister(@Body() dto: UnregisterDeviceDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<null>> {
    await this.notifications.unregister(authEntity, dto.token);
    return buildHttpResponse(null, DONE);
  }
}
