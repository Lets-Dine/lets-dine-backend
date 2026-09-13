export interface IDomainException {
  key: string;
  message: string;
  detail?: any;
}

export class DomainException extends Error {
  constructor(
    message: string,
    public exception: IDomainException
  ) {
    super(message);
    Object.setPrototypeOf(this, DomainException.prototype);
  }
}
