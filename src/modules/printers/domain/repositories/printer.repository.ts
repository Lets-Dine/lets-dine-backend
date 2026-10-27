import { PrismaTransaction } from "../../../../common/prisma";
import { IPrinter } from "../interfaces/printer.interface";

export type IPrinterCreate = Pick<IPrinter, "branchId" | "name" | "ipAddress"> &
  Partial<Omit<IPrinter, "id" | "branchId" | "name" | "ipAddress" | "createdAt" | "updatedAt">>;
export type IPrinterUpdate = Partial<Omit<IPrinterCreate, "branchId">>;

export interface PrinterFetchOptions {
  tx?: PrismaTransaction;
}

export abstract class PrinterRepository {
  abstract findById(id: string, options?: PrinterFetchOptions): Promise<IPrinter | null>;
  abstract findByName(branchId: string, name: string, options?: PrinterFetchOptions): Promise<IPrinter | null>;
  abstract findByBranch(branchId: string, options?: PrinterFetchOptions & { activeOnly?: boolean }): Promise<IPrinter[]>;
  abstract create(data: IPrinterCreate, options?: PrinterFetchOptions): Promise<IPrinter>;
  abstract update(id: string, data: IPrinterUpdate, options?: PrinterFetchOptions): Promise<IPrinter>;
  /** Slips queued for a printer that is being switched off — it must not wake up to a backlog later. */
  abstract dropPendingJobs(printerId: string, options?: PrinterFetchOptions): Promise<void>;
  abstract delete(id: string, options?: PrinterFetchOptions): Promise<void>;
}
