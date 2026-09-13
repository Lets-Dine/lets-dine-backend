import { StaffRole } from "@prisma/client";
import { AuthEntity } from "../interfaces/auth-entity.interface";

/** Test-only helper so use-case specs don't retype a staff token every time. */
export function buildAuthEntity(overrides: Partial<AuthEntity> = {}): AuthEntity {
  return {
    sub: "11111111-1111-4111-8111-111111111111",
    email: "owner@lets-dine.test",
    name: "Aarati Shrestha",
    memberId: "22222222-2222-4222-8222-222222222222",
    restaurantId: "33333333-3333-4333-8333-333333333333",
    role: StaffRole.OWNER,
    ...overrides,
  };
}
