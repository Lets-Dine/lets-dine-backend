import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../common/prisma";
import { IPrinter } from "../../domain/interfaces/printer.interface";
import { IPrinterCreate, IPrinterUpdate, PrinterFetchOptions, PrinterRepository } from "../../domain/repositories/printer.repository";

@Injectable()
class PrinterRepositoryImpl implements PrinterRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, options?: PrinterFetchOptions): Promise<IPrinter | null> {
    return (options?.tx ?? this.prisma).printer.findUnique({ where: { id } });
  }

  async findByName(branchId: string, name: string, options?: PrinterFetchOptions): Promise<IPrinter | null> {
    return (options?.tx ?? this.prisma).printer.findUnique({ where: { branchId_name: { branchId, name } } });
  }

  async findByBranch(branchId: string, options?: PrinterFetchOptions & { activeOnly?: boolean }): Promise<IPrinter[]> {
    return (options?.tx ?? this.prisma).printer.findMany({
      where: { branchId, ...(options?.activeOnly && { isActive: true }) },
      orderBy: { name: "asc" },
    });
  }

  async create(data: IPrinterCreate, options?: PrinterFetchOptions): Promise<IPrinter> {
    return (options?.tx ?? this.prisma).printer.create({ data });
  }

  async update(id: string, data: IPrinterUpdate, options?: PrinterFetchOptions): Promise<IPrinter> {
    return (options?.tx ?? this.prisma).printer.update({ where: { id }, data });
  }

  async dropPendingJobs(printerId: string, options?: PrinterFetchOptions): Promise<void> {
    await (options?.tx ?? this.prisma).printJob.deleteMany({ where: { printerId, printedAt: null } });
  }

  async delete(id: string, options?: PrinterFetchOptions): Promise<void> {
    await (options?.tx ?? this.prisma).printer.delete({ where: { id } });
  }
}

export default PrinterRepositoryImpl;
