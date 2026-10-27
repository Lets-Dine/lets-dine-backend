import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { ClaimPrintJobDto } from "../../application/dto/claim-print-job.dto";
import { FailPrintJobDto } from "../../application/dto/fail-print-job.dto";
import {
  ClaimPrintJobUsecase,
  CompletePrintJobUsecase,
  FailPrintJobUsecase,
  FetchPendingPrintJobsUsecase,
} from "../../application/use-cases/print-jobs.usecases";
import { ORDER_SUCCESS_MESSAGES } from "../../domain/constants";
import { IPrintJob } from "../../domain/interfaces/print-job.interface";

/** The printing PC's queue: fetch what is waiting, claim one, then report it printed or failed. */
@Controller("restaurant/print-jobs")
export class PrintJobController {
  constructor(
    private readonly fetchPending: FetchPendingPrintJobsUsecase,
    private readonly claim: ClaimPrintJobUsecase,
    private readonly complete: CompletePrintJobUsecase,
    private readonly fail: FailPrintJobUsecase
  ) {}

  @Get("/pending")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async pending(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IPrintJob[]>> {
    return buildHttpResponse(await this.fetchPending.execute(authEntity), ORDER_SUCCESS_MESSAGES.PRINT_JOBS_FETCHED);
  }

  @Post("/:id/claim")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async claimJob(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: ClaimPrintJobDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<{ claimed: boolean }>> {
    return buildHttpResponse(await this.claim.execute(id, dto.claimant, authEntity), ORDER_SUCCESS_MESSAGES.PRINT_JOB_UPDATED);
  }

  @Post("/:id/printed")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async printed(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<null>> {
    await this.complete.execute(id, authEntity);
    return buildHttpResponse(null, ORDER_SUCCESS_MESSAGES.PRINT_JOB_UPDATED);
  }

  @Post("/:id/failed")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async failed(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: FailPrintJobDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<null>> {
    await this.fail.execute(id, dto.claimant, dto.error, authEntity);
    return buildHttpResponse(null, ORDER_SUCCESS_MESSAGES.PRINT_JOB_UPDATED);
  }
}
