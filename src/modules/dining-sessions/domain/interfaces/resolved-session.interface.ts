import { ICustomer } from "../../../customers/domain/interfaces/customer.interface";
import { IFloor } from "../../../floors/domain/interfaces/floor.interface";
import { IRestaurant } from "../../../restaurants/domain/interfaces/restaurant.interface";
import { IDiningTable } from "../../../tables/domain/interfaces/dining-table.interface";
import { IDiningSession } from "./dining-session.interface";

/**
 * What scanning the QR (or starting a delivery order) answers with: who you
 * are, in which restaurant — sitting at a table, as a delivery customer
 * (`table` null, `customer` set instead), or as staff on a floor (`table`
 * null, `floor` set instead — identified by the free-text name they gave
 * when opening the floor QR, on `session.floorVisitorName`).
 */
export interface IResolvedSession {
  session: IDiningSession;
  restaurant: IRestaurant;
  table: IDiningTable | null;
  customer?: ICustomer | null;
  floor?: IFloor | null;
}
