import { processorForPackage } from "../processors.js";
import type { Facts, SourceInput } from "../types.js";

/** Record known third-party SDKs listed in package.json. */
export function scanPackageJson(file: SourceInput, facts: Facts): void {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(file.text);
  } catch {
    return;
  }
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    const p = processorForPackage(name);
    if (p && !facts.installed.some((i) => i.pkg === name)) facts.installed.push({ processor: p.name, kind: p.kind, pkg: name });
  }
}
