/**
 * Jest-only stand-in for `@nestjs/event-emitter`, mapped in via `moduleNameMapper`.
 * The real package ships ESM-only, which the CJS-based Jest transform can't parse;
 * use cases only ever call `.emit(...)` on it, and every unit test replaces that
 * with its own `jest.fn()` anyway, so nothing here needs to actually emit.
 */
export class EventEmitter2 {
  emit(_event: string, ..._values: unknown[]): boolean {
    return true;
  }

  emitAsync(_event: string, ..._values: unknown[]): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}

/** Listener classes are unit-tested by calling their handlers directly, so the decorator only has to exist. */
export const OnEvent =
  (_event: string) =>
  (_target: object, _key: string | symbol, _descriptor: PropertyDescriptor): void =>
    undefined;
