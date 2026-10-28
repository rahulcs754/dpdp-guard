import { getSchema } from "@mrleebo/prisma-ast";
import { classify } from "../pii.js";
import type { Facts, SourceInput } from "../types.js";

const CONSENT_MODEL = /consent/i;
const GUARDIAN = /guardian|parent/i;

/** Read Prisma models and record fields that hold personal data. */
export function scanPrisma(file: SourceInput, facts: Facts): void {
  const schema = getSchema(file.text);
  const lines = file.text.split("\n");
  const modelNames = new Set(schema.list.flatMap((b) => (b.type === "model" ? [b.name] : [])));

  for (const block of schema.list) {
    if (block.type !== "model") continue;
    const modelLine = findLine(lines, new RegExp(`^\\s*model\\s+${block.name}\\b`), 0);
    facts.models.set(block.name, { file: file.path, line: modelLine });
    if (!facts.consentRecord && CONSENT_MODEL.test(block.name)) facts.consentRecord = { file: file.path, line: modelLine };

    for (const prop of block.properties) {
      if (prop.type !== "field") continue;
      const line = findLine(lines, new RegExp(`^\\s*${prop.name}\\s`), modelLine - 1);
      if (!facts.guardianFlow && GUARDIAN.test(prop.name)) facts.guardianFlow = { file: file.path, line };
      // relations (e.g. `profile Profile`) are not data elements themselves
      if (typeof prop.fieldType !== "string" || modelNames.has(prop.fieldType)) continue;
      const match = classify(prop.name);
      if (match) facts.stored.push({ file: file.path, line, model: block.name, field: prop.name, match });
    }
  }
}

function findLine(lines: string[], re: RegExp, from: number): number {
  for (let i = Math.max(0, from); i < lines.length; i++) {
    if (re.test(lines[i] ?? "")) return i + 1;
  }
  return from + 1;
}
