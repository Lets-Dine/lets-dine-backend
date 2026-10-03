export interface IMenuCopyResult {
  categories: number;
  dishes: number;
  variants: number;
  addOns: number;
}

export abstract class BranchMenuRepository {
  /** Whether the branch has no sections, dishes or add-ons at all — archived ones included. */
  abstract isMenuEmpty(branchId: string): Promise<boolean>;
  /**
   * Copies one branch's live menu (sections, dishes, variants, add-ons and which add-ons each dish offers)
   * onto another, atomically. Archived rows are left behind — they exist only for order history.
   * The copy is independent: editing either menu afterwards never touches the other.
   */
  abstract copyMenu(fromBranchId: string, toBranchId: string, actorId: string): Promise<IMenuCopyResult>;
}
