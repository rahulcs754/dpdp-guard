import type { Category, Facts, Location, RegisterRow } from "./types.js";

const CATEGORY_ORDER: Category[] = ["government-id", "financial", "health", "children", "identity", "contact", "location", "device-id"];

/** Group facts into one row per data element. */
export function buildRegister(facts: Facts): RegisterRow[] {
  const rows = new Map<string, RegisterRow>();
  const row = (m: { element: string; label: string; category: Category; confidence: "high" | "medium" }) => {
    let r = rows.get(m.element);
    if (!r) {
      r = { element: m.element, label: m.label, category: m.category, confidence: m.confidence, collectedAt: [], storedIn: [], sharedWith: [], loggedAt: [], purpose: "TODO", retention: "TODO" };
      rows.set(m.element, r);
    }
    if (m.confidence === "high") r.confidence = "high";
    return r;
  };

  for (const c of facts.collected) pushLoc(row(c.match).collectedAt, c);
  for (const s of facts.stored) row(s.match).storedIn.push({ file: s.file, line: s.line, ref: `${s.model}.${s.field}` });
  for (const s of facts.shared) {
    const r = row(s.match);
    if (!r.sharedWith.includes(s.processor)) r.sharedWith.push(s.processor);
  }
  for (const l of facts.logged) if (l.match) pushLoc(row(l.match).loggedAt, l);

  return [...rows.values()].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.label.localeCompare(b.label),
  );
}

function pushLoc(list: Location[], loc: Location): void {
  if (!list.some((l) => l.file === loc.file && l.line === loc.line)) list.push({ file: loc.file, line: loc.line });
}
