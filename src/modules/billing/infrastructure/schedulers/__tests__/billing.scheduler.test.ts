import { Test, TestingModule } from "@nestjs/testing";
import { SCHEDULE_CRON_OPTIONS } from "@nestjs/schedule/dist/schedule.constants";
import { RollComplimentaryPeriodsUsecase } from "../../../application/use-cases/roll-complimentary-periods.usecase";
import { RunLifecycleUsecase } from "../../../application/use-cases/run-lifecycle.usecase";
import { BillingScheduler } from "../billing.scheduler";

const NOW = new Date("2026-03-28T20:00:00.000Z");
const rolled = { rolled: 1 };
const lifecycle = { checked: 4, transitions: [{ subscriptionId: "sub-1" }] } as any;

describe("BillingScheduler", () => {
  let scheduler: BillingScheduler;
  let rollComplimentary: jest.Mocked<RollComplimentaryPeriodsUsecase>;
  let runLifecycle: jest.Mocked<RunLifecycleUsecase>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingScheduler,
        { provide: RollComplimentaryPeriodsUsecase, useValue: { execute: jest.fn().mockResolvedValue(rolled) } },
        { provide: RunLifecycleUsecase, useValue: { execute: jest.fn().mockResolvedValue(lifecycle) } },
      ],
    }).compile();

    scheduler = module.get(BillingScheduler);
    rollComplimentary = module.get(RollComplimentaryPeriodsUsecase);
    runLifecycle = module.get(RunLifecycleUsecase);
    jest.spyOn(scheduler["logger"], "log").mockImplementation();
    jest.spyOn(scheduler["logger"], "warn").mockImplementation();
    jest.spyOn(scheduler["logger"], "error").mockImplementation();
  });

  afterEach(() => {
    delete process.env.BILLING_SCHEDULER_ENABLED;
  });

  describe("schedule", () => {
    it("should be registered as a daily 02:00 job in the restaurants' timezone", () => {
      // Act
      const options = Reflect.getMetadata(SCHEDULE_CRON_OPTIONS, BillingScheduler.prototype.handleDailyCycle);

      // Assert
      expect(options).toMatchObject({ name: "billing-daily-cycle", timeZone: "Asia/Kathmandu" });
      expect(options.cronTime).toBe("0 2 * * *");
    });
  });

  describe("runCycle", () => {
    it("should extend complimentary plans before sweeping the lifecycle, so a free plan renews before it could be marked overdue", async () => {
      // Arrange
      const order: string[] = [];
      rollComplimentary.execute.mockImplementation(async () => (order.push("rolled"), rolled));
      runLifecycle.execute.mockImplementation(async () => (order.push("lifecycle"), lifecycle));

      // Act
      await scheduler.runCycle(NOW);

      // Assert
      expect(order).toEqual(["rolled", "lifecycle"]);
    });

    it("should run both steps against the same moment and return what they did", async () => {
      // Act
      const result = await scheduler.runCycle(NOW);

      // Assert
      expect(rollComplimentary.execute).toHaveBeenCalledWith(NOW);
      expect(runLifecycle.execute).toHaveBeenCalledWith(NOW);
      expect(result).toEqual({ rolled, lifecycle, errors: [] });
    });

    it("should still sweep the lifecycle when complimentary renewal fails, and report the failure", async () => {
      // Arrange
      rollComplimentary.execute.mockRejectedValue(new Error("db down"));

      // Act
      const result = await scheduler.runCycle(NOW);

      // Assert
      expect(runLifecycle.execute).toHaveBeenCalled();
      expect(result.rolled).toBeNull();
      expect(result.lifecycle).toBe(lifecycle);
      expect(result.errors).toEqual(["complimentary renewal: db down"]);
    });

    it("should still have extended complimentary plans when the lifecycle sweep fails", async () => {
      // Arrange
      runLifecycle.execute.mockRejectedValue(new Error("boom"));

      // Act
      const result = await scheduler.runCycle(NOW);

      // Assert
      expect(result.rolled).toBe(rolled);
      expect(result.lifecycle).toBeNull();
      expect(result.errors).toEqual(["lifecycle sweep: boom"]);
    });

    it("should not throw even when both steps fail, so one bad night never kills the schedule", async () => {
      // Arrange
      rollComplimentary.execute.mockRejectedValue(new Error("a"));
      runLifecycle.execute.mockRejectedValue(new Error("b"));

      // Act & Assert
      await expect(scheduler.runCycle(NOW)).resolves.toMatchObject({ errors: ["complimentary renewal: a", "lifecycle sweep: b"] });
    });

    it("should skip a run that starts while the previous one is still going, then allow the next", async () => {
      // Arrange
      let release: () => void = () => undefined;
      rollComplimentary.execute.mockReturnValueOnce(
        new Promise(resolve => {
          release = () => resolve(rolled);
        })
      );

      // Act
      const first = scheduler.runCycle(NOW);
      const overlapping = await scheduler.runCycle(NOW);
      release();
      await first;
      const after = await scheduler.runCycle(NOW);

      // Assert
      expect(overlapping).toEqual({ rolled: null, lifecycle: null, errors: [] });
      expect(rollComplimentary.execute).toHaveBeenCalledTimes(2);
      expect(after.rolled).toBe(rolled);
    });
  });

  describe("handleDailyCycle", () => {
    it("should run the cycle on the schedule", async () => {
      // Act
      await scheduler.handleDailyCycle();

      // Assert
      expect(rollComplimentary.execute).toHaveBeenCalledTimes(1);
      expect(runLifecycle.execute).toHaveBeenCalledTimes(1);
    });

    it("should do nothing when BILLING_SCHEDULER_ENABLED is false, so only one instance need run it", async () => {
      // Arrange
      process.env.BILLING_SCHEDULER_ENABLED = "false";

      // Act
      await scheduler.handleDailyCycle();

      // Assert
      expect(rollComplimentary.execute).not.toHaveBeenCalled();
      expect(runLifecycle.execute).not.toHaveBeenCalled();
    });
  });
});
