import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { COMMON_ERROR_MESSAGES } from "../constants/common-error-message";
import { BadRequestException } from "../exceptions";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Nest's own ParseUUIDPipe throws an HttpException, which would bypass
 * DomainExceptionFilter and answer in a different error shape than the rest of
 * the API. This one throws the domain exception instead.
 */
@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!UUID_PATTERN.test(value)) {
      throw new BadRequestException({
        ...COMMON_ERROR_MESSAGES.INVALID_UUID,
        detail: { param: metadata.data },
      });
    }
    return value;
  }
}
