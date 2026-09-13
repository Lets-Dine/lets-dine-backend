import { DomainException, IDomainException } from "./domain-exception";

export class BadRequestException extends DomainException {
  constructor(exception: IDomainException) {
    super(exception.message, exception);
    Object.setPrototypeOf(this, BadRequestException.prototype);
  }
}
