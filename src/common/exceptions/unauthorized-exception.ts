import { DomainException, IDomainException } from "./domain-exception";

export class UnauthorizedException extends DomainException {
  constructor(exception: IDomainException) {
    super(exception.message, exception);
    Object.setPrototypeOf(this, UnauthorizedException.prototype);
  }
}
