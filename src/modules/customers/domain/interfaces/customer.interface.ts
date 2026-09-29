/** A delivery customer remembered per restaurant — §22, one deliberate step past the app's fully-anonymous model. */
export interface ICustomer {
  id: string;
  restaurantId: string;
  phone: string;
  name: string;
  defaultAddress: string | null;
  defaultNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}
