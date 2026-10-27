import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test } from "@nestjs/testing";
import { KitchenStation } from "@prisma/client";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { PrintJobRepository } from "../../../domain/repositories/print-job.repository";
import { BranchRepository } from "../../../../branches/domain/repositories/branch.repository";
import { KitchenTicketRepository } from "../../../domain/repositories/kitchen-ticket.repository";
import { FetchUnacknowledgedTicketsUsecase } from "../fetch-unacknowledged-tickets.usecase";
import { KITCHEN_TICKET_UPDATED } from "../../kitchen-ticket.service";
import { DismissKitchenTicketWarningUsecase } from "../dismiss-kitchen-ticket-warning.usecase";
import { AcknowledgeKitchenTicketUsecase } from "../acknowledge-kitchen-ticket.usecase";
import { FetchKitchenTicketsUsecase } from "../fetch-kitchen-tickets.usecase";

const authUser = buildAuthEntity();

describe("kitchen ticket use cases", () => {
  let repo: {
    findOpenByBranch: jest.Mock;
    findUnacknowledged: jest.Mock;
    findById: jest.Mock;
    acknowledge: jest.Mock;
    dismissWarning: jest.Mock;
  };
  let dismiss: DismissKitchenTicketWarningUsecase;
  let printJobs: { findPendingTicketIds: jest.Mock };
  let branches: { findById: jest.Mock };
  let fetchUnacked: FetchUnacknowledgedTicketsUsecase;
  let events: { emit: jest.Mock };
  let fetchTickets: FetchKitchenTicketsUsecase;
  let acknowledge: AcknowledgeKitchenTicketUsecase;

  beforeEach(async () => {
    repo = {
      findOpenByBranch: jest.fn(),
      findUnacknowledged: jest.fn(),
      findById: jest.fn(),
      acknowledge: jest.fn(),
      dismissWarning: jest.fn(),
    };
    printJobs = { findPendingTicketIds: jest.fn().mockResolvedValue([]) };
    branches = { findById: jest.fn() };
    events = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        FetchKitchenTicketsUsecase,
        AcknowledgeKitchenTicketUsecase,
        FetchUnacknowledgedTicketsUsecase,
        DismissKitchenTicketWarningUsecase,
        { provide: PrintJobRepository, useValue: printJobs },
        { provide: BranchRepository, useValue: branches },
        { provide: KitchenTicketRepository, useValue: repo },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    fetchTickets = module.get(FetchKitchenTicketsUsecase);
    acknowledge = module.get(AcknowledgeKitchenTicketUsecase);
    fetchUnacked = module.get(FetchUnacknowledgedTicketsUsecase);
    dismiss = module.get(DismissKitchenTicketWarningUsecase);
  });

  it("loads only the token's own branch for the requested station", async () => {
    repo.findOpenByBranch.mockResolvedValue([]);
    await fetchTickets.execute(KitchenStation.BAR, authUser);
    expect(repo.findOpenByBranch).toHaveBeenCalledWith(authUser.branchId, KitchenStation.BAR);
  });

  it("warns only about stations the branch says have a device", async () => {
    branches.findById.mockResolvedValue({
      id: authUser.branchId,
      restaurantId: authUser.restaurantId,
      ackStations: [KitchenStation.KITCHEN],
    });
    repo.findUnacknowledged.mockResolvedValue([{ id: "t", station: KitchenStation.KITCHEN }]);
    expect(await fetchUnacked.execute(authUser)).toEqual([{ id: "t", station: KitchenStation.KITCHEN, unconfirmed: "screen" }]);
    expect(repo.findUnacknowledged).toHaveBeenCalledWith(authUser.branchId, [KitchenStation.KITCHEN], []);
  });

  it("warns about nothing for another restaurant's branch", async () => {
    branches.findById.mockResolvedValue({ id: authUser.branchId, restaurantId: "other", ackStations: [KitchenStation.BAR] });
    expect(await fetchUnacked.execute(authUser)).toEqual([]);
    expect(repo.findUnacknowledged).not.toHaveBeenCalled();
  });

  it("404s on another branch's ticket", async () => {
    repo.findById.mockResolvedValue({ id: "t", branchId: "someone-else", acknowledgedAt: null });
    await expect(acknowledge.execute("t", authUser)).rejects.toThrow(NotFoundException);
    expect(repo.acknowledge).not.toHaveBeenCalled();
  });

  it("acknowledges once and tells the station's screens", async () => {
    repo.findById.mockResolvedValue({ id: "t", branchId: authUser.branchId, acknowledgedAt: null });
    repo.acknowledge.mockResolvedValue({ id: "t", acknowledgedAt: new Date() });
    await acknowledge.execute("t", authUser);
    expect(events.emit).toHaveBeenCalledWith(KITCHEN_TICKET_UPDATED, expect.objectContaining({ id: "t" }));
  });

  it("a second tap changes nothing and says nothing", async () => {
    repo.findById.mockResolvedValue({ id: "t", branchId: authUser.branchId, acknowledgedAt: new Date() });
    await acknowledge.execute("t", authUser);
    expect(repo.acknowledge).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("also warns about a ticket whose slip is still waiting on a printer, even on a station with no screen", async () => {
    branches.findById.mockResolvedValue({ id: authUser.branchId, restaurantId: authUser.restaurantId, ackStations: [] });
    printJobs.findPendingTicketIds.mockResolvedValue(["t9"]);
    repo.findUnacknowledged.mockResolvedValue([]);
    await fetchUnacked.execute(authUser);
    expect(repo.findUnacknowledged).toHaveBeenCalledWith(authUser.branchId, [], ["t9"]);
  });

  it("dismissing a warning hides it for that branch's ticket only, without acknowledging it", async () => {
    repo.findById.mockResolvedValue({ id: "t", branchId: authUser.branchId });
    await dismiss.execute("t", authUser);
    expect(repo.dismissWarning).toHaveBeenCalledWith("t", expect.any(Date));
    expect(repo.acknowledge).not.toHaveBeenCalled();

    repo.findById.mockResolvedValue({ id: "t", branchId: "someone-else" });
    await expect(dismiss.execute("t", authUser)).rejects.toThrow(NotFoundException);
  });
});
