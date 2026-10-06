import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../common/exceptions";
import { PrismaService } from "../../../common/prisma";
import { DISH_PHOTO_MESSAGES } from "../dish-photos.constants";

export interface IDishPhoto {
  id: string;
  name: string;
  imageUrl: string;
  tags: string[];
  createdAt: Date;
}

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** Every word of `label` appears in `typed`, or every word of `typed` appears in `label`. */
const matches = (label: string[], typed: string[]) => label.every(w => typed.includes(w)) || typed.every(w => label.includes(w));

/**
 * The platform's shared photo library. Matching is by words: a photo named "Momo"
 * suits "Chicken Momo" and "Momo (steamed)". Tags are alternate names, matched the
 * same way; a match on the name itself ranks ahead of one on a tag.
 */
@Injectable()
export class DishPhotosService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<IDishPhoto[]> {
    return this.prisma.dishPhoto.findMany({ orderBy: [{ name: "asc" }, { createdAt: "asc" }] });
  }

  create(input: { name: string; imageUrl: string; tags: string[] }): Promise<IDishPhoto> {
    return this.prisma.dishPhoto.create({ data: input });
  }

  /** Renames and retags every photo filed under `from` (any casing). Renaming onto an existing dish merges the two. */
  async updateGroup(input: { from: string; name: string; tags: string[] }): Promise<void> {
    const { count } = await this.prisma.dishPhoto.updateMany({
      where: { name: { equals: input.from, mode: "insensitive" } },
      data: { name: input.name, tags: input.tags },
    });
    if (count === 0) throw new NotFoundException(DISH_PHOTO_MESSAGES.NOT_FOUND);
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
    const byName = all.filter(photo => matches(words(photo.name), typed));
    const byTag = all.filter(photo => !byName.includes(photo) && photo.tags.some(tag => matches(words(tag), typed)));
    return [...byName, ...byTag];
  }
}
