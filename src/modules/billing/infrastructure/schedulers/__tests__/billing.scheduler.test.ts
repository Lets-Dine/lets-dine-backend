import { Test, TestingModule } from "@nestjs/testing";
import { SCHEDULE_CRON_OPTIONS } from "@nestjs/schedule/dist/schedule.constants";
import { GenerateInvoicesUsecase } from "../../../application/use-cases/generate-invoices.usecase";
import { RunLifecycleUsecase } from "../../../application/use-cases/run-lifecycle.usecase";
import { BillingScheduler } from "../billing.scheduler";

const NOW = new Date("2026-03-28T20:00:00.000Z");
const invoices = { generated: [{ id: "invoice-1" }], autoSettled: 0 } as any;
const lifecycle = { checked: 4, transitions: [{ subscriptionId: "sub-1" }] } as any;

describe("BillingScheduler", () => {
  let scheduler: BillingScheduler;
  let generateInvoices: jest.Mocked<GenerateInvoicesUsecase>;
  let runLifecycle: jest.Mocked<RunLifecycleUsecase>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingScheduler,
        { provide: GenerateInvoicesUsecase, useValue: { execute: jest.fn().mockResolvedValue(invoices) } },
        { provide: RunLifecycleUsecase, useValue: { execute: jest.fn().mockResolvedValue(lifecycle) } },
      ],
    }).compile();

    scheduler = module.get(BillingScheduler);
    generateInvoices = module.get(GenerateInvoicesUsecase);
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
    it("should issue invoices before sweeping the lifecycle, so a free plan renews before it could be marked overdue", async () => {
      // Arrange
      const order: string[] = [];
      generateInvoices.execute.mockImplementation(async () => (order.push("invoices"), invoices));
      runLifecycle.execute.mockImplementation(async () => (order.push("lifecycle"), lifecycle));

      // Act
      await scheduler.runCycle(NOW);

      // Assert
      expect(order).toEqual(["invoices", "lifecycle"]);
    });

    it("should run both steps against the same moment and return what they did", async () => {
      // Act
      const result = await scheduler.runCycle(NOW);

      // Assert
      expect(generateInvoices.execute).toHaveBeenCalledWith({}, NOW);
      expect(runLifecycle.execute).toHaveBeenCalledWith(NOW);
      expect(result).toEqual({ invoices, lifecycle, errors: [] });
    });

    it("should still sweep the lifecycle when invoice generation fails, and report the failure", async () => {
      // Arrange
      generateInvoices.execute.mockRejectedValue(new Error("db down"));

      // Act
      const result = await scheduler.runCycle(NOW);

      // Assert
      expect(runLifecycle.execute).toHaveBeenCalled();
      expect(result.invoices).toBeNull();
      expect(result.lifecycle).toBe(lifecycle);
      expect(result.errors).toEqual(["invoice generation: db down"]);
    });

    it("should still have issued invoices when the lifecycle sweep fails", async () => {
      // Arrange
      runLifecycle.execute.mockRejectedValue(new Error("boom"));

      // Act
      const result = await scheduler.runCycle(NOW);

      // Assert
      expect(result.invoices).toBe(invoices);
      expect(result.lifecycle).toBeNull();
      expect(result.errors).toEqual(["lifecycle sweep: boom"]);
    });

    it("should not throw even when both steps fail, so one bad night never kills the schedule", async () => {
      // Arrange
      generateInvoices.execute.mockRejectedValue(new Error("a"));
      runLifecycle.execute.mockRejectedValue(new Error("b"));

      // Act & Assert
      await expect(scheduler.runCycle(NOW)).resolves.toMatchObject({ errors: ["invoice generation: a", "lifecycle sweep: b"] });
    });

    it("should skip a run that starts while the previous one is still going, then allow the next", async () => {
      // Arrange
      let release: () => void = () => undefined;
      generateInvoices.execute.mockReturnValueOnce(
        new Promise(resolve => {
          release = () => resolve(invoices);
        })
      );

      // Act
      const first = scheduler.runCycle(NOW);
      const overlapping = await scheduler.runCycle(NOW);
      release();
      await first;
      const after = await scheduler.runCycle(NOW);

      // Assert
      expect(overlapping).toEqual({ invoices: null, lifecycle: null, errors: [] });
      expect(generateInvoices.execute).toHaveBeenCalledTimes(2);
      expect(after.invoices).toBe(invoices);
    });
  });

  describe("handleDailyCycle", () => {
    it("should run the cycle on the schedule", async () => {
      // Act
      await scheduler.handleDailyCycle();

      // Assert
      expect(generateInvoices.execute).toHaveBeenCalledTimes(1);
      expect(runLifecycle.execute).toHaveBeenCalledTimes(1);
    });

    it("should do nothing when BILLING_SCHEDULER_ENABLED is false, so only one instance need run it", async () => {
      // Arrange
      process.env.BILLING_SCHEDULER_ENABLED = "false";

      // Act
      await scheduler.handleDailyCycle();

      // Assert
      expect(generateInvoices.execute).not.toHaveBeenCalled();
      expect(runLifecycle.execute).not.toHaveBeenCalled();
    });
  });
});
