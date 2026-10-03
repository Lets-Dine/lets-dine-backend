import { StaffRole } from "@prisma/client";

export interface IAuthMembership {
  memberId: string;
  restaurantId: string;
  role: StaffRole;
}

export interface IAuthBranch {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
}

export interface IAuthProfile {
  id: string;
  name: string;
  email: string;
  memberId: string;
  restaurantId: string;
  role: StaffRole;
  /** The branch this session is working in. */
  branchId: string;
  /** Branches this person may switch to, so the dashboard can render a branch picker. */
  branches: IAuthBranch[];
  /** Every restaurant this person works at, so the dashboard can offer a switch. */
  memberships: IAuthMembership[];
}

export interface IAuthSwitch {
  accessToken: string;
  branchId: string;
  branches: IAuthBranch[];
}

export interface IAuthSession {
  accessToken: string;
  profile: IAuthProfile;
}
