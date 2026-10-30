import { PROCESSORS, sharesToTracker } from "./processors.js";
import type { Facts, Gap } from "./types.js";

/** Turn raw facts into DPDP gaps. Heuristics: wording says "may". */
export function findGaps(facts: Facts): Gap[] {
  const gaps: Gap[] = [];

  for (const c of facts.preTicked) {
    gaps.push({
      rule: "DPDP-01",
      title: "Pre-ticked consent checkbox",
      severity: "high",
      file: c.file,
      line: c.line,
      message: `Checkbox "${c.field}" is checked by default. Consent must be a clear affirmative action (Sec 6(1)).`,
      fix: "Leave consent and marketing checkboxes unchecked, and keep one checkbox per purpose.",
    });
  }

  const first = facts.collected[0] ?? facts.stored[0];
  if (first && !facts.consentRecord) {
    gaps.push({
      rule: "DPDP-02",
      title: "No consent record found",
      severity: "high",
      file: first.file,
      line: first.line,
      message: "Personal data is collected, but no code or table that records consent was found. You may not be able to prove consent (Sec 6(10)).",
      fix: "Add a consent log: user id, purpose, notice version, given at, withdrawn at. Write a row whenever consent is given or withdrawn.",
    });
  }

  const piiModels = new Map<string, string[]>();
  for (const s of facts.stored) piiModels.set(s.model, [...(piiModels.get(s.model) ?? []), s.field]);
  for (const [model, fields] of piiModels) {
    if (facts.deletedModels.has(model.toLowerCase())) continue;
    const loc = facts.models.get(model);
    if (!loc) continue;
    gaps.push({
      rule: "DPDP-03",
      title: "No erasure path",
      severity: "medium",
      file: loc.file,
      line: loc.line,
      message: `Model ${model} holds personal data (${fields.join(", ")}) but no delete call for it was found. Users can ask for erasure (Sec 12), and data must go when the purpose ends (Sec 8(7)).`,
      fix: `Add an account-deletion flow that deletes or anonymises ${model} rows, and a retention job for stale records.`,
    });
  }

  const trackerNames = new Set(PROCESSORS.filter(sharesToTracker).map((p) => p.name));
  const byCall = new Map<string, Facts["shared"]>();
  for (const s of facts.shared) {
    if (!trackerNames.has(s.processor)) continue;
    const key = `${s.file}:${s.line}`;
    byCall.set(key, [...(byCall.get(key) ?? []), s]);
  }
  for (const list of byCall.values()) {
    const s = list[0]!;
    gaps.push({
      rule: "DPDP-04",
      title: "Personal data sent to a tracker",
      severity: "high",
      file: s.file,
      line: s.line,
      message: `${s.call}() may send ${list.map((x) => x.match.label.toLowerCase()).join(", ")} to ${s.processor}.`,
      fix: "Send a random or hashed user ID instead, load the SDK only after consent, and list the vendor as a Data Processor.",
    });
  }

  const age = [...facts.collected, ...facts.stored].find((x) => x.match.ageSignal);
  if (age && !facts.guardianFlow) {
    gaps.push({
      rule: "DPDP-05",
      title: "Possible children's data without parental consent",
      severity: "high",
      file: age.file,
      line: age.line,
      message: `${age.match.label} is collected, so users under 18 may sign up, but no guardian / parental consent flow was found (Sec 9).`,
      fix: "Block under-18 sign-ups, or add verifiable parental consent. Turn off tracking and targeted ads for children.",
    });
  }

  for (const l of facts.logged) {
    gaps.push({
      rule: "DPDP-06",
      title: "Personal data in logs",
      severity: "medium",
      file: l.file,
      line: l.line,
      message: l.match
        ? `${l.call}() logs ${l.match.label.toLowerCase()} (${l.expression}).`
        : `${l.call}() logs a whole ${l.expression} object, which may contain personal data.`,
      fix: "Remove the log, or log only an internal ID. Logs need the same safeguards as the database (Sec 8(5)).",
    });
  }

  for (const s of facts.stored) {
    if (s.match.element !== "aadhaar") continue;
    gaps.push({
      rule: "DPDP-07",
      title: "Aadhaar number stored",
      severity: "high",
      file: s.file,
      line: s.line,
      message: `${s.model}.${s.field} may store full Aadhaar numbers. The Aadhaar Act and UIDAI rules limit storing them.`,
      fix: "Store only the last 4 digits or a reference token from an Aadhaar Data Vault, and encrypt at rest.",
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return gaps.sort((a, b) => order[a.severity] - order[b.severity] || a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file) || a.line - b.line);
}
