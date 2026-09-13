import { StaffRole } from "@prisma/client";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IStaffMember } from "../interfaces/restaurant-member.interface";

export interface IRestaurantMemberCreate {
  userId: string;
  restaurantId: string;
  role: StaffRole;
  isActive?: boolean;
}

export type IRestaurantMemberUpdate = Partial<Pick<IRestaurantMemberCreate, "role" | "isActive">>;

export interface IStaffMembersFetchQuery {
  restaurantId: string;
  role?: StaffRole;
  isActive?: boolean;
  keyword?: string;
}

export interface IStaffMembersFetchOptions extends IPaginationOptions {
  tx?: PrismaTransaction;
}

export interface RestaurantMemberFetchOptions {
  tx?: PrismaTransaction;
}

export abstract class RestaurantMemberRepository {
  abstract findById(id: string, options?: RestaurantMemberFetchOptions): Promise<IStaffMember | null>;
  abstract findByUserAndRestaurant(
    userId: string,
    restaurantId: string,
    options?: RestaurantMemberFetchOptions
  ): Promise<IStaffMember | null>;
  abstract findActiveByUserId(userId: string, options?: RestaurantMemberFetchOptions): Promise<IStaffMember[]>;
  abstract countActiveByRole(restaurantId: string, role: StaffRole, options?: RestaurantMemberFetchOptions): Promise<number>;
  abstract create(data: IRestaurantMemberCreate, options?: { tx?: PrismaTransaction }): Promise<IStaffMember>;
  abstract update(id: string, data: IRestaurantMemberUpdate, transaction?: PrismaTransaction): Promise<IStaffMember>;
  abstract fetchAll(query: IStaffMembersFetchQuery, options?: IStaffMembersFetchOptions): Promise<PaginatedResponse<IStaffMember>>;
}
