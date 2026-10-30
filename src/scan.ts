import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { findGaps } from "./gaps.js";
import { buildRegister } from "./register.js";
import { scanCode } from "./scanners/code.js";
import { scanPackageJson } from "./scanners/packages.js";
import { scanPrisma } from "./scanners/prisma.js";
import type { Facts, ScanResult, SourceInput } from "./types.js";

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const DEFAULT_IGNORE = ["node_modules", ".git", ".next", "dist", "build", "out", "coverage", ".vercel", ".turbo"];
const MAX_BYTES = 1_000_000;

export interface ScanOptions {
  ignore?: string[];
}

/** Scan files already in memory. Pure, so tests can call it directly. */
export function scanSources(files: SourceInput[], root = "."): ScanResult {
  const facts: Facts = {
    collected: [],
    stored: [],
    shared: [],
    logged: [],
    preTicked: [],
    installed: [],
    consentRecord: null,
    guardianFlow: null,
    deletedModels: new Set(),
    models: new Map(),
    filesScanned: files.length,
  };

  const code: SourceInput[] = [];
  for (const f of files) {
    const base = path.posix.basename(f.path);
    if (base === "package.json") scanPackageJson(f, facts);
    else if (f.path.endsWith(".prisma")) scanPrisma(f, facts);
    else if (CODE_EXT.test(f.path) && !f.path.endsWith(".d.ts")) code.push(f);
  }
  scanCode(code, facts);

  return {
    root,
    generatedAt: new Date().toISOString(),
    filesScanned: facts.filesScanned,
    register: buildRegister(facts),
    thirdParties: facts.installed,
    gaps: findGaps(facts),
  };
}

/** Walk a directory and scan it. */
export async function scanDir(root: string, opts: ScanOptions = {}): Promise<ScanResult> {
  const ignore = new Set([...DEFAULT_IGNORE, ...(opts.ignore ?? [])]);
  const files: SourceInput[] = [];

  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignore.has(entry.name)) await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const wanted = entry.name === "package.json" || entry.name.endsWith(".prisma") || CODE_EXT.test(entry.name);
      if (!wanted || (await stat(full)).size > MAX_BYTES) continue;
      files.push({ path: path.relative(root, full).split(path.sep).join("/"), text: await readFile(full, "utf8") });
    }
  }

  await walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return scanSources(files, root);
}
