export interface IUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Only the sign-in path ever loads this — never return it from a controller. */
export interface IUserCredentials extends IUser {
  pinHash: string;
  /** The PIN a manager approves with, if they have set one. */
  approvalPinHash: string | null;
}
