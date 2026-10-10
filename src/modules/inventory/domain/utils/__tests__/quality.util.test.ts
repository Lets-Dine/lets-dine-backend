import { scoreLots } from "../quality.util";

const sample = (lotId: string, poor: boolean, ingredientId = "chicken") => ({ lotId, ingredientId, poor });
const many = (lotId: string, poorCount: number, total: number) => Array.from({ length: total }, (_, i) => sample(lotId, i < poorCount));

describe("scoreLots", () => {
  it("flags a lot far worse than the same ingredient's other lots", () => {
    const scores = scoreLots([...many("bad", 4, 6), ...many("fine", 1, 20)]);
    expect(scores.find(s => s.lotId === "bad")).toMatchObject({ reviewCount: 6, poorCount: 4, flagged: true });
    expect(scores.find(s => s.lotId === "fine")?.flagged).toBe(false);
  });

  it("does not flag a lot on too few reviews", () => {
    const scores = scoreLots([...many("thin", 2, 3), ...many("fine", 0, 20)]);
    expect(scores.find(s => s.lotId === "thin")?.flagged).toBe(false);
  });

  it("does not flag when the whole ingredient is equally unpopular", () => {
    const scores = scoreLots([...many("a", 3, 6), ...many("b", 3, 6)]);
    expect(scores.every(s => !s.flagged)).toBe(true);
  });

  it("judges each ingredient against its own baseline", () => {
    const scores = scoreLots([...many("c1", 4, 6), ...many("r1", 0, 20).map(s => ({ ...s, ingredientId: "rice" }))]);
    expect(scores.find(s => s.lotId === "c1")?.flagged).toBe(true);
    expect(scores.find(s => s.lotId === "r1")?.flagged).toBe(false);
  });
});
