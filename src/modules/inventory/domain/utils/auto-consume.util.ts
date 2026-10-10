/**
 * Whether starting a dish takes its recipe off stock. The most specific setting wins: the dish, then
 * its branch, then the restaurant. Null means "no opinion, ask the next one up".
 */
export function resolveAutoConsume(settings: { dish: boolean | null; branch: boolean | null; restaurant: boolean }): boolean {
  return settings.dish ?? settings.branch ?? settings.restaurant;
}
