import { DomainException, IDomainException } from "./domain-exception";

export class NotFoundException extends DomainException {
  constructor(exception: IDomainException) {
    super(exception.message, exception);
    Object.setPrototypeOf(this, NotFoundException.prototype);
  }
}
