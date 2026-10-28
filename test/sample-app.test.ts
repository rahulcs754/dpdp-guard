import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { gapsMarkdown, registerMarkdown } from "../src/report.js";
import { scanDir } from "../src/scan.js";

const root = fileURLToPath(new URL("../fixtures/sample-app", import.meta.url));

describe("fixtures/sample-app", async () => {
  const r = await scanDir(root);

  it("finds every planted gap", () => {
    expect(r.gaps.map((g) => `${g.rule} ${g.file}:${g.line}`)).toEqual([
      "DPDP-01 app/signup/page.tsx:12",
      "DPDP-02 app/signup/page.tsx:6",
      "DPDP-04 lib/analytics.ts:8",
      "DPDP-05 app/signup/page.tsx:9",
      "DPDP-07 prisma/schema.prisma:19",
      "DPDP-03 prisma/schema.prisma:12",
      "DPDP-06 app/api/users/route.ts:8",
      "DPDP-06 app/api/users/route.ts:12",
    ]);
  });

  it("builds the register", () => {
    expect(r.register.map((x) => x.element)).toEqual(["aadhaar", "dob", "gender", "name", "email", "phone", "address"]);
    expect(r.register.find((x) => x.element === "email")?.sharedWith).toEqual(["Mixpanel", "Sentry"]);
    expect(r.thirdParties.map((t) => t.processor)).toEqual(["Mixpanel", "Sentry", "Razorpay"]);
  });

  it("writes markdown with the legal note", () => {
    expect(registerMarkdown(r)).toContain("Not legal advice");
    expect(gapsMarkdown(r)).toContain("**5 high, 3 medium, 0 low**");
  });
});
