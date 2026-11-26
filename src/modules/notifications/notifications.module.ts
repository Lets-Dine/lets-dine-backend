import { Module } from "@nestjs/common";
import { NotificationListener } from "./application/notification.listener";
import { NotificationService } from "./application/notification.service";
import { PushService } from "./application/push.service";
import { DeviceController } from "./interfaces/http/device.controller";

@Module({
  controllers: [DeviceController],
  providers: [PushService, NotificationService, NotificationListener],
  exports: [NotificationService],
})
export class NotificationsModule {}
