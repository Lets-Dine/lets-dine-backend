import { Module } from "@nestjs/common";
import { UploadsModule } from "../uploads/uploads.module";
import { DishPhotosService } from "./application/dish-photos.service";
import { PlatformDishPhotoController, RestaurantDishPhotoController } from "./interfaces/http/dish-photo.controllers";

@Module({
  imports: [UploadsModule],
  controllers: [PlatformDishPhotoController, RestaurantDishPhotoController],
  providers: [DishPhotosService],
})
export class DishPhotosModule {}
