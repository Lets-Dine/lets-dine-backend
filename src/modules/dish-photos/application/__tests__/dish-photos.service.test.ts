import { DishPhotosService } from "../dish-photos.service";

const photo = (name: string) => ({ id: name, name, imageUrl: `https://img/${name}.jpg`, createdAt: new Date() });

const serviceWith = (names: string[]) => new DishPhotosService({ dishPhoto: { findMany: async () => names.map(photo) } } as never);

describe("DishPhotosService.suggest", () => {
  const service = serviceWith(["Momo", "Chicken Chowmein", "Noodles"]);
  const names = async (typed?: string) => (await service.suggest(typed)).map(p => p.name);

  it("matches a photo name inside a longer dish name", async () => {
    expect(await names("Chicken Momo (steamed)")).toEqual(["Momo"]);
  });
  it("matches a partly typed dish name against a longer photo name", async () => {
    expect(await names("chowmein")).toEqual(["Chicken Chowmein"]);
  });
  it("returns the whole library when nothing is typed", async () => {
    expect(await names("  ")).toHaveLength(3);
  });
  it("returns nothing for an unrelated dish", async () => {
    expect(await names("Pizza")).toEqual([]);
  });
});
