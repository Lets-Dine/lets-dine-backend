import { DomainException, IDomainException } from "./domain-exception";

export class ConflictException extends DomainException {
  constructor(exception: IDomainException) {
    super(exception.message, exception);
    Object.setPrototypeOf(this, ConflictException.prototype);
  }
}
