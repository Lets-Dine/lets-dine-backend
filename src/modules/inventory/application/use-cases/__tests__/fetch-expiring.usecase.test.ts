import { Test } from "@nestjs/testing";
import { buildAuthEntity } from "../../../../../common/testing";
import { InventoryRepository } from "../../../domain/repositories/inventory.repository";
import { FetchExpiringUsecase } from "../fetch-expiring.usecase";

describe("FetchExpiringUsecase", () => {
  afterEach(() => jest.useRealTimers());

  it("cuts off at the end of the branch's day plus `days`, so today's expiries are still listed", async () => {
    // 20:00 UTC on the 16th is already the 17th in Kathmandu (+05:45).
    jest.useFakeTimers().setSystemTime(new Date("2026-10-16T20:00:00Z"));
    const repo = { findBranchTimezone: jest.fn().mockResolvedValue("Asia/Kathmandu"), findExpiringLots: jest.fn().mockResolvedValue([]) };
    const module = await Test.createTestingModule({
      providers: [FetchExpiringUsecase, { provide: InventoryRepository, useValue: repo }],
    }).compile();

    await module.get(FetchExpiringUsecase).execute({ days: 2 }, buildAuthEntity());

    // today = 17th, so lots expiring on the 17th..19th (before midnight of the 20th) qualify.
    expect(repo.findExpiringLots).toHaveBeenCalledWith(expect.any(String), new Date("2026-10-20T00:00:00Z"));
  });
});
