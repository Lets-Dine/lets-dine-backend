import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { CreatePrinterDto } from "../../application/dto/create-printer.dto";
import { UpdatePrinterDto } from "../../application/dto/update-printer.dto";
import { CreatePrinterUsecase } from "../../application/use-cases/create-printer.usecase";
import { DeletePrinterUsecase } from "../../application/use-cases/delete-printer.usecase";
import { FetchPrintersUsecase } from "../../application/use-cases/fetch-printers.usecase";
import { UpdatePrinterUsecase } from "../../application/use-cases/update-printer.usecase";
import { PRINTER_SUCCESS_MESSAGES } from "../../domain/constants";
import { IPrinter } from "../../domain/interfaces/printer.interface";

@Controller("restaurant/printers")
export class PrinterController {
  constructor(
    private readonly fetchPrintersUsecase: FetchPrintersUsecase,
    private readonly createPrinterUsecase: CreatePrinterUsecase,
    private readonly updatePrinterUsecase: UpdatePrinterUsecase,
    private readonly deletePrinterUsecase: DeletePrinterUsecase
  ) {}

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:view"]]))
  async fetchAll(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IPrinter[]>> {
    return buildHttpResponse(await this.fetchPrintersUsecase.execute(authEntity), PRINTER_SUCCESS_MESSAGES.PRINTERS_FETCHED);
  }

  @Post()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async create(@Body() dto: CreatePrinterDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IPrinter>> {
    return buildHttpResponse(await this.createPrinterUsecase.execute(dto, authEntity), PRINTER_SUCCESS_MESSAGES.PRINTER_CREATED);
  }

  @Patch("/:id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async update(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdatePrinterDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IPrinter>> {
    return buildHttpResponse(await this.updatePrinterUsecase.execute(id, dto, authEntity), PRINTER_SUCCESS_MESSAGES.PRINTER_UPDATED);
  }

  @Delete("/:id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["settings:edit"]]))
  async remove(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<null>> {
    await this.deletePrinterUsecase.execute(id, authEntity);
    return buildHttpResponse(null, PRINTER_SUCCESS_MESSAGES.PRINTER_DELETED);
  }
}
