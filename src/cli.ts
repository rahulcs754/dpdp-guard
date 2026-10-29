#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command, Option } from "commander";
import { applySuggestions, suggestWithAi } from "./ai.js";
import { addedLinesSince, onlyNew } from "./diff.js";
import { gapsMarkdown, prCommentMarkdown, registerMarkdown, summaryText } from "./report.js";
import { scanDir } from "./scan.js";
import type { Location, Severity } from "./types.js";

const RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

const program = new Command()
  .name("dpdp-guard")
  .description("Find personal data in a JS/TS codebase and write a DPDP data register and gap report.")
  .version("0.1.0");

program
  .command("scan")
  .argument("[dir]", "project folder to scan", ".")
  .option("-o, --out <dir>", "where to write the reports", ".")
  .option("--ignore <names...>", "extra folder names to skip")
  .addOption(new Option("--fail-on <severity>", "exit with code 1 if a gap at this level or higher is found").choices(["high", "medium", "low"]))
  .option("--json", "print the JSON result to stdout instead of writing files")
  .option("--ai", "ask Claude to suggest purpose and retention (needs ANTHROPIC_API_KEY; sends field names and single lines only)")
  .option("--diff <base>", "also write dpdp-pr-comment.md with only what changed since this git ref; --fail-on then checks new gaps only")
  .action(async (dir: string, opts: { out: string; ignore?: string[]; failOn?: Severity; json?: boolean; ai?: boolean; diff?: string }) => {
    const root = path.resolve(dir);
    const result = await scanDir(root, { ignore: opts.ignore });
    result.root = path.relative(process.cwd(), root) || ".";
    const log = (msg: string) => (opts.json ? console.error(msg) : console.log(msg));

    if (opts.ai) {
      try {
        applySuggestions(result.register, await suggestWithAi(result.register, lineReader(root)));
        log("AI suggestions added (marked \"AI:\"). Review them before you rely on them.");
      } catch (err) {
        log(`AI step skipped: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const fresh = opts.diff ? onlyNew(result, addedLinesSince(root, opts.diff)) : null;

    if (opts.json) {
      process.stdout.write(JSON.stringify(fresh ? { ...result, new: { register: fresh.register, gaps: fresh.gaps } } : result, null, 2) + "\n");
    } else {
      const out = path.resolve(opts.out);
      await mkdir(out, { recursive: true });
      await writeFile(path.join(out, "dpdp-register.md"), registerMarkdown(result));
      await writeFile(path.join(out, "dpdp-register.json"), JSON.stringify(result, null, 2) + "\n");
      await writeFile(path.join(out, "dpdp-gaps.md"), gapsMarkdown(result));
      const files = ["dpdp-register.md", "dpdp-register.json", "dpdp-gaps.md"];
      if (fresh) {
        await writeFile(path.join(out, "dpdp-pr-comment.md"), prCommentMarkdown(fresh));
        files.push("dpdp-pr-comment.md");
      }
      console.log(summaryText(result));
      if (fresh) console.log(`New in this diff: ${fresh.register.length} data elements, ${fresh.gaps.length} gaps`);
      console.log(`\nWrote ${files.join(", ")} to ${path.relative(process.cwd(), out) || "."}`);
    }

    const gaps = fresh ? fresh.gaps : result.gaps;
    if (opts.failOn && gaps.some((g) => RANK[g.severity] >= RANK[opts.failOn!])) process.exitCode = 1;
  });

/** Reads single source lines for the AI step, caching each file. */
function lineReader(root: string): (loc: Location) => string {
  const cache = new Map<string, string[]>();
  return (loc) => {
    let lines = cache.get(loc.file);
    if (!lines) {
      try {
        lines = readFileSync(path.join(root, loc.file), "utf8").split("\n");
      } catch {
        lines = [];
      }
      cache.set(loc.file, lines);
    }
    return lines[loc.line - 1] ?? "";
  };
}

program.parseAsync().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 2;
});
