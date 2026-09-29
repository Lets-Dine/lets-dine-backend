import { IRestaurant } from "../../../restaurants/domain/interfaces/restaurant.interface";
import { IDiningTable } from "../../../tables/domain/interfaces/dining-table.interface";
import { IDiningSession } from "./dining-session.interface";

/** What scanning the QR answers with: who you are, sitting at which table, in which restaurant. */
export interface IResolvedSession {
  session: IDiningSession;
  restaurant: IRestaurant;
  table: IDiningTable;
}
