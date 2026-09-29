import { ICustomer } from "../../../customers/domain/interfaces/customer.interface";
import { IRestaurant } from "../../../restaurants/domain/interfaces/restaurant.interface";
import { IDiningTable } from "../../../tables/domain/interfaces/dining-table.interface";
import { IDiningSession } from "./dining-session.interface";

/**
 * What scanning the QR (or starting a delivery order) answers with: who you
 * are, in which restaurant — sitting at a table, or as a delivery customer
 * (`table` null, `customer` set instead).
 */
export interface IResolvedSession {
  session: IDiningSession;
  restaurant: IRestaurant;
  table: IDiningTable | null;
  customer?: ICustomer | null;
}
