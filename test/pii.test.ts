import { describe, expect, it } from "vitest";
import { classify } from "../src/pii.js";

describe("classify", () => {
  it.each([
    ["email", "email"],
    ["userEmail", "email"],
    ["email_address", "email"],
    ["mobileNumber", "phone"],
    ["phone_no", "phone"],
    ["aadhaarNumber", "aadhaar"],
    ["aadharNo", "aadhaar"],
    ["panNumber", "pan"],
    ["date_of_birth", "dob"],
    ["firstName", "name"],
    ["pincode", "address"],
    ["shippingAddress", "address"],
    ["ipAddress", "ip"],
    ["latitude", "geo"],
    ["bloodGroup", "health"],
    ["upiId", "upi"],
    ["ifscCode", "bank"],
  ])("%s -> %s", (name, element) => {
    expect(classify(name)?.element).toBe(element);
  });

  it.each(["id", "password", "amount", "orderId", "createdAt", "emailVerified", "panel", "company", "status"])(
    "%s is not personal data",
    (name) => {
      expect(classify(name)).toBeNull();
    },
  );

  it("marks broad names as medium confidence", () => {
    expect(classify("name")?.confidence).toBe("medium");
    expect(classify("fullName")?.confidence).toBe("high");
  });

  it("flags age signals", () => {
    expect(classify("dob")?.ageSignal).toBe(true);
    expect(classify("email")?.ageSignal).toBeUndefined();
  });
});
