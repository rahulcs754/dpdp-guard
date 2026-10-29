import Anthropic from "@anthropic-ai/sdk";
import type { Location, RegisterRow } from "./types.js";

export const AI_MODEL = "claude-opus-5-5";

export interface AiSuggestion {
  element: string;
  purpose: string;
  retention: string;
  basis: "consent" | "legitimate-use" | "unclear";
}

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Create = (params: CreateParams) => Promise<Anthropic.Beta.Messages.BetaMessage>;

/** Returns the text of one source line, or "" if unknown. */
export type ReadLine = (loc: Location) => string;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["element", "purpose", "retention", "basis"],
        properties: {
          element: { type: "string" },
          purpose: { type: "string" },
          retention: { type: "string" },
          basis: { type: "string", enum: ["consent", "legitimate-use", "unclear"] },
        },
      },
    },
  },
} as const;

const SYSTEM = `You help engineers fill in a data register for India's Digital Personal Data Protection (DPDP) Act 2023.
For each personal data element you get its category, where it is stored, who it is shared with, and a few single source lines that use it.
For each element return:
- purpose: one short, specific sentence on why this app likely uses it, based only on the evidence (e.g. "Send order and delivery updates by SMS"). If the evidence does not show a purpose, write "Unclear from code: ask the product owner".
- retention: a short suggestion tied to the purpose (e.g. "Until account deletion, then 30 days"). Do not invent legal deadlines.
- basis: "consent" for most product uses, "legitimate-use" only for clear Sec 7 cases (e.g. a legal duty, an employment record), "unclear" if you cannot tell.
These are suggestions an engineer and a lawyer will review. Keep each field under 25 words.`;

/** Max source lines sent per element. Only single lines, never whole files. */
const MAX_LINES = 3;

export function buildAiInput(rows: RegisterRow[], readLine: ReadLine) {
  return rows.map((r) => ({
    element: r.element,
    label: r.label,
    category: r.category,
    storedIn: r.storedIn.map((s) => s.ref),
    sharedWith: r.sharedWith,
    evidence: [...r.collectedAt, ...r.storedIn, ...r.loggedAt]
      .slice(0, MAX_LINES)
      .map((l) => ({ at: `${l.file}:${l.line}`, code: readLine(l).trim().slice(0, 200) })),
  }));
}

/**
 * Ask Claude for purpose, retention and basis suggestions.
 * Only runs with `--ai`. Sends field names and single lines, not files.
 */
export async function suggestWithAi(
  rows: RegisterRow[],
  readLine: ReadLine,
  create: Create = (p) => new Anthropic().beta.messages.create(p),
): Promise<AiSuggestion[]> {
  if (rows.length === 0) return [];
  const response = await create({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: JSON.stringify({ elements: buildAiInput(rows, readLine) }) }],
  });

  if (response.stop_reason === "refusal") throw new Error("The AI step declined this request. The register was written without suggestions.");
  if (response.stop_reason === "max_tokens") throw new Error("The AI reply was cut off. Try again with fewer elements.");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = JSON.parse(text) as { items: AiSuggestion[] };
  const known = new Set(rows.map((r) => r.element));
  return parsed.items.filter((i) => known.has(i.element));
}

/** Write suggestions into rows that still say TODO. Marks them so a reviewer can tell. */
export function applySuggestions(rows: RegisterRow[], suggestions: AiSuggestion[]): void {
  const byElement = new Map(suggestions.map((s) => [s.element, s]));
  for (const r of rows) {
    const s = byElement.get(r.element);
    if (!s) continue;
    if (r.purpose === "TODO") r.purpose = `AI: ${s.purpose} (basis: ${s.basis})`;
    if (r.retention === "TODO") r.retention = `AI: ${s.retention}`;
  }
}
