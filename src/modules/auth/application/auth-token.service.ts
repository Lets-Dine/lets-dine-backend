import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthEntity } from "../../../common/interfaces";
import { IStaffMember } from "../../users/domain/interfaces/restaurant-member.interface";

/**
 * The only place a staff access token is minted. Restaurant scope and role are
 * baked into the token so no endpoint has to take the client's word for them.
 */
@Injectable()
export class AuthTokenService {
  constructor(private readonly jwtService: JwtService) {}

  async issue(member: IStaffMember): Promise<string> {
    const payload: AuthEntity = {
      sub: member.userId,
      email: member.email,
      name: member.name,
      memberId: member.id,
      restaurantId: member.restaurantId,
      role: member.role,
    };

    return this.jwtService.signAsync(payload);
  }
}
