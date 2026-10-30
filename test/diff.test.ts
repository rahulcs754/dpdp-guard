import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addedLinesSince, onlyNew, parseUnifiedDiff } from "../src/diff.js";
import { COMMENT_MARKER, prCommentMarkdown } from "../src/report.js";
import { scanDir, scanSources } from "../src/scan.js";

const DIFF = `diff --git a/app/a.tsx b/app/a.tsx
--- a/app/a.tsx
+++ b/app/a.tsx
@@ -3,0 +4,2 @@
+<input name="phone" />
+<input name="email" />
@@ -10 +12 @@
-old
+new
diff --git a/gone.ts b/gone.ts
--- a/gone.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-x
-y
`;

describe("parseUnifiedDiff", () => {
  it("collects added line numbers per file", () => {
    const added = parseUnifiedDiff(DIFF);
    expect([...added.get("app/a.tsx")!]).toEqual([4, 5, 12]);
    expect(added.has("gone.ts")).toBe(false);
  });

  it("makes paths relative to a sub-folder scan", () => {
    const added = parseUnifiedDiff(DIFF, "app/");
    expect([...added.keys()]).toEqual(["a.tsx"]);
  });
});

describe("onlyNew + PR comment", () => {
  const r = scanSources([
    { path: "a.tsx", text: `<input name="phone" />\n<input name="email" />` },
    { path: "lib/consent.ts", text: "export const recordConsent = () => {};" },
  ]);

  it("keeps only rows and gaps on added lines", () => {
    const fresh = onlyNew(r, new Map([["a.tsx", new Set([2])]]));
    expect(fresh.register.map((x) => x.element)).toEqual(["email"]);
    expect(prCommentMarkdown(fresh)).toContain(COMMENT_MARKER);
    expect(prCommentMarkdown(fresh)).toContain("Email address");
  });

  it("writes no comment when nothing is new", () => {
    expect(prCommentMarkdown(onlyNew(r, new Map()))).toBe("");
  });
});

describe("addedLinesSince (real git)", () => {
  it("finds personal data added on a branch", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dpdp-"));
    const git = (...a: string[]) => execFileSync("git", ["-C", dir, ...a], { stdio: "pipe" });
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "t");
    writeFileSync(path.join(dir, "form.tsx"), `<input name="email" />\n`);
    git("add", ".");
    git("commit", "-qm", "base");
    git("checkout", "-qb", "feature");
    writeFileSync(path.join(dir, "form.tsx"), `<input name="email" />\n<input name="aadhaarNumber" />\n`);
    git("commit", "-qam", "add aadhaar");

    const fresh = onlyNew(await scanDir(dir), addedLinesSince(dir, "main"));
    expect(fresh.register.map((x) => x.element)).toEqual(["aadhaar"]);
  });
});
