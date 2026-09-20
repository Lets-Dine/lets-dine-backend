import { IDiningTable } from "../../../tables/domain/interfaces/dining-table.interface";
import { IDiningSession } from "./dining-session.interface";

/** What scanning the QR answers with: who you are sitting in, at which table. */
export interface IResolvedSession {
  session: IDiningSession;
  table: IDiningTable;
}
