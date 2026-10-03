import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthEntity } from "../../../common/interfaces";
import { IStaffMember } from "../../users/domain/interfaces/restaurant-member.interface";

/**
 * The only place a staff access token is minted. Restaurant scope and role are
 * baked into the token so no endpoint has to take the client's word for them. Lifetime comes
 * from `JWT_EXPIRES_IN` (see `AppModule`).
 */
@Injectable()
export class AuthTokenService {
  constructor(private readonly jwtService: JwtService) {}

  async issue(member: IStaffMember, branch: { branchId: string; branchIds: string[] | "all" }): Promise<string> {
    const payload: AuthEntity = {
      sub: member.userId,
      email: member.email,
      name: member.name,
      memberId: member.id,
      restaurantId: member.restaurantId,
      role: member.role,
      branchId: branch.branchId,
      branchIds: branch.branchIds,
    };

    return this.jwtService.signAsync(payload);
  }
}
