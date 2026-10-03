import { normalizePhone } from "./phone.util";

describe("normalizePhone", () => {
  it.each(["9841 234 567", "9841-234567", "+977 9841234567", "(977) 9841 234 567"])("collapses %s", raw => {
    expect(normalizePhone(raw)).toBe("9841234567");
  });
});
