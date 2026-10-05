import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../common/exceptions";
import { PrismaService } from "../../../common/prisma";
import { DISH_PHOTO_MESSAGES } from "../dish-photos.constants";

export interface IDishPhoto {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: Date;
}

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * The platform's shared photo library. Matching is by words: a photo named "Momo"
 * suits "Chicken Momo" and "Momo (steamed)" — every word of the photo's name must
 * appear in the dish name, or the dish name's words must all appear in the photo's.
 */
@Injectable()
export class DishPhotosService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<IDishPhoto[]> {
    return this.prisma.dishPhoto.findMany({ orderBy: [{ name: "asc" }, { createdAt: "asc" }] });
  }

  create(input: { name: string; imageUrl: string }): Promise<IDishPhoto> {
    return this.prisma.dishPhoto.create({ data: input });
  }

  async remove(id: string): Promise<void> {
    const found = await this.prisma.dishPhoto.deleteMany({ where: { id } });
    if (found.count === 0) throw new NotFoundException(DISH_PHOTO_MESSAGES.NOT_FOUND);
  }

  // ponytail: loads the whole library and filters in memory — fine for hundreds of photos, move to a search index past that.
  async suggest(name?: string): Promise<IDishPhoto[]> {
    const all = await this.list();
    const typed = words(name ?? "");
    if (typed.length === 0) return all;
    return all.filter(photo => {
      const label = words(photo.name);
      return label.every(w => typed.includes(w)) || typed.every(w => label.includes(w));
    });
  }
}
