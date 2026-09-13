export interface IUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Only the sign-in path ever loads this — never return it from a controller. */
export interface IUserCredentials extends IUser {
  pinHash: string;
}
