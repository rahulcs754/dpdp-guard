# DPDP Guard

Scan a Next.js or Node.js codebase for personal data and get the data register and gap report that India's **Digital Personal Data Protection (DPDP) Act** asks for.

> Status: planning. See [docs/MVP-PLAN.md](docs/MVP-PLAN.md).

## Why
- Consent Manager rules apply from **14 Nov 2026**. Consent, security, rights and breach duties apply from **14 May 2027**.
- Penalties are per instance: up to ₹250 crore for weak safeguards and ₹200 crore for a breach that isn't reported.
- Teams must know where personal data is collected, stored, shared and deleted. Most startups have never mapped this in code.

## What it will do
- Find personal data fields in forms, database schemas, API routes and analytics calls.
- Write a data register (`dpdp-register.md` + `.json`).
- Flag gaps such as pre-ticked consent, no consent log, or no erasure path.
- Comment on a PR when a new personal data field appears without a purpose.

## Planned usage
```bash
npx dpdp-guard scan .            # register + gap report
npx dpdp-guard scan . --ai       # Claude writes purpose text for each field
```

Not legal advice. The tool helps engineers find and document data; a lawyer should review the final register.
