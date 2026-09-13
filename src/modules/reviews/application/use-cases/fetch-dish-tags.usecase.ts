import { Injectable } from "@nestjs/common";
import { IDishTag } from "../../domain/interfaces/dish-tag.interface";
import { DishTagRepository } from "../../domain/repositories/dish-tag.repository";

/** The review flow asks for the vocabulary rather than hardcoding it client-side. */
@Injectable()
export class FetchDishTagsUsecase {
  constructor(private readonly dishTagRepository: DishTagRepository) {}

  async execute(): Promise<IDishTag[]> {
    return this.dishTagRepository.fetchActive();
  }
}
