import { DishPhotosService } from "../dish-photos.service";

const photo = (name: string, tags: string[] = []) => ({ id: name, name, tags, imageUrl: `https://img/${name}.jpg`, createdAt: new Date() });

const serviceWith = (photos: ReturnType<typeof photo>[]) => new DishPhotosService({ dishPhoto: { findMany: async () => photos } } as never);

describe("DishPhotosService.suggest", () => {
  const service = serviceWith([photo("Momo", ["dumpling"]), photo("Chicken Chowmein"), photo("Noodles", ["dumpling soup"])]);
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
  it("matches on a tag, after matches on the name", async () => {
    expect(await names("Pork Dumpling")).toEqual(["Momo"]);
  });
  it("ranks a name match ahead of a tag match", async () => {
    const ranked = serviceWith([photo("Soup", ["noodles"]), photo("Noodles")]);
    expect((await ranked.suggest("Noodles")).map(p => p.name)).toEqual(["Noodles", "Soup"]);
  });
  it("returns nothing for an unrelated dish", async () => {
    expect(await names("Pizza")).toEqual([]);
  });
});
