# DPDP Guard

Scan a Next.js or Node.js codebase for personal data and get the data register and gap report that India's **Digital Personal Data Protection (DPDP) Act** asks for.

> Status: MVP CLI working (scanners, register, 7 gap rules). `--ai` and the GitHub Action PR comment are next. See [docs/MVP-PLAN.md](docs/MVP-PLAN.md).

## Why
- Consent Manager rules apply from **14 Nov 2026**. Consent, security, rights and breach duties apply from **14 May 2027**.
- Penalties are per instance: up to ₹250 crore for weak safeguards and ₹200 crore for a breach that isn't reported.
- Teams must know where personal data is collected, stored, shared and deleted. Most startups have never mapped this in code.

## What it will do
- Find personal data fields in forms, database schemas, API routes and analytics calls.
- Write a data register (`dpdp-register.md` + `.json`).
- Flag gaps such as pre-ticked consent, no consent log, or no erasure path.
- Comment on a PR when a new personal data field appears without a purpose.

## Usage
```bash
npm install && npm run build
node dist/cli.js scan path/to/your-app              # writes dpdp-register.md/.json + dpdp-gaps.md
node dist/cli.js scan . --out reports --fail-on high   # CI: exit 1 on high gaps
node dist/cli.js scan . --json                         # print JSON only
```
Once published: `npx dpdp-guard scan .`

Try it on the planted sample app: `npm run dev -- scan fixtures/sample-app --out /tmp/dpdp`.

## What it finds today
| Source | Example |
|---|---|
| JSX forms | `<input name="mobile" type="tel">`, `autoComplete="email"`, react-hook-form `register("email")` |
| Zod | `z.object({ pan: z.string(), contact: z.string().email() })` |
| Prisma | `model User { aadhaar String? }` |
| Trackers / vendors | `mixpanel.people.set({ $email })`, `Sentry.setUser(...)`, PostHog, GA, Meta Pixel, Segment, Razorpay ... (`src/processors.ts`) |
| package.json | known SDKs listed as third parties |

## Gap rules
| Rule | Checks |
|---|---|
| DPDP-01 | Consent / marketing checkbox ticked by default |
| DPDP-02 | Personal data collected but no consent record in code or schema |
| DPDP-03 | Prisma model with personal data and no delete call |
| DPDP-04 | Personal data sent to analytics, marketing or session-replay SDKs |
| DPDP-05 | Age / DOB collected with no guardian consent flow |
| DPDP-06 | Personal data or whole user objects in logs |
| DPDP-07 | Aadhaar number stored in the database |

Not legal advice. The tool helps engineers find and document data; a lawyer should review the final register.
