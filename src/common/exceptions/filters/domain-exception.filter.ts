import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { BadRequestException, ConflictException, DomainException, ForbiddenException, NotFoundException, UnauthorizedException } from "../";

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const statusCode = this.getStatusCode(exception);
    const response = host.switchToHttp().getResponse<Response>();

    return response.status(statusCode).json({
      data: null,
      statusCode,
      timestamp: new Date(),
      error: { message: exception.message, key: exception.exception.key, details: exception.exception.detail },
    });
  }

  private getStatusCode(exception: DomainException): number {
    if (exception instanceof ConflictException) return HttpStatus.CONFLICT;
    if (exception instanceof ForbiddenException) return HttpStatus.FORBIDDEN;
    if (exception instanceof UnauthorizedException) return HttpStatus.UNAUTHORIZED;
    if (exception instanceof NotFoundException) return HttpStatus.NOT_FOUND;
    if (exception instanceof BadRequestException) return HttpStatus.BAD_REQUEST;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
