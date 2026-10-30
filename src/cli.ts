#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command, Option } from "commander";
import { gapsMarkdown, registerMarkdown, summaryText } from "./report.js";
import { scanDir } from "./scan.js";
import type { Severity } from "./types.js";

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
  .action(async (dir: string, opts: { out: string; ignore?: string[]; failOn?: Severity; json?: boolean }) => {
    const root = path.resolve(dir);
    const result = await scanDir(root, { ignore: opts.ignore });
    result.root = path.relative(process.cwd(), root) || ".";

    if (opts.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } else {
      const out = path.resolve(opts.out);
      await mkdir(out, { recursive: true });
      await writeFile(path.join(out, "dpdp-register.md"), registerMarkdown(result));
      await writeFile(path.join(out, "dpdp-register.json"), JSON.stringify(result, null, 2) + "\n");
      await writeFile(path.join(out, "dpdp-gaps.md"), gapsMarkdown(result));
      console.log(summaryText(result));
      console.log(`\nWrote dpdp-register.md, dpdp-register.json and dpdp-gaps.md to ${path.relative(process.cwd(), out) || "."}`);
    }

    if (opts.failOn && result.gaps.some((g) => RANK[g.severity] >= RANK[opts.failOn!])) process.exitCode = 1;
  });

program.parseAsync().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 2;
});
