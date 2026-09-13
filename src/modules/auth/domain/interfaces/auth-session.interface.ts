import { StaffRole } from "@prisma/client";

export interface IAuthMembership {
  memberId: string;
  restaurantId: string;
  role: StaffRole;
}

export interface IAuthProfile {
  id: string;
  name: string;
  email: string;
  memberId: string;
  restaurantId: string;
  role: StaffRole;
  /** Every restaurant this person works at, so the dashboard can offer a switch. */
  memberships: IAuthMembership[];
}

export interface IAuthSession {
  accessToken: string;
  profile: IAuthProfile;
}
