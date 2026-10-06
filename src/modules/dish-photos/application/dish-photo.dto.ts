import { createZodDto } from "nestjs-zod";
import {
  createDishPhotoSchema,
  suggestDishPhotosSchema,
  updateDishPhotoGroupSchema,
} from "../interfaces/http/validations/dish-photo.validation";

export class CreateDishPhotoDto extends createZodDto(createDishPhotoSchema) {}
export class SuggestDishPhotosDto extends createZodDto(suggestDishPhotosSchema) {}
export class UpdateDishPhotoGroupDto extends createZodDto(updateDishPhotoGroupSchema) {}
