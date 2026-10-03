import { StaffRole } from "@prisma/client";

export interface IRestaurantMember {
  id: string;
  userId: string;
  restaurantId: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A membership with the person behind it — what the staff list renders. */
export interface IStaffMember extends IRestaurantMember {
  name: string;
  email: string;
  /** Branches a MANAGER/STAFF member is pinned to. Empty for an OWNER, who reaches every branch. */
  branchIds: string[];
}
