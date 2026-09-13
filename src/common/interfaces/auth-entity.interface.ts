import { StaffRole } from "@prisma/client";

/**
 * What a verified staff access token carries. Restaurant scope lives in the
 * token, never in the request body — §36: never trust a client-supplied
 * restaurantId for authorization.
 */
export interface AuthEntity {
  /** User id. */
  sub: string;
  email: string;
  name: string;
  memberId: string;
  restaurantId: string;
  role: StaffRole;
}
