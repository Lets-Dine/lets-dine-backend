import { StaffRole } from "@prisma/client";
import { can } from "../permissions";

describe("billing permissions", () => {
  it.each([
    ["OWNER", true, true],
    ["MANAGER", true, false],
    ["STAFF", false, false],
  ] as [StaffRole, boolean, boolean][])("should give a %s billing:view=%s and billing:manage=%s", (role, view, manage) => {
    // Act & Assert
    expect(can(role, "billing:view")).toBe(view);
    expect(can(role, "billing:manage")).toBe(manage);
  });
});
