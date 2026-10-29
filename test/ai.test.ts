import { describe, expect, it } from "vitest";
import { AI_MODEL, applySuggestions, buildAiInput, suggestWithAi } from "../src/ai.js";
import { scanSources } from "../src/scan.js";

const files = {
  "app/form.tsx": `<input name="mobile" type="tel" />`,
  "schema.prisma": "model User {\n  id Int @id\n  phone String\n}\n",
  "lib/secret.ts": "export const API_KEY = 'do-not-send';",
};
const result = () => scanSources(Object.entries(files).map(([path, text]) => ({ path, text })));
const readLine = (l: { file: string; line: number }) => files[l.file as keyof typeof files]?.split("\n")[l.line - 1] ?? "";

function fakeCreate(reply: unknown, stop = "end_turn") {
  const calls: any[] = [];
  const create = async (params: any) => {
    calls.push(params);
    return { stop_reason: stop, content: [{ type: "text", text: JSON.stringify(reply) }] } as any;
  };
  return { calls, create };
}

describe("--ai", () => {
  it("sends only element info and single evidence lines", async () => {
    const r = result();
    const { calls, create } = fakeCreate({ items: [] });
    await suggestWithAi(r.register, readLine, create);
    const body = calls[0].messages[0].content as string;
    expect(calls[0].model).toBe(AI_MODEL);
    expect(calls[0].fallbacks).toBe("default");
    expect(calls[0].output_config.format.type).toBe("json_schema");
    expect(body).toContain('<input name=\\"mobile\\" type=\\"tel\\" />');
    expect(body).toContain("User.phone");
    expect(body).not.toContain("do-not-send");
  });

  it("caps evidence at 3 lines per element", () => {
    const row = { ...result().register[0]!, collectedAt: Array.from({ length: 10 }, (_, i) => ({ file: "a.ts", line: i + 1 })) };
    expect(buildAiInput([row], () => "x")[0]!.evidence).toHaveLength(3);
  });

  it("fills TODO purpose and retention, marked as AI", async () => {
    const r = result();
    const { create } = fakeCreate({
      items: [
        { element: "phone", purpose: "Send OTP and order updates", retention: "Until account deletion", basis: "consent" },
        { element: "made-up", purpose: "x", retention: "x", basis: "unclear" },
      ],
    });
    const suggestions = await suggestWithAi(r.register, readLine, create);
    expect(suggestions.map((s) => s.element)).toEqual(["phone"]);
    applySuggestions(r.register, suggestions);
    expect(r.register[0]).toMatchObject({
      purpose: "AI: Send OTP and order updates (basis: consent)",
      retention: "AI: Until account deletion",
    });
  });

  it("keeps a purpose the team already wrote", () => {
    const r = result();
    r.register[0]!.purpose = "Login OTP";
    applySuggestions(r.register, [{ element: "phone", purpose: "x", retention: "y", basis: "consent" }]);
    expect(r.register[0]!.purpose).toBe("Login OTP");
  });

  it("throws on refusal so the CLI can skip the step", async () => {
    const { create } = fakeCreate({}, "refusal");
    await expect(suggestWithAi(result().register, readLine, create)).rejects.toThrow(/declined/);
  });

  it("makes no call when there is nothing to classify", async () => {
    const { calls, create } = fakeCreate({ items: [] });
    expect(await suggestWithAi([], readLine, create)).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
