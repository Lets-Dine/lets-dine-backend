import { Module } from "@nestjs/common";
import { DishMarginRepository } from "./infrastructure/dish-margin.repository";
import { DishMarginController } from "./interfaces/http/dish-margin.controller";

@Module({ controllers: [DishMarginController], providers: [DishMarginRepository] })
export class DishMarginsModule {}
