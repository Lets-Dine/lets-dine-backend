import { emailKey } from "../email.util";

describe("emailKey", () => {
  it("should collapse gmail dots, plus tags and googlemail", () => {
    expect(emailKey("A.B+promo@GoogleMail.com")).toBe("ab@gmail.com");
  });

  it("should keep dots on other domains but still drop the plus tag", () => {
    expect(emailKey("a.b+x@example.com")).toBe("a.b@example.com");
  });
});
