import { describe, expect, it } from "vitest";
import { scanSources } from "../src/scan.js";

const scan = (files: Record<string, string>) =>
  scanSources(Object.entries(files).map(([path, text]) => ({ path, text })));
const rules = (files: Record<string, string>) => scan(files).gaps.map((g) => g.rule);

// A consent table so DPDP-02 stays quiet in tests about other rules.
const consent = { "lib/consent.ts": "export async function recordConsent() {}" };

describe("collection", () => {
  it("finds form inputs, react-hook-form and zod fields", () => {
    const r = scan({
      "a.tsx": `export const F = () => <form><input name="phone" /><input type="email" /><input {...register("firstName")} /></form>;`,
      "s.ts": `import { z } from "zod"; export const s = z.object({ contact: z.string().email(), pan: z.string() });`,
    });
    expect(r.register.map((x) => x.element).sort()).toEqual(["email", "name", "pan", "phone"]);
    expect(r.register.find((x) => x.element === "email")?.collectedAt).toEqual([
      { file: "a.tsx", line: 1 },
      { file: "s.ts", line: 1 },
    ]);
  });

  it("ignores inputs that are not personal data", () => {
    const r = scan({ "a.tsx": `export const F = () => <input name="search" type="text" />;` });
    expect(r.register).toEqual([]);
  });
});

describe("DPDP-01 pre-ticked consent", () => {
  it("flags a consent checkbox checked by default", () => {
    expect(rules({ ...consent, "a.tsx": `<input type="checkbox" name="marketingConsent" defaultChecked />` })).toContain("DPDP-01");
    expect(rules({ ...consent, "a.tsx": `<Checkbox name="acceptTerms" checked={true} />` })).toContain("DPDP-01");
  });
  it("does not flag unchecked or non-consent checkboxes", () => {
    expect(rules({ ...consent, "a.tsx": `<input type="checkbox" name="marketingConsent" />` })).not.toContain("DPDP-01");
    expect(rules({ ...consent, "a.tsx": `<input type="checkbox" name="rememberMe" defaultChecked />` })).not.toContain("DPDP-01");
  });
});

describe("DPDP-02 consent record", () => {
  const form = { "a.tsx": `<input name="email" />` };
  it("flags collection with no consent code", () => {
    expect(rules(form)).toContain("DPDP-02");
  });
  it("is quiet when consent is recorded in code or schema", () => {
    expect(rules({ ...form, ...consent })).not.toContain("DPDP-02");
    expect(rules({ ...form, "schema.prisma": "model ConsentLog {\n  id Int @id\n}\n" })).not.toContain("DPDP-02");
  });
});

describe("DPDP-03 erasure path", () => {
  const schema = { "prisma/schema.prisma": "model User {\n  id Int @id\n  email String\n}\n" };
  it("flags a personal data model with no delete call", () => {
    const gap = scan({ ...consent, ...schema }).gaps.find((g) => g.rule === "DPDP-03");
    expect(gap).toMatchObject({ file: "prisma/schema.prisma", line: 1 });
  });
  it("is quiet when the model is deleted somewhere", () => {
    expect(rules({ ...consent, ...schema, "r.ts": "await prisma.user.delete({ where: { id } });" })).not.toContain("DPDP-03");
  });
});

describe("DPDP-04 tracker", () => {
  it("flags personal data sent to analytics", () => {
    const r = scan({ ...consent, "a.ts": "posthog.identify(user.id, { email: user.email });" });
    expect(r.gaps.map((g) => g.rule)).toContain("DPDP-04");
    expect(r.register.find((x) => x.element === "email")?.sharedWith).toEqual(["PostHog"]);
  });
  it("is quiet for events with no personal data", () => {
    expect(rules({ ...consent, "a.ts": `mixpanel.track("purchase", { orderId, amount });` })).not.toContain("DPDP-04");
  });
  it("lists error trackers in the register without a tracker gap", () => {
    const r = scan({ ...consent, "a.ts": "Sentry.setUser({ email: user.email });" });
    expect(r.gaps.map((g) => g.rule)).not.toContain("DPDP-04");
    expect(r.register[0]?.sharedWith).toEqual(["Sentry"]);
  });
});

describe("DPDP-05 children's data", () => {
  it("flags date of birth with no guardian flow", () => {
    expect(rules({ ...consent, "a.tsx": `<input name="dob" type="date" />` })).toContain("DPDP-05");
  });
  it("is quiet when a guardian consent flow exists", () => {
    expect(rules({ ...consent, "a.tsx": `<input name="dob" />`, "g.ts": "export function requestGuardianConsent() {}" })).not.toContain("DPDP-05");
  });
});

describe("DPDP-06 logs", () => {
  it("flags personal data and whole user objects in logs", () => {
    const gaps = scan({ ...consent, "a.ts": "console.log(user.phone);\nlogger.info({ user });" }).gaps.filter((g) => g.rule === "DPDP-06");
    expect(gaps.map((g) => g.line)).toEqual([1, 2]);
  });
  it("is quiet for ids and plain messages", () => {
    expect(rules({ ...consent, "a.ts": `console.log("saved", user.id, orderId);` })).not.toContain("DPDP-06");
  });
});

describe("DPDP-07 Aadhaar", () => {
  it("flags a stored Aadhaar field", () => {
    expect(rules({ ...consent, "schema.prisma": "model Kyc {\n  id Int @id\n  aadhaarNumber String\n}\n" })).toContain("DPDP-07");
  });
  it("is quiet without one", () => {
    expect(rules({ ...consent, "schema.prisma": "model Kyc {\n  id Int @id\n  status String\n}\n" })).not.toContain("DPDP-07");
  });
});

describe("package.json", () => {
  it("lists known SDKs as third parties", () => {
    const r = scan({ "package.json": JSON.stringify({ dependencies: { "posthog-js": "1", react: "19" } }) });
    expect(r.thirdParties).toEqual([{ processor: "PostHog", kind: "analytics", pkg: "posthog-js" }]);
  });
});
