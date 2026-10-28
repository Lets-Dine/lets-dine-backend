import { createVerify, generateKeyPairSync } from "node:crypto";
import { BadRequestException } from "../../../../common/exceptions";
import { qzCertificate, signQzRequest } from "../qz-signing";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
const certPem = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n";

describe("qz signing", () => {
  afterEach(() => {
    delete process.env.QZ_CERTIFICATE;
    delete process.env.QZ_PRIVATE_KEY;
  });

  it("signs the request the printer PC will send", () => {
    process.env.QZ_CERTIFICATE = certPem;
    process.env.QZ_PRIVATE_KEY = keyPem;
    const signature = signQzRequest("print this");
    const verify = createVerify("SHA512");
    verify.update("print this");
    expect(verify.verify(publicKey, signature, "base64")).toBe(true);
    expect(qzCertificate()).toBe(certPem);
  });

  it("accepts a certificate pasted on one line", () => {
    process.env.QZ_CERTIFICATE = certPem.replace(/\n/g, "\\n");
    process.env.QZ_PRIVATE_KEY = keyPem;
    expect(qzCertificate()).toBe(certPem);
  });

  it("refuses to sign when the key is not configured", () => {
    expect(() => signQzRequest("print this")).toThrow(BadRequestException);
  });
});
