import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { KitchenTicketRepository } from "../../../domain/repositories/kitchen-ticket.repository";
import { PrintJobRepository } from "../../../domain/repositories/print-job.repository";
import { KITCHEN_TICKET_UPDATED } from "../../kitchen-ticket.service";
import { ClaimPrintJobUsecase, CompletePrintJobUsecase, FailPrintJobUsecase } from "../print-jobs.usecases";

const authUser = buildAuthEntity();

describe("print job use cases", () => {
  let jobs: { findRowById: jest.Mock; claim: jest.Mock; complete: jest.Mock; fail: jest.Mock };
  let tickets: { markPrintedMany: jest.Mock; findManyByIds: jest.Mock };
  let events: { emit: jest.Mock };
  let claim: ClaimPrintJobUsecase;
  let complete: CompletePrintJobUsecase;
  let fail: FailPrintJobUsecase;

  beforeEach(async () => {
    jobs = { findRowById: jest.fn(), claim: jest.fn(), complete: jest.fn(), fail: jest.fn() };
    tickets = { markPrintedMany: jest.fn(), findManyByIds: jest.fn().mockResolvedValue([{ id: "t1" }]) };
    events = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ClaimPrintJobUsecase,
        CompletePrintJobUsecase,
        FailPrintJobUsecase,
        { provide: PrintJobRepository, useValue: jobs },
        { provide: KitchenTicketRepository, useValue: tickets },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    claim = module.get(ClaimPrintJobUsecase);
    complete = module.get(CompletePrintJobUsecase);
    fail = module.get(FailPrintJobUsecase);
  });

  const own = (over = {}) =>
    jobs.findRowById.mockResolvedValue({ id: "j", branchId: authUser.branchId, printedAt: null, ticketIds: ["t1"], ...over });

  it("only the caller that wins the claim may print", async () => {
    own();
    jobs.claim.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await claim.execute("j", "claimant-1", authUser)).toEqual({ claimed: true });
    expect(await claim.execute("j", "claimant-1", authUser)).toEqual({ claimed: false });
  });

  it("404s on another branch's job, for every action", async () => {
    own({ branchId: "someone-else" });
    await expect(claim.execute("j", "claimant-1", authUser)).rejects.toThrow(NotFoundException);
    await expect(complete.execute("j", authUser)).rejects.toThrow(NotFoundException);
    await expect(fail.execute("j", "claimant-1", "boom", authUser)).rejects.toThrow(NotFoundException);
  });

  it("completing marks the job and its tickets printed, and tells the screens", async () => {
    own();
    await complete.execute("j", authUser);
    expect(jobs.complete).toHaveBeenCalled();
    expect(tickets.markPrintedMany).toHaveBeenCalledWith(["t1"], expect.any(Date));
    expect(events.emit).toHaveBeenCalledWith(KITCHEN_TICKET_UPDATED, { id: "t1" });
  });

  it("completing again still re-marks the tickets (a failed first attempt must be able to finish), but says nothing twice", async () => {
    own({ printedAt: new Date() });
    await complete.execute("j", authUser);
    expect(tickets.markPrintedMany).toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("a failure records the error and releases the claim", async () => {
    own();
    await fail.execute("j", "claimant-1", "printer offline", authUser);
    expect(jobs.fail).toHaveBeenCalledWith("j", "claimant-1", "printer offline");
  });
});
