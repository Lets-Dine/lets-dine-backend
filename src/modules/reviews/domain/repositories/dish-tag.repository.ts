import { PrismaTransaction } from "../../../../common/prisma";
import { IDishTag } from "../interfaces/dish-tag.interface";

export abstract class DishTagRepository {
  abstract fetchActive(options?: { tx?: PrismaTransaction }): Promise<IDishTag[]>;
  abstract findByLabels(labels: string[], options?: { tx?: PrismaTransaction }): Promise<IDishTag[]>;
}
