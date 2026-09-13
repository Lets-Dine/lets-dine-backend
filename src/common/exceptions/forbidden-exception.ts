import { DomainException, IDomainException } from "./domain-exception";

export class ForbiddenException extends DomainException {
  constructor(exception: IDomainException) {
    super(exception.message, exception);
    Object.setPrototypeOf(this, ForbiddenException.prototype);
  }
}
