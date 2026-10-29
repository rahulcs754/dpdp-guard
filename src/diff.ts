import { execFileSync } from "node:child_process";
import type { Location, ScanResult } from "./types.js";

/** Added line numbers per file, from `git diff -U0` output. */
export type AddedLines = Map<string, Set<number>>;

export function parseUnifiedDiff(diff: string, stripPrefix = ""): AddedLines {
  const added: AddedLines = new Map();
  let file: string | null = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4).trim();
      file = target === "/dev/null" ? null : target.replace(/^b\//, "");
      if (file && stripPrefix) file = file.startsWith(stripPrefix) ? file.slice(stripPrefix.length) : null;
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && file) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      const set = added.get(file) ?? new Set<number>();
      for (let i = 0; i < count; i++) set.add(start + i);
      added.set(file, set);
    }
  }
  return added;
}

/** Lines added on HEAD since `base`, with paths relative to `root`. */
export function addedLinesSince(root: string, base: string): AddedLines {
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = git("rev-parse", "--show-prefix").trim();
  const diff = (range: string) => git("diff", "-U0", "--no-color", "--no-ext-diff", range);
  let text: string;
  try {
    text = diff(`${base}...HEAD`);
  } catch {
    // shallow CI checkouts of a PR merge commit have no merge base; base..HEAD is the PR's change there
    text = diff(`${base}..HEAD`);
  }
  return parseUnifiedDiff(text, prefix);
}

const isAdded = (added: AddedLines, l: Location) => added.get(l.file)?.has(l.line) ?? false;

/** Keep only what the diff introduced: rows with a new location, and gaps on added lines. */
export function onlyNew(result: ScanResult, added: AddedLines): ScanResult {
  const register = result.register.filter((r) => [...r.collectedAt, ...r.storedIn, ...r.loggedAt].some((l) => isAdded(added, l)));
  const gaps = result.gaps.filter((g) => isAdded(added, g));
  return { ...result, register, gaps };
}
