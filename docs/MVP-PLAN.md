# DPDP Guard: MVP plan

**One line:** A TypeScript CLI and GitHub Action that maps personal data in a JS/TS codebase and reports DPDP gaps.

## How it works
1. **Scan:** parse `.ts/.tsx/.js` with ts-morph, plus `schema.prisma` and Drizzle schema files.
2. **Detect:** match field names, input types and validators against a PII dictionary (name, email, phone, address, DOB, Aadhaar, PAN, location, IP, device ID, health, payment).
3. **Classify (optional `--ai`):** send the field list per file to Claude for category, likely purpose and a confidence score, as structured JSON.
4. **Check gaps:** rules below.
5. **Report:** Markdown + JSON register, and a PR comment in Action mode.

## Sources to scan (MVP)
| Source | Example |
|---|---|
| JSX forms | `<input name="phone" type="tel">`, react-hook-form `register("email")` |
| Validation schemas | Zod `z.string().email()` |
| DB schemas | Prisma `model User { aadhaar String }` |
| Outbound calls | `fetch`/axios to analytics (GA, Mixpanel, PostHog, Meta pixel) with PII in the payload |

## Gap rules (MVP)
1. Consent checkbox with `defaultChecked` / `checked={true}` (consent must be a clear affirmative action).
2. Personal data collected but no consent record write found nearby (heuristic: no call to a `consent*` function or table).
3. No delete/erasure route for a model that holds personal data.
4. PII sent to a third-party analytics SDK.
5. Children's data hints (age/DOB fields) without a guardian consent flow.
6. Logging PII (`console.log(user)`, logger calls with email/phone).

## Output
- `dpdp-register.md`: table of data element, category, where collected, where stored, shared with, purpose (TODO if unknown), file:line.
- `dpdp-gaps.md`: each gap with rule, file:line and a suggested fix.
- `dpdp-register.json` for other tools.

## Stack
TypeScript (Node 22, ESM), ts-morph, @mrleebo/prisma-ast, commander, @anthropic-ai/sdk (`claude-opus-5-5`, structured outputs with Zod), vitest with fixture repos.

## Build order (3–4 weeks)
1. PII dictionary + JSX/Zod scanner + fixture tests (done)
2. Prisma/Drizzle scanner + register output (Prisma done, Drizzle next)
3. Gap rules 1–6 (done, plus DPDP-07 Aadhaar storage)
4. `--ai` classification
5. GitHub Action PR comment (only new fields in the diff)
6. Run on 2 open-source Next.js apps, write README with screenshots

## Later
- Small Next.js web report viewer
- Consent log starter kit (table + API route) the tool can generate
- Python/Django support
