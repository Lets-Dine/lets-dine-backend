import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../../common/prisma";
import { BranchMenuRepository, IMenuCopyResult } from "../../domain/repositories/branch-menu.repository";

@Injectable()
class BranchMenuRepositoryImpl implements BranchMenuRepository {
  constructor(private prisma: PrismaService) {}

  async isMenuEmpty(branchId: string): Promise<boolean> {
    const [categories, dishes, addOns] = await Promise.all([
      this.prisma.menuCategory.count({ where: { branchId } }),
      this.prisma.dish.count({ where: { branchId } }),
      this.prisma.addOn.count({ where: { branchId } }),
    ]);
    return categories + dishes + addOns === 0;
  }

  async copyMenu(fromBranchId: string, toBranchId: string, actorId: string): Promise<IMenuCopyResult> {
    return this.prisma.$transaction(async tx => {
      const to = await tx.branch.findUniqueOrThrow({ where: { id: toBranchId }, select: { restaurantId: true } });
      const audit = { createdBy: actorId, updatedBy: actorId };

      const [categories, addOns, dishes] = await Promise.all([
        tx.menuCategory.findMany({ where: { branchId: fromBranchId } }),
        tx.addOn.findMany({ where: { branchId: fromBranchId, isArchived: false } }),
        tx.dish.findMany({
          where: { branchId: fromBranchId, isArchived: false },
          include: { variants: { where: { isArchived: false } }, addOnLinks: true },
        }),
      ]);

      const categoryIds = new Map(categories.map(category => [category.id, randomUUID()]));
      const addOnIds = new Map(addOns.map(addOn => [addOn.id, randomUUID()]));

      await tx.menuCategory.createMany({
        data: categories.map(({ id, branchId: _b, restaurantId: _r, createdAt: _c, updatedAt: _u, ...rest }) => ({
          ...rest,
          id: categoryIds.get(id) as string,
          restaurantId: to.restaurantId,
          branchId: toBranchId,
          ...audit,
        })),
      });
      await tx.addOn.createMany({
        data: addOns.map(({ id, branchId: _b, restaurantId: _r, createdAt: _c, updatedAt: _u, ...rest }) => ({
          ...rest,
          id: addOnIds.get(id) as string,
          restaurantId: to.restaurantId,
          branchId: toBranchId,
          ...audit,
        })),
      });

      const dishIds = new Map(dishes.map(dish => [dish.id, randomUUID()]));
      // A dish can only sit in a section of its own branch, so its category is always in the map.
      await tx.dish.createMany({
        data: dishes.map(
          ({ id, categoryId, variants: _v, addOnLinks: _l, branchId: _b, restaurantId: _r, createdAt: _c, updatedAt: _u, ...rest }) => ({
            ...rest,
            id: dishIds.get(id) as string,
            categoryId: categoryIds.get(categoryId) as string,
            restaurantId: to.restaurantId,
            branchId: toBranchId,
            ...audit,
          })
        ),
      });

      const variants = dishes.flatMap(dish =>
        dish.variants.map(({ id: _id, dishId, createdAt: _c, updatedAt: _u, ...rest }) => ({
          ...rest,
          dishId: dishIds.get(dishId) as string,
          ...audit,
        }))
      );
      await tx.dishVariant.createMany({ data: variants });

      const links = dishes.flatMap(dish =>
        dish.addOnLinks
          .filter(link => addOnIds.has(link.addOnId))
          .map(link => ({ dishId: dishIds.get(dish.id) as string, addOnId: addOnIds.get(link.addOnId) as string }))
      );
      await tx.dishAddOn.createMany({ data: links });

      return { categories: categories.length, dishes: dishes.length, variants: variants.length, addOns: addOns.length };
    });
  }
}

export default BranchMenuRepositoryImpl;
